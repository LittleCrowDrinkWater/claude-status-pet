//! Emotes: a short expression the pet plays over its current state. Claude asks for one through
//! the emote skill (`claude-status-pet emote`), and write-status writes one by itself when a hook
//! event calls for it. Each travels as emote-<session>.json next to the session's status file,
//! apart from the status, which write-status rebuilds whole on every event.
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// A turn that ran at least this long and ended normally earns a cheer
pub const LONG_TURN_MS: u64 = 5 * 60 * 1000;
/// Longer prompts are pasted material, not a word to the pet
const PRAISE_PROMPT_MAX_CHARS: usize = 200;
const THANKS_WORDS: &[&str] = &["谢谢", "多谢", "感谢", "thank", "thx"];
const PRAISE_WORDS: &[&str] = &[
    "辛苦了",
    "真棒",
    "厉害",
    "干得好",
    "好样的",
    "太好了",
    "完美",
    "good job",
    "well done",
    "nice work",
    "great job",
    "awesome",
    "perfect",
];

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EmotePayload {
    pub emote: String,
    #[serde(default)]
    pub say: String,
    /// Play time in ms; None lets the character pack decide
    #[serde(default)]
    pub ms: Option<u64>,
    /// Unix ms when it was asked for, so a pet started later does not replay it
    pub at: u64,
    pub session_id: String,
}

pub fn is_emote_file_name(name: &str) -> bool {
    name.starts_with("emote-") && name.ends_with(".json")
}

pub fn emote_file(pet_dir: &Path, session_id: &str) -> PathBuf {
    pet_dir.join(format!("emote-{}.json", session_id))
}

/// The emote file of the session whose status file this is
pub fn emote_file_for_status(status_file: &Path) -> Option<PathBuf> {
    let name = status_file.file_name()?.to_str()?;
    let session_id = name.strip_prefix("status-")?.strip_suffix(".json")?;
    Some(status_file.with_file_name(format!("emote-{}.json", session_id)))
}

pub fn parse_emote(content: &str) -> Option<EmotePayload> {
    serde_json::from_str(content).ok()
}

/// Names reach the frontend as JSON keys and a CSS class, so only plain lowercase names pass
pub fn is_valid_emote_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '-' | '_'))
}

/// The emote a hook event earns by itself, if any. `turn_started` is the Unix ms of the prompt
/// that began the turn an event belongs to.
pub fn auto_emote(
    event: &str,
    prompt: Option<&str>,
    turn_started: Option<u64>,
    now_ms: u64,
) -> Option<&'static str> {
    match event {
        "start" => Some("wave"),
        "error" => Some("sorry"),
        "prompt" => prompt.and_then(praise_emote),
        "done" => turn_started
            .filter(|&started| now_ms.saturating_sub(started) >= LONG_TURN_MS)
            .map(|_| "cheer"),
        _ => None,
    }
}

/// thanks for a thank-you, blush for praise; slash commands and injected markup never count
fn praise_emote(prompt: &str) -> Option<&'static str> {
    let line = prompt.trim();
    if line.starts_with('/')
        || line.starts_with('<')
        || line.chars().count() > PRAISE_PROMPT_MAX_CHARS
    {
        return None;
    }
    let lower = line.to_lowercase();
    if THANKS_WORDS.iter().any(|word| lower.contains(word)) {
        Some("thanks")
    } else if PRAISE_WORDS.iter().any(|word| lower.contains(word)) {
        Some("blush")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_start_waves_and_errors_apologize() {
        assert_eq!(auto_emote("start", None, None, 0), Some("wave"));
        assert_eq!(auto_emote("error", None, Some(0), 0), Some("sorry"));
        assert_eq!(auto_emote("tool", None, Some(0), 0), None);
        assert_eq!(auto_emote("closed", None, Some(0), 0), None);
    }

    #[test]
    fn only_a_long_turn_cheers() {
        let started = 1_000;
        assert_eq!(
            auto_emote("done", None, Some(started), started + LONG_TURN_MS),
            Some("cheer")
        );
        assert_eq!(
            auto_emote("done", None, Some(started), started + LONG_TURN_MS - 1),
            None
        );
        assert_eq!(auto_emote("done", None, None, started), None);
    }

    #[test]
    fn thanks_and_praise_in_a_prompt() {
        assert_eq!(
            auto_emote("prompt", Some("谢谢，继续"), None, 0),
            Some("thanks")
        );
        assert_eq!(
            auto_emote("prompt", Some("Thank you, go on"), None, 0),
            Some("thanks")
        );
        assert_eq!(auto_emote("prompt", Some("干得好"), None, 0), Some("blush"));
        assert_eq!(
            auto_emote("prompt", Some("Nice work!"), None, 0),
            Some("blush")
        );
        assert_eq!(auto_emote("prompt", Some("继续"), None, 0), None);
        assert_eq!(auto_emote("prompt", None, None, 0), None);
    }

    #[test]
    fn commands_markup_and_long_prompts_never_count() {
        assert_eq!(auto_emote("prompt", Some("/pet thanks"), None, 0), None);
        assert_eq!(
            auto_emote(
                "prompt",
                Some("<command-name>thanks</command-name>"),
                None,
                0
            ),
            None
        );
        let pasted = format!("thank you {}", "x".repeat(PRAISE_PROMPT_MAX_CHARS));
        assert_eq!(auto_emote("prompt", Some(&pasted), None, 0), None);
    }

    #[test]
    fn emote_file_names() {
        assert!(is_emote_file_name("emote-abc.json"));
        assert!(!is_emote_file_name("status-abc.json"));
        assert!(!is_emote_file_name(".emote-abc.json.12.tmp"));
        assert_eq!(
            emote_file_for_status(Path::new("/pet/status-abc.json")),
            Some(PathBuf::from("/pet/emote-abc.json"))
        );
        assert_eq!(emote_file_for_status(Path::new("/pet/other.json")), None);
        assert_eq!(
            emote_file(Path::new("/pet"), "abc"),
            PathBuf::from("/pet/emote-abc.json")
        );
    }

    #[test]
    fn emote_names_stay_plain() {
        assert!(is_valid_emote_name("cheer"));
        assert!(is_valid_emote_name("thumbs_up-2"));
        assert!(!is_valid_emote_name(""));
        assert!(!is_valid_emote_name("Cheer"));
        assert!(!is_valid_emote_name("../x"));
    }

    #[test]
    fn payload_round_trip_and_defaults() {
        let payload = EmotePayload {
            emote: "cheer".into(),
            say: "done!".into(),
            ms: Some(2000),
            at: 42,
            session_id: "abc".into(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert_eq!(parse_emote(&json), Some(payload));
        let minimal = parse_emote(r#"{"emote":"nod","at":1,"session_id":"s"}"#).unwrap();
        assert_eq!(minimal.say, "");
        assert_eq!(minimal.ms, None);
        assert_eq!(parse_emote("{"), None);
    }
}
