use notify::{EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

pub mod adapter;
pub mod status_map;
#[cfg(test)]
mod tests;

static DEBUG_ENABLED: AtomicBool = AtomicBool::new(false);

const ASSETS_REPO: &str = "moeyui1/claude-status-pet";

fn init_debug(args: &[String]) {
    let _ = args; // reserved for future use
    if std::env::var("PET_DEBUG").is_ok_and(|v| v == "1" || v == "true") {
        DEBUG_ENABLED.store(true, Ordering::Relaxed);
    }
}

fn debug_log(path: &Path, msg: &str) {
    if !DEBUG_ENABLED.load(Ordering::Relaxed) {
        return;
    }
    // path can be a status file or the log file itself — resolve to pet-debug.log in same dir
    let log_path = if path.is_dir() {
        path.join("pet-debug.log")
    } else if path.file_name().is_some_and(|f| f == "pet-debug.log") {
        path.to_path_buf()
    } else {
        path.parent().unwrap_or(path).join("pet-debug.log")
    };
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| {
            let secs = d.as_secs();
            let millis = d.subsec_millis();
            let h = (secs % 86400) / 3600;
            let m = (secs % 3600) / 60;
            let s = secs % 60;
            format!("{:02}:{:02}:{:02}.{:03}", h, m, s, millis)
        })
        .unwrap_or_default();
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = writeln!(f, "[{}] {}", timestamp, msg);
    }
}

#[derive(Clone, Serialize)]
struct StatusPayload {
    state: String,
    detail: String,
    tool: String,
    event: String,
    session_id: String,
    session_name: String,
}

fn default_status_path() -> PathBuf {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".claude").join("pet-data").join("status.json")
}

fn read_status(path: &Path) -> Option<StatusPayload> {
    parse_status(&fs::read_to_string(path).ok()?)
}

fn parse_status(content: &str) -> Option<StatusPayload> {
    let v: serde_json::Value = serde_json::from_str(content).ok()?;
    Some(StatusPayload {
        state: v["state"].as_str().unwrap_or("idle").to_string(),
        detail: v["detail"].as_str().unwrap_or("").to_string(),
        tool: v["tool"].as_str().unwrap_or("").to_string(),
        event: v["event"].as_str().unwrap_or("").to_string(),
        session_id: v["session_id"].as_str().unwrap_or("").to_string(),
        session_name: v["session_name"].as_str().unwrap_or("").to_string(),
    })
}

#[tauri::command]
fn get_status(status_path: tauri::State<'_, Arc<Mutex<PathBuf>>>) -> Option<StatusPayload> {
    let path = status_path.lock().unwrap();
    read_status(&path)
}

#[tauri::command]
fn get_session_id(session_id: tauri::State<'_, Arc<Mutex<String>>>) -> String {
    session_id.lock().unwrap().clone()
}

#[tauri::command]
fn get_assets_dir(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Option<String> {
    assets_dir
        .inner()
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
}

#[derive(Clone, Serialize, Deserialize)]
struct SessionInfo {
    session_id: String,
    session_name: String,
    state: String,
    detail: String,
    status_file: String,
    last_modified: u64,
    /// None when the status file has no Claude process recorded (older binary, other agents, non-Windows)
    alive: Option<bool>,
}

fn read_claude_process_alive(path: &PathBuf) -> Option<bool> {
    let content = fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&content).ok()?;
    let pid = u32::try_from(v["claude_pid"].as_u64()?).ok()?;
    let started = v["claude_started"].as_u64()?;
    Some(is_same_process_running(pid, started))
}

#[tauri::command]
fn list_unlocked_sessions() -> Vec<SessionInfo> {
    collect_sessions(true)
}

/// Every session with a status file, including ones already bound to a per-session pet.
#[tauri::command]
fn list_all_sessions() -> Vec<SessionInfo> {
    collect_sessions(false)
}

/// Marks the GUI launched with `run --all`: one window aggregating every session.
struct AggregateMode(bool);

#[tauri::command]
fn is_aggregate_mode(mode: tauri::State<'_, AggregateMode>) -> bool {
    mode.0
}

fn is_status_file_name(name: &str) -> bool {
    name.starts_with("status-") && name.ends_with(".json")
}

/// Watches `dir` (non-recursive) on a background thread and passes every event to `on_event`.
fn spawn_dir_watcher(
    dir: PathBuf,
    log_path: PathBuf,
    mut on_event: impl FnMut(notify::Event) + Send + 'static,
) {
    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                debug_log(&log_path, &format!("FATAL: watcher init failed: {}", e));
                return;
            }
        };
        let _ = fs::create_dir_all(&dir);
        if let Err(e) = watcher.watch(&dir, RecursiveMode::NonRecursive) {
            debug_log(&log_path, &format!("FATAL: watch() failed: {}", e));
            return;
        }
        debug_log(&log_path, &format!("Watcher started on {:?}", dir));
        for event in rx {
            match event {
                Ok(event) => on_event(event),
                Err(e) => debug_log(&log_path, &format!("Watcher error: {:?}", e)),
            }
        }
        debug_log(&log_path, "Watcher loop ended (channel closed)");
    });
}

/// Single-session mode: emits status-update whenever this session's status file changes,
/// and a synthetic "closed" status once the file is really deleted.
fn spawn_status_file_watcher(status_file: PathBuf, handle: tauri::AppHandle) {
    let Some(dir) = status_file.parent().map(|p| p.to_path_buf()) else {
        debug_log(&status_file, "FATAL: status path has no parent dir");
        return;
    };
    // One rename-replace reports both Remove and Modify for the status file; emitting each would
    // re-roll the random sprite twice per update
    let mut last_content = None;
    emit_status_if_changed(&status_file, &mut last_content, &handle);
    let log_path = status_file.clone();
    spawn_dir_watcher(dir, log_path.clone(), move |event| {
        if !event.paths.contains(&status_file) {
            return;
        }
        debug_log(
            &log_path,
            &format!("Event: {:?}, paths: {:?}", event.kind, event.paths),
        );
        match event.kind {
            EventKind::Modify(_) | EventKind::Create(_) => {
                // write-status replaces the file atomically; the retry covers writers that do not
                if !emit_status_if_changed(&status_file, &mut last_content, &handle) {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                    emit_status_if_changed(&status_file, &mut last_content, &handle);
                }
            }
            EventKind::Remove(_) => {
                // Replacing the file by rename reports Remove for it first, and an in-place rewrite
                // can too; only a file still missing after a pause means the session is gone
                if !status_file.exists() {
                    std::thread::sleep(std::time::Duration::from_millis(300));
                }
                if status_file.exists() {
                    emit_status_if_changed(&status_file, &mut last_content, &handle);
                } else {
                    last_content = None;
                    debug_log(&log_path, "File truly deleted, emitting closed state");
                    let _ = handle.emit(
                        "status-update",
                        StatusPayload {
                            state: "closed".to_string(),
                            detail: "Session ended".to_string(),
                            tool: String::new(),
                            event: "SessionEnd".to_string(),
                            session_id: String::new(),
                            session_name: String::new(),
                        },
                    );
                }
            }
            _ => debug_log(&log_path, &format!("Ignored event: {:?}", event.kind)),
        }
    });
}

/// Emits the status file's content unless it equals what was emitted last.
/// Returns false when the file cannot be read or parsed.
fn emit_status_if_changed(
    status_file: &Path,
    last_content: &mut Option<String>,
    handle: &tauri::AppHandle,
) -> bool {
    let Ok(content) = fs::read_to_string(status_file) else {
        debug_log(status_file, "Read failed (file missing or mid-write)");
        return false;
    };
    if last_content.as_deref() == Some(content.as_str()) {
        return true;
    }
    let Some(status) = parse_status(&content) else {
        debug_log(status_file, "Parse failed (file may be mid-write)");
        return false;
    };
    debug_log(
        status_file,
        &format!("Emit: state={}, detail={}", status.state, status.detail),
    );
    let _ = handle.emit("status-update", status);
    *last_content = Some(content);
    true
}

/// Aggregate mode: pings the frontend whenever any status-*.json changes; the frontend then
/// re-reads the whole list via list_all_sessions, so the payload carries no data.
fn spawn_sessions_watcher(handle: tauri::AppHandle) {
    let pet_dir = default_pet_dir();
    spawn_dir_watcher(pet_dir.clone(), pet_dir, move |event| {
        let touches_status = event.paths.iter().any(|p| {
            p.file_name()
                .is_some_and(|n| is_status_file_name(&n.to_string_lossy()))
        });
        if touches_status {
            let _ = handle.emit("sessions-changed", ());
        }
    });
}

/// Single-instance guard for the aggregate pet. Several SessionStart hooks can launch it at the
/// same moment, so a check-then-write lock file would let two through. Returns the lock file to
/// delete on exit (None when the OS releases the guard itself), or Err if a pet already runs.
#[cfg(windows)]
fn acquire_aggregate_guard() -> Result<Option<PathBuf>, ()> {
    const ERROR_ALREADY_EXISTS: u32 = 183;
    let name: Vec<u16> = "Local\\claude-status-pet-aggregate\0"
        .encode_utf16()
        .collect();
    unsafe {
        let handle = CreateMutexW(std::ptr::null_mut(), 0, name.as_ptr());
        if handle.is_null() {
            return Ok(None);
        }
        if GetLastError() == ERROR_ALREADY_EXISTS {
            CloseHandle(handle);
            return Err(());
        }
    }
    // The handle is intentionally never closed: Windows releases the mutex when the process
    // exits, crashes included, so no stale lock can block the next launch.
    Ok(None)
}

#[cfg(not(windows))]
fn acquire_aggregate_guard() -> Result<Option<PathBuf>, ()> {
    let lock_file = default_pet_dir().join("pet-all.lock");
    for _ in 0..2 {
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_file)
        {
            Ok(mut file) => {
                let _ = write!(file, "{}", std::process::id());
                return Ok(Some(lock_file));
            }
            Err(_) if is_lock_alive(&lock_file) => return Err(()),
            Err(_) => {
                let _ = fs::remove_file(&lock_file);
            }
        }
    }
    Err(())
}

fn collect_sessions(skip_locked: bool) -> Vec<SessionInfo> {
    let pet_dir = default_pet_dir();
    let Ok(entries) = fs::read_dir(&pet_dir) else {
        return vec![];
    };
    let mut sessions = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name();
        let name_str = name.to_string_lossy().to_string();
        if is_status_file_name(&name_str) {
            let sid = name_str
                .strip_prefix("status-")
                .unwrap()
                .strip_suffix(".json")
                .unwrap()
                .to_string();
            if skip_locked {
                let lock_file = pet_dir.join(format!("pet-{}.lock", sid));
                if is_lock_alive(&lock_file) {
                    continue; // already has a running pet
                }
                // Clean up dead lock file
                if lock_file.exists() {
                    let _ = fs::remove_file(&lock_file);
                }
            }
            let status_path = entry.path();
            let last_modified = status_path
                .metadata()
                .and_then(|m| m.modified())
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64
                })
                .unwrap_or(0);
            let (sname, state, detail) = if let Some(s) = read_status(&status_path) {
                (s.session_name, s.state, s.detail)
            } else {
                (String::new(), "idle".to_string(), String::new())
            };
            let alive = read_claude_process_alive(&status_path);
            sessions.push(SessionInfo {
                session_id: sid,
                session_name: sname,
                state,
                detail,
                status_file: status_path.to_string_lossy().to_string(),
                last_modified,
                alive,
            });
        }
    }
    sessions
}

#[tauri::command]
fn bind_session(
    session_id: String,
    status_path_state: tauri::State<'_, Arc<Mutex<PathBuf>>>,
    session_id_state: tauri::State<'_, Arc<Mutex<String>>>,
    lock_path_state: tauri::State<'_, Arc<Mutex<Option<PathBuf>>>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if !is_safe_session_id(&session_id) {
        return Err("Invalid session ID".to_string());
    }
    let pet_dir = default_pet_dir();
    let status_file = pet_dir.join(format!("status-{}.json", session_id));
    let lock_file = pet_dir.join(format!("pet-{}.lock", session_id));

    if is_lock_alive(&lock_file) {
        return Err("Session already has a running pet".to_string());
    }
    write_lock_file(&lock_file);

    // Update shared state
    *status_path_state.lock().unwrap() = status_file.clone();
    *session_id_state.lock().unwrap() = session_id.clone();
    *lock_path_state.lock().unwrap() = Some(lock_file);

    spawn_status_file_watcher(status_file, app);

    Ok(())
}

#[tauri::command]
fn is_dlc_installed(assets_dir: tauri::State<'_, Option<PathBuf>>, dlc_name: String) -> bool {
    if let Some(dir) = assets_dir.inner().as_ref() {
        let dlc_dir = dir.join(&dlc_name);
        let char_json = dlc_dir.join("character.json");
        if !char_json.exists() {
            return false;
        }
        // Check if any asset files exist
        if let Ok(entries) = fs::read_dir(&dlc_dir) {
            return entries.filter_map(|e| e.ok()).any(|e| {
                matches!(
                    e.path().extension().and_then(|ext| ext.to_str()),
                    Some("gif" | "svg" | "png")
                )
            });
        }
    }
    false
}

#[tauri::command]
async fn download_dlc(
    assets_dir: tauri::State<'_, Option<PathBuf>>,
    dlc_name: String,
) -> Result<bool, String> {
    let dir = assets_dir
        .inner()
        .as_ref()
        .ok_or("No assets directory configured")?
        .clone();
    let dlc = dlc_name.clone();

    tauri::async_runtime::spawn_blocking(move || download_dlc_blocking(&dir, &dlc))
        .await
        .map_err(|e| e.to_string())?
}

fn download_dlc_blocking(dir: &Path, dlc_name: &str) -> Result<bool, String> {
    if !is_safe_session_id(dlc_name) {
        return Err("Invalid DLC name".to_string());
    }

    // Read DLC config from dlc/<name>.json
    let config_path = dir.join("dlc").join(format!("{}.json", dlc_name));
    let config_str = fs::read_to_string(&config_path)
        .map_err(|e| format!("DLC config not found: {}: {}", config_path.display(), e))?;
    let config: serde_json::Value =
        serde_json::from_str(&config_str).map_err(|e| format!("Invalid DLC config: {}", e))?;

    let downloads = config["downloads"]
        .as_array()
        .ok_or_else(|| "DLC config missing 'downloads' array".to_string())?;

    let dlc_dir = dir.join(dlc_name);
    fs::create_dir_all(&dlc_dir).map_err(|e| format!("Failed to create DLC directory: {}", e))?;

    // Download each file (validate paths stay within assets dir)
    let dir_canonical = dir
        .canonicalize()
        .map_err(|e| format!("Invalid assets dir: {}", e))?;
    let mut failed = Vec::new();
    for item in downloads {
        let path = item["path"].as_str().unwrap_or("");
        let url = item["url"].as_str().unwrap_or("");
        if path.is_empty() || url.is_empty() {
            continue;
        }
        // Path traversal prevention: ensure dest stays within assets dir
        let dest = dir.join(path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory for {}: {}", path, e))?;
        }
        let dest_parent = dest
            .parent()
            .and_then(|p| p.canonicalize().ok())
            .ok_or_else(|| format!("Invalid path: {}", path))?;
        if !dest_parent.starts_with(&dir_canonical) {
            return Err(format!("Path traversal blocked: {}", path));
        }
        match download_file(url, &dest) {
            Ok(_) => {}
            Err(e) => {
                eprintln!("Failed to download {}: {}", path, e);
                failed.push(path.to_string());
            }
        }
    }

    if !failed.is_empty() {
        return Err(format!("Failed to download: {}", failed.join(", ")));
    }

    // Write character.json from the states in the DLC config
    let mut character = serde_json::json!({
        "name": config["name"],
        "type": config["type"],
        "states": config["states"]
    });
    if let Some(ver) = config.get("version") {
        character["version"] = ver.clone();
    }
    fs::write(
        dlc_dir.join("character.json"),
        serde_json::to_string_pretty(&character).unwrap(),
    )
    .map_err(|e| format!("Failed to write character.json: {}", e))?;

    Ok(true)
}

/// Reads an image from the assets dir, falling back to the custom characters dir, as a data URL.
#[tauri::command]
fn load_asset(assets_dir: tauri::State<'_, Option<PathBuf>>, path: String) -> Option<String> {
    use base64::Engine;
    let dir = assets_dir.inner().as_ref()?;
    let file_path = dir.join(&path);
    let file_path = if file_path.exists() {
        file_path
    } else {
        dir.parent()?.join("characters").join(&path)
    };
    let bytes = fs::read(&file_path).ok()?;
    let mime = match file_path.extension().and_then(|e| e.to_str()) {
        Some("svg") => "image/svg+xml",
        Some("gif") => "image/gif",
        Some("png") => "image/png",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn load_text_asset(assets_dir: tauri::State<'_, Option<PathBuf>>, path: String) -> Option<String> {
    let dir = assets_dir.inner().as_ref()?;
    // Try assets dir first, then custom characters dir
    let asset_path = dir.join(&path);
    if let Ok(content) = fs::read_to_string(&asset_path) {
        return Some(content);
    }
    let custom_path = dir.parent()?.join("characters").join(&path);
    fs::read_to_string(&custom_path).ok()
}

#[derive(Clone, Serialize)]
struct DlcInfo {
    id: String,
    name: String,
    installed: bool,
}

#[tauri::command]
fn list_available_dlcs(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Vec<DlcInfo> {
    let mut dlcs = Vec::new();

    // Scan dlc/*.json in assets dir, with fallback to default pet-data/assets/dlc/
    let dirs_to_check: Vec<PathBuf> = if let Some(dir) = assets_dir.inner().as_ref() {
        vec![dir.clone()]
    } else {
        vec![default_pet_dir().join("assets")]
    };

    for dir in &dirs_to_check {
        let dlc_dir = dir.join("dlc");
        let Ok(entries) = fs::read_dir(&dlc_dir) else {
            continue;
        };
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let id = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if dlcs.iter().any(|d: &DlcInfo| d.id == id) {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) else {
                continue;
            };
            let name = v["name"].as_str().unwrap_or(&id).to_string();
            let installed = dir.join(&id).join("character.json").exists();
            dlcs.push(DlcInfo {
                id,
                name,
                installed,
            });
        }
    }
    dlcs
}

#[derive(Clone, Serialize)]
struct CharacterPack {
    id: String,
    name: String,
    #[serde(rename = "type")]
    char_type: String,
    group: String,
    installed: bool,
    config_path: String,
}

#[tauri::command]
fn list_character_packs(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Vec<CharacterPack> {
    let mut packs = Vec::new();

    if let Some(dir) = assets_dir.inner().as_ref() {
        // Scan assets dir (DLC: mona, kuromi, etc.)
        scan_packs_in_dir(dir, "dlc", &mut packs);

        // Scan custom characters dir (sibling to assets)
        let custom_dir = dir
            .parent()
            .map(|p| p.join("characters"))
            .unwrap_or_default();
        if custom_dir.is_dir() {
            scan_packs_in_dir(&custom_dir, "custom", &mut packs);
        }
    }

    packs
}

fn scan_packs_in_dir(dir: &PathBuf, group: &str, packs: &mut Vec<CharacterPack>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let config_path = path.join("character.json");
            let id = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    packs.push(CharacterPack {
                        id: id.clone(),
                        name: v["name"].as_str().unwrap_or(&id).to_string(),
                        char_type: v["type"].as_str().unwrap_or("gif").to_string(),
                        group: group.to_string(),
                        installed: true,
                        config_path: config_path.to_string_lossy().to_string(),
                    });
                }
            } else {
                // Directory exists but no character.json — check if has image files
                let has_images = fs::read_dir(&path).ok().is_some_and(|entries| {
                    entries.filter_map(|e| e.ok()).any(|e| {
                        let ext = e
                            .path()
                            .extension()
                            .and_then(|x| x.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        ext == "gif" || ext == "svg" || ext == "png"
                    })
                });
                if has_images {
                    packs.push(CharacterPack {
                        id,
                        name: path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string(),
                        char_type: "gif".to_string(),
                        group: group.to_string(),
                        installed: true,
                        config_path: String::new(),
                    });
                }
            }
        }
    }
}

/// CLI: write-status subcommand
/// Reads event info from CLI args or stdin (via adapter), writes status JSON, exits.
fn cmd_write_status(args: &[String]) {
    init_debug(args);
    let pet_dir = default_pet_dir();
    let _ = fs::create_dir_all(&pet_dir);
    let log_path = pet_dir.join("pet-debug.log"); // dummy file path for debug_log
    let t0 = std::time::Instant::now();

    debug_log(
        &log_path,
        &format!("write-status START args={:?}", &args[1..]),
    );

    // Parse CLI args
    let adapter_name = get_arg(args, "--adapter");
    let event_arg = get_arg(args, "--event");
    let tool_arg = get_arg(args, "--tool").unwrap_or_default();
    let detail_arg = get_arg(args, "--detail").unwrap_or_default();
    let session_id_arg = get_arg(args, "--session-id");
    let session_name_arg = get_arg(args, "--session-name");

    let (event, tool, detail, session_id, session_name, launch_only) = if let Some(adapter_name) =
        &adapter_name
    {
        // Adapter mode: read stdin JSON
        debug_log(&log_path, "reading stdin...");
        let stdin_data = read_stdin();
        debug_log(
            &log_path,
            &format!(
                "stdin read in {:?}, len={}, data={}",
                t0.elapsed(),
                stdin_data.len(),
                stdin_data
            ),
        );
        let stdin: adapter::StdinInput = serde_json::from_str(&stdin_data).unwrap_or_default();

        if let Some(adapter) = adapter::get_adapter(adapter_name) {
            if let Some(ev) = adapter.parse(&stdin) {
                (
                    ev.event,
                    ev.tool,
                    ev.detail,
                    ev.session_id,
                    ev.session_name,
                    ev.launch_only,
                )
            } else {
                return;
            }
        } else {
            eprintln!("Unknown adapter: {}", adapter_name);
            std::process::exit(1);
        }
    } else if let Some(event) = event_arg {
        // CLI args mode
        let sid = session_id_arg.unwrap_or_else(|| "cli".to_string());
        let sname = session_name_arg.unwrap_or_else(|| sid.clone());
        let detail = if detail_arg.is_empty() {
            status_map::tool_detail(&tool_arg, "", "")
        } else {
            detail_arg
        };
        (event, tool_arg, detail, sid, sname, false)
    } else {
        eprintln!("Usage: claude-status-pet write-status --event <prompt|tool|done|error|offline> [--tool <name>] [--detail <text>] [--session-id <id>]");
        eprintln!(
            "   or: claude-status-pet write-status --adapter <claude|copilot|vscode> < stdin.json"
        );
        std::process::exit(1);
    };

    // Determine state from event + tool
    let state = if event == "tool" && !tool.is_empty() {
        status_map::tool_to_state(&tool)
    } else {
        status_map::event_to_state(&event)
    };

    if !is_safe_session_id(&session_id) {
        eprintln!("Invalid session ID");
        std::process::exit(1);
    }

    let status_file = pet_dir.join(format!("status-{}.json", session_id));

    debug_log(
        &log_path,
        &format!("writing state={} tool={} to {:?}", state, tool, status_file),
    );

    // launch_only: don't write status (e.g. Copilot sessionStart — GUI launch handled by hook script)
    if launch_only {
        debug_log(&log_path, "launch_only — skipping status write");
    } else if event == "subagent_done" && !is_still_delegating(&status_file) {
        // A background sub-agent can finish after the main turn already ended (Stop wrote idle)
        // or moved on to other tools; switching to thinking then would stick with nothing running.
        debug_log(
            &log_path,
            "subagent_done while not delegating — keeping current state",
        );
    } else {
        // Lets the aggregate pet drop a session whose Claude process died without a SessionEnd hook
        let claude_process = find_claude_ancestor();
        let status = serde_json::json!({
            "state": state, "detail": detail, "tool": tool,
            "event": event, "session_id": session_id,
            "session_name": session_name, "timestamp": timestamp(),
            "claude_pid": claude_process.map(|(pid, _)| pid),
            "claude_started": claude_process.map(|(_, started)| started)
        });
        write_status_file(&status_file, &status.to_string());
    }

    // Output session info to stdout (hook script captures this to launch GUI)
    println!("{}\t{}", status_file.to_string_lossy(), session_id);

    debug_log(&log_path, &format!("file written in {:?}", t0.elapsed()));
    debug_log(
        &log_path,
        &format!("write-status DONE in {:?}", t0.elapsed()),
    );
}

/// Parallel tool calls run several async hooks at once, and two truncate-then-write calls on
/// the same file can leave trailing bytes of the longer status behind, so readers must only
/// ever see a complete file.
fn write_status_file(status_file: &Path, content: &str) {
    let file_name = status_file
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let temp_file =
        status_file.with_file_name(format!(".{}.{}.tmp", file_name, std::process::id()));
    let replaced =
        fs::write(&temp_file, content).is_ok() && fs::rename(&temp_file, status_file).is_ok();
    if !replaced {
        // The rename fails if another program holds the status file open without delete sharing
        let _ = fs::remove_file(&temp_file);
        let _ = fs::write(status_file, content);
    }
}

fn is_temp_status_file_name(name: &str) -> bool {
    name.starts_with(".status-") && name.ends_with(".tmp")
}

fn is_still_delegating(status_file: &Path) -> bool {
    read_status(status_file).is_some_and(|status| status.state == "delegating")
}

fn cleanup_stale_status(pet_dir: &PathBuf) {
    let Ok(entries) = fs::read_dir(pet_dir) else {
        return;
    };
    let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(24 * 3600);
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if is_status_file_name(&name_str) || is_temp_status_file_name(&name_str) {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if modified < cutoff {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
        // Also clean up orphaned lock files whose process is no longer alive
        if name_str.starts_with("pet-")
            && name_str.ends_with(".lock")
            && !is_lock_alive(&entry.path().to_path_buf())
        {
            let _ = fs::remove_file(entry.path());
        }
    }
}

fn is_safe_session_id(id: &str) -> bool {
    !id.is_empty() && !id.contains('/') && !id.contains('\\') && !id.contains("..")
}

fn write_lock_file(lock_path: &PathBuf) {
    let _ = fs::write(lock_path, std::process::id().to_string());
}

fn is_lock_alive(lock_path: &PathBuf) -> bool {
    let Ok(content) = fs::read_to_string(lock_path) else {
        return false;
    };
    let Ok(pid) = content.trim().parse::<u32>() else {
        return false;
    };
    is_process_running(pid)
}

#[cfg(windows)]
fn is_process_running(pid: u32) -> bool {
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const STILL_ACTIVE: u32 = 259;
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }
        let mut exit_code: u32 = 0;
        let result = GetExitCodeProcess(handle, &mut exit_code);
        CloseHandle(handle);
        result != 0 && exit_code == STILL_ACTIVE
    }
}

#[cfg(windows)]
unsafe extern "system" {
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
    fn GetExitCodeProcess(handle: *mut std::ffi::c_void, exit_code: *mut u32) -> i32;
    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    fn CreateMutexW(
        attributes: *mut std::ffi::c_void,
        initial_owner: i32,
        name: *const u16,
    ) -> *mut std::ffi::c_void;
    fn GetLastError() -> u32;
    fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> *mut std::ffi::c_void;
    fn Process32FirstW(snapshot: *mut std::ffi::c_void, entry: *mut ProcessEntry32W) -> i32;
    fn Process32NextW(snapshot: *mut std::ffi::c_void, entry: *mut ProcessEntry32W) -> i32;
    fn GetProcessTimes(
        handle: *mut std::ffi::c_void,
        creation: *mut FileTime,
        exit: *mut FileTime,
        kernel: *mut FileTime,
        user: *mut FileTime,
    ) -> i32;
}

/// PROCESSENTRY32W from tlhelp32.h
#[cfg(windows)]
#[repr(C)]
struct ProcessEntry32W {
    size: u32,
    usage: u32,
    process_id: u32,
    default_heap_id: usize,
    module_id: u32,
    threads: u32,
    parent_process_id: u32,
    priority_class_base: i32,
    flags: u32,
    exe_file: [u16; 260],
}

#[cfg(windows)]
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct FileTime {
    low: u32,
    high: u32,
}

/// Creation time of a running process, as a raw FILETIME value.
#[cfg(windows)]
fn process_start_time(pid: u32) -> Option<u64> {
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }
        let mut times = [FileTime::default(); 4];
        let [creation, exit, kernel, user] = &mut times;
        let ok = GetProcessTimes(handle, creation, exit, kernel, user);
        CloseHandle(handle);
        (ok != 0).then(|| ((times[0].high as u64) << 32) | times[0].low as u64)
    }
}

/// The Claude Code process that ran this hook, found by walking up the parent chain
/// (claude.exe -> bash.exe -> write-status). Returns its PID and creation time.
#[cfg(windows)]
fn find_claude_ancestor() -> Option<(u32, u64)> {
    const TH32CS_SNAPPROCESS: u32 = 0x2;
    const MAX_DEPTH: usize = 8;
    let mut processes: std::collections::HashMap<u32, (u32, String)> =
        std::collections::HashMap::new();
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot.is_null() || snapshot as isize == -1 {
            return None;
        }
        let mut entry: ProcessEntry32W = std::mem::zeroed();
        entry.size = std::mem::size_of::<ProcessEntry32W>() as u32;
        let mut has_entry = Process32FirstW(snapshot, &mut entry) != 0;
        while has_entry {
            let name_len = entry
                .exe_file
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(entry.exe_file.len());
            let name = String::from_utf16_lossy(&entry.exe_file[..name_len]);
            processes.insert(entry.process_id, (entry.parent_process_id, name));
            has_entry = Process32NextW(snapshot, &mut entry) != 0;
        }
        CloseHandle(snapshot);
    }
    let mut pid = std::process::id();
    for _ in 0..MAX_DEPTH {
        let parent = processes.get(&pid)?.0;
        if processes.get(&parent)?.1.eq_ignore_ascii_case("claude.exe") {
            return process_start_time(parent).map(|started| (parent, started));
        }
        pid = parent;
    }
    None
}

#[cfg(not(windows))]
fn find_claude_ancestor() -> Option<(u32, u64)> {
    None
}

/// Whether the Claude process recorded in a status file is still the same running process.
/// Windows reuses PIDs, so the creation time must match too, or a dead session could look
/// alive through an unrelated process that took over its PID.
#[cfg(windows)]
fn is_same_process_running(pid: u32, started: u64) -> bool {
    process_start_time(pid) == Some(started) && is_process_running(pid)
}

#[cfg(not(windows))]
fn is_same_process_running(pid: u32, _started: u64) -> bool {
    is_process_running(pid)
}

#[cfg(not(windows))]
fn is_process_running(pid: u32) -> bool {
    // signal 0 checks if process exists without sending a signal
    unsafe { libc_kill(pid as i32, 0) == 0 }
}

#[cfg(not(windows))]
unsafe extern "C" {
    #[link_name = "kill"]
    fn libc_kill(pid: i32, sig: i32) -> i32;
}

fn download_file(url: &str, dest: &PathBuf) -> Result<(), String> {
    use std::io::Read;
    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(30)))
        .build()
        .new_agent();
    let resp = agent.get(url).call().map_err(|e| e.to_string())?;
    let status = resp.status();
    if status != 200 {
        return Err(format!("HTTP {}", status));
    }
    let mut bytes: Vec<u8> = Vec::new();
    resp.into_body()
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("Empty response".into());
    }
    fs::write(dest, &bytes).map_err(|e| e.to_string())
}

fn download_assets_blocking(assets_dir: &PathBuf) -> Result<(), String> {
    use std::io::Read;
    let url = format!(
        "https://github.com/{}/releases/latest/download/pet-assets.zip",
        ASSETS_REPO
    );
    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(60)))
        .build()
        .new_agent();
    let resp = agent
        .get(&url)
        .call()
        .map_err(|e| format!("Download failed: {}", e))?;
    let status = resp.status();
    if status != 200 {
        return Err(format!("Download failed: HTTP {}", status));
    }
    let mut zip_bytes: Vec<u8> = Vec::new();
    resp.into_body()
        .into_reader()
        .read_to_end(&mut zip_bytes)
        .map_err(|e| format!("Download failed: {}", e))?;
    if zip_bytes.is_empty() {
        return Err("Download failed: empty response".into());
    }

    // Extract zip to assets_dir
    fs::create_dir_all(assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    let cursor = std::io::Cursor::new(&zip_bytes);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Zip read error: {}", e))?;
        let Some(enclosed_name) = file.enclosed_name() else {
            continue;
        };
        let dest = assets_dir.join(enclosed_name);
        // Path traversal prevention
        if !dest.starts_with(assets_dir) {
            continue;
        }
        if file.is_dir() {
            let _ = fs::create_dir_all(&dest);
        } else {
            if let Some(parent) = dest.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)
                .map_err(|e| format!("Zip extract error: {}", e))?;
            fs::write(&dest, &buf).map_err(|e| format!("Write error: {}", e))?;
        }
    }

    // Clean outdated DLC so they re-download on next use
    let dlc_config_dir = assets_dir.join("dlc");
    if let Ok(entries) = fs::read_dir(&dlc_config_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let dlc_id = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let char_json = assets_dir.join(&dlc_id).join("character.json");
            if !char_json.exists() {
                continue;
            }
            let Ok(cfg_str) = fs::read_to_string(&path) else {
                continue;
            };
            let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&cfg_str) else {
                continue;
            };
            let Ok(inst_str) = fs::read_to_string(&char_json) else {
                continue;
            };
            let Ok(inst) = serde_json::from_str::<serde_json::Value>(&inst_str) else {
                continue;
            };
            if let Some(cv) = cfg.get("version").and_then(|v| v.as_u64()) {
                let iv = inst.get("version").and_then(|v| v.as_u64()).unwrap_or(0);
                if iv < cv {
                    let _ = fs::remove_dir_all(assets_dir.join(&dlc_id));
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn update_assets(assets_dir: tauri::State<'_, Option<PathBuf>>) -> Result<(), String> {
    let dir = assets_dir
        .inner()
        .as_ref()
        .cloned()
        .unwrap_or_else(|| default_pet_dir().join("assets"));

    tauri::async_runtime::spawn_blocking(move || download_assets_blocking(&dir))
        .await
        .map_err(|e| e.to_string())?
}

fn read_stdin() -> String {
    use std::io::Read;
    // Read stdin until complete JSON object (depth-balanced {}) or timeout.
    // Does NOT wait for EOF — returns as soon as JSON is complete.
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let mut depth = 0i32;
        let mut in_string = false;
        let mut escape = false;
        let mut started = false;

        // Stdin is buffered internally; byte-wise reads let us stop at the closing brace before EOF
        #[allow(clippy::unbuffered_bytes)]
        for byte in std::io::stdin().bytes() {
            let Ok(b) = byte else { break };
            buf.push(b);

            // JSON structure tracking (only for ASCII control chars, safe for UTF-8
            // since multi-byte sequences never contain bytes < 0x80)
            if escape {
                escape = false;
                continue;
            }
            if b == b'\\' && in_string {
                escape = true;
                continue;
            }
            if b == b'"' {
                in_string = !in_string;
                continue;
            }
            if in_string {
                continue;
            }
            if b == b'{' {
                depth += 1;
                started = true;
            }
            if b == b'}' {
                depth -= 1;
                if started && depth == 0 {
                    let _ = tx.send(String::from_utf8_lossy(&buf).into_owned());
                    return;
                }
            }
        }
        let _ = tx.send(String::from_utf8_lossy(&buf).into_owned());
    });
    rx.recv_timeout(std::time::Duration::from_millis(100))
        .unwrap_or_default()
}

fn get_arg(args: &[String], flag: &str) -> Option<String> {
    args.windows(2).find(|w| w[0] == flag).map(|w| w[1].clone())
}

fn default_pet_dir() -> PathBuf {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".claude").join("pet-data")
}

fn timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format_utc_timestamp(secs)
}

/// ISO 8601 UTC timestamp for a Unix time, without a chrono dependency.
fn format_utc_timestamp(secs: u64) -> String {
    let (year, month, day) = civil_from_days(secs / 86400);
    let time_secs = secs % 86400;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year,
        month,
        day,
        time_secs / 3600,
        (time_secs % 3600) / 60,
        time_secs % 60
    )
}

/// Gregorian date for a day count since 1970-01-01 (Howard Hinnant's civil_from_days).
/// Shifts the year to start in March so the leap day falls at the end of a 400-year era.
fn civil_from_days(days: u64) -> (u64, u64, u64) {
    let z = days + 719_468;
    let era = z / 146_097;
    let day_of_era = z % 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + u64::from(month <= 2);
    (year, month, day)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();

    // Subcommand dispatch: write-status runs without GUI
    if args.iter().any(|a| a == "write-status") {
        cmd_write_status(&args);
        std::process::exit(0); // Force exit — don't wait for stdin reader thread
    }

    if std::env::var("PET_DEBUG").is_ok_and(|v| v == "1" || v == "true") {
        DEBUG_ENABLED.store(true, Ordering::Relaxed);
    }

    let demo_mode = args.iter().any(|a| a == "--demo");
    let aggregate_mode = args.iter().any(|a| a == "--all");

    let explicit_status = args
        .windows(2)
        .find(|w| w[0] == "--status-file")
        .map(|w| PathBuf::from(&w[1]));
    let explicit_session = args
        .windows(2)
        .find(|w| w[0] == "--session-id")
        .map(|w| w[1].clone());

    // Determine if we have an explicit session or need session selection
    let (initial_status_path, initial_session_id, initial_lock) = if let Some(sf) = &explicit_status
    {
        let sid = explicit_session
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        let pet_dir = default_pet_dir();
        let _ = fs::create_dir_all(&pet_dir);
        let lock_file = pet_dir.join(format!("pet-{}.lock", sid));
        if is_lock_alive(&lock_file) {
            eprintln!("Pet already running for session {}", sid);
            std::process::exit(0);
        }
        write_lock_file(&lock_file);
        (sf.clone(), sid, Some(lock_file))
    } else if aggregate_mode {
        let _ = fs::create_dir_all(default_pet_dir());
        match acquire_aggregate_guard() {
            Ok(lock_file) => (default_status_path(), String::new(), lock_file),
            Err(()) => {
                eprintln!("Aggregate pet already running");
                std::process::exit(0);
            }
        }
    } else {
        // No explicit session — will show session picker in frontend
        (default_status_path(), String::new(), None)
    };

    let needs_session_select = explicit_status.is_none() && !demo_mode && !aggregate_mode;

    let assets_dir: Option<PathBuf> = args
        .windows(2)
        .find(|w| w[0] == "--assets-dir")
        .map(|w| PathBuf::from(&w[1]))
        .or_else(|| Some(default_pet_dir().join("assets")));

    if let Some(parent) = initial_status_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Clean up stale status files on GUI startup
    cleanup_stale_status(&default_pet_dir());

    let status_path_shared = Arc::new(Mutex::new(initial_status_path.clone()));
    let session_id_shared = Arc::new(Mutex::new(initial_session_id.clone()));
    let lock_path_shared: Arc<Mutex<Option<PathBuf>>> = Arc::new(Mutex::new(initial_lock.clone()));

    let lock_for_cleanup = lock_path_shared.clone();

    tauri::Builder::default()
        .manage(status_path_shared)
        .manage(session_id_shared)
        .manage(lock_path_shared)
        .manage(assets_dir)
        .manage(AggregateMode(aggregate_mode))
        .invoke_handler(tauri::generate_handler![
            get_status,
            get_session_id,
            get_assets_dir,
            load_asset,
            load_text_asset,
            is_dlc_installed,
            download_dlc,
            list_available_dlcs,
            list_character_packs,
            list_unlocked_sessions,
            list_all_sessions,
            is_aggregate_mode,
            bind_session,
            update_assets
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            // Set WebView2 background to transparent
            let _ = window.with_webview(|webview| {
                #[cfg(windows)]
                {
                    let controller = webview.controller();
                    unsafe {
                        use webview2_com::Microsoft::Web::WebView2::Win32::*;
                        let controller2: ICoreWebView2Controller2 =
                            windows::core::Interface::cast(&controller).unwrap();
                        let _ = controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR {
                            R: 0,
                            G: 0,
                            B: 0,
                            A: 0,
                        });
                    }
                }
            });

            let handle = app.handle().clone();

            if needs_session_select {
                // Frontend will query for session selection on init
                // (emit is unreliable here — JS may not have loaded listeners yet)
            } else if aggregate_mode {
                spawn_sessions_watcher(handle);
            } else if demo_mode {
                // Demo mode: cycle through all states for recording
                std::thread::spawn(move || {
                    let demos = vec![
                        ("idle", "Waiting for input..."),
                        ("thinking", "Processing prompt..."),
                        ("reading", "Reading lib.rs"),
                        ("editing", "Editing app.js"),
                        ("searching", "Searching: TODO"),
                        ("running", "Running npm test"),
                        ("delegating", "Spawning agent..."),
                        ("waiting", "Waiting for response..."),
                        ("error", "Build failed"),
                        ("offline", "Zzz..."),
                    ];
                    let mut i = 0;
                    loop {
                        let (state, detail) = demos[i % demos.len()];
                        let _ = handle.emit(
                            "status-update",
                            StatusPayload {
                                state: state.to_string(),
                                detail: detail.to_string(),
                                tool: String::new(),
                                event: "Demo".to_string(),
                                session_id: "demo".to_string(),
                                session_name: "Demo Mode".to_string(),
                            },
                        );
                        i += 1;
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                    }
                });
            } else {
                // Explicit session mode: watch status file directly
                spawn_status_file_watcher(initial_status_path.clone(), handle);
            }

            Ok(())
        })
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(lock) = lock_for_cleanup.lock().unwrap().as_ref() {
                    let _ = fs::remove_file(lock);
                }
                // Don't delete status file — it belongs to the session, not the pet
            }
        })
        .run(tauri::generate_context!())
        .expect("error running app");
}
