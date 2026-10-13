//! Per-session details that write-status carries from one status file version to the next:
//! a title taken from the first prompt, the git branch, and when the current turn and the
//! current state group began.
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const TITLE_MAX_CHARS: usize = 40;
const MAX_REPO_DEPTH: usize = 32;

#[derive(Debug, PartialEq)]
pub struct SessionMeta {
    pub title: Option<String>,
    pub branch: Option<String>,
    /// Unix ms of the latest user prompt
    pub turn_started: Option<u64>,
    /// Unix ms since the session entered its current state group
    pub state_since: u64,
}

/// Computes the meta for a new status from the previous status file and the current event.
/// A title set with /rename wins over the first prompt. `lookup_branch` runs only on a prompt
/// or for a session without a status file yet, since the branch rarely changes inside a turn.
pub fn next_meta(
    previous: Option<&Value>,
    prompt: Option<&str>,
    custom_title: Option<&str>,
    state: &str,
    now_ms: u64,
    lookup_branch: impl FnOnce() -> Option<String>,
) -> SessionMeta {
    let previous_str = |key: &str| {
        previous
            .and_then(|v| v[key].as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    };
    let previous_ms = |key: &str| previous.and_then(|v| v[key].as_u64());

    let custom_title = custom_title
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string);
    let title = custom_title
        .or_else(|| previous_str("title"))
        .or_else(|| prompt.and_then(session_title));
    let branch = if prompt.is_some() || previous.is_none() {
        lookup_branch()
    } else {
        previous_str("branch")
    };
    let turn_started = if prompt.is_some() {
        Some(now_ms)
    } else {
        // Status files written before this field existed get a turn start on their next event
        previous_ms("turn_started").or(Some(now_ms))
    };
    let previous_group = previous.and_then(|v| v["state"].as_str()).map(state_group);
    let state_since = if previous_group == Some(state_group(state)) {
        previous_ms("state_since").unwrap_or(now_ms)
    } else {
        now_ms
    };

    SessionMeta {
        title,
        branch,
        turn_started,
        state_since,
    }
}

/// Collapses the busy states, between which tools switch many times a second, into one group.
pub fn state_group(state: &str) -> &str {
    match state {
        "thinking" | "reading" | "editing" | "searching" | "running" | "delegating" => "working",
        other => other,
    }
}

/// A short single-line title from a prompt; None for slash commands and injected markup.
pub fn session_title(prompt: &str) -> Option<String> {
    let line = prompt.lines().map(str::trim).find(|l| !l.is_empty())?;
    if line.starts_with('/') || line.starts_with('<') {
        return None;
    }
    let collapsed = line.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= TITLE_MAX_CHARS {
        return Some(collapsed);
    }
    let kept: String = collapsed.chars().take(TITLE_MAX_CHARS - 1).collect();
    Some(format!("{}…", kept.trim_end()))
}

/// Current branch of the repository containing cwd, or a short commit hash when detached.
pub fn git_branch(cwd: &str) -> Option<String> {
    if cwd.is_empty() {
        return None;
    }
    for dir in Path::new(cwd).ancestors().take(MAX_REPO_DEPTH) {
        let dot_git = dir.join(".git");
        let git_dir = if dot_git.is_dir() {
            dot_git
        } else if dot_git.is_file() {
            // Worktrees and submodules have a .git file pointing at the real git dir
            linked_git_dir(&dot_git, dir)?
        } else {
            continue;
        };
        return branch_from_head(&fs::read_to_string(git_dir.join("HEAD")).ok()?);
    }
    None
}

fn linked_git_dir(dot_git_file: &Path, repo_dir: &Path) -> Option<PathBuf> {
    let content = fs::read_to_string(dot_git_file).ok()?;
    let target = content.trim().strip_prefix("gitdir:")?.trim();
    Some(repo_dir.join(target))
}

pub fn branch_from_head(head: &str) -> Option<String> {
    let head = head.trim();
    if let Some(reference) = head.strip_prefix("ref:") {
        let reference = reference.trim();
        let name = reference.strip_prefix("refs/heads/").unwrap_or(reference);
        return (!name.is_empty()).then(|| name.to_string());
    }
    let is_commit = head.len() >= 7 && head.chars().all(|c| c.is_ascii_hexdigit());
    is_commit.then(|| head[..7].to_string())
}
