//! Short bubble texts from what the agent said: the sentence it wrote right before a tool call,
//! read back from the session transcript, and the opening sentence of its final reply.
use serde_json::Value;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

const SENTENCE_MAX_CHARS: usize = 120;
const TAIL_CHUNK_BYTES: u64 = 64 * 1024;
// Transcripts reach tens of MB; write-status must stay under 100ms, so only the tail is read
const TAIL_MAX_BYTES: u64 = 256 * 1024;

/// The first prose sentence of a markdown text as plain text; None when it has no prose.
pub fn first_sentence(text: &str) -> Option<String> {
    first_prose_line(text).map(|line| cap_chars(cut_at_sentence_end(&line)))
}

/// The first prose line of a markdown text as plain text, for short notes that read best whole.
pub fn first_paragraph(text: &str) -> Option<String> {
    first_prose_line(text).map(|line| cap_chars(&line))
}

fn first_prose_line(text: &str) -> Option<String> {
    let mut in_code_block = false;
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block || is_layout_line(line) {
            continue;
        }
        let plain = strip_inline_markdown(strip_line_prefix(line));
        let collapsed = plain.split_whitespace().collect::<Vec<_>>().join(" ");
        if !collapsed.is_empty() {
            return Some(collapsed);
        }
    }
    None
}

fn is_layout_line(line: &str) -> bool {
    line.is_empty()
        || line.starts_with('#')
        || line.starts_with('|')
        || line.chars().all(|c| matches!(c, '-' | '*' | '_' | ' '))
}

fn strip_line_prefix(line: &str) -> &str {
    let line = line.trim_start_matches('>').trim_start();
    for marker in ["- ", "* ", "+ "] {
        if let Some(rest) = line.strip_prefix(marker) {
            return rest;
        }
    }
    let digits = line.chars().take_while(char::is_ascii_digit).count();
    if digits > 0 {
        let rest = &line[digits..];
        if let Some(rest) = rest.strip_prefix(". ").or_else(|| rest.strip_prefix(") ")) {
            return rest;
        }
    }
    line
}

/// Drops emphasis and code marks, and keeps only the text of [text](url) links.
fn strip_inline_markdown(line: &str) -> String {
    let without_marks = line.replace("**", "").replace("__", "").replace('`', "");
    let mut out = String::with_capacity(without_marks.len());
    let mut rest = without_marks.as_str();
    while let Some(open) = rest.find('[') {
        let Some(close) = rest[open..].find("](").map(|i| open + i) else {
            break;
        };
        let Some(end) = rest[close..].find(')').map(|i| close + i) else {
            break;
        };
        out.push_str(rest[..open].trim_end_matches('!'));
        out.push_str(&rest[open + 1..close]);
        rest = &rest[end + 1..];
    }
    out.push_str(rest);
    out
}

/// A period only ends a sentence before a space, so file names like app.js stay whole.
fn cut_at_sentence_end(text: &str) -> &str {
    let mut chars = text.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        let end = i + c.len_utf8();
        match c {
            '。' | '！' | '？' => return &text[..end],
            '.' | '!' | '?' if chars.peek().is_none_or(|(_, next)| *next == ' ') => {
                return &text[..end];
            }
            _ => {}
        }
    }
    text
}

fn cap_chars(text: &str) -> String {
    if text.chars().count() <= SENTENCE_MAX_CHARS {
        return text.to_string();
    }
    let kept: String = text.chars().take(SENTENCE_MAX_CHARS - 1).collect();
    format!("{}…", kept.trim_end())
}

/// What the agent wrote just before the given tool call, if it wrote anything.
/// The transcript is written asynchronously, so a missing entry means no bubble, never a wait.
pub fn thought_before_tool(transcript: &Path, tool_use_id: &str) -> Option<String> {
    if tool_use_id.is_empty() {
        return None;
    }
    let needle = format!("\"id\":\"{}\"", tool_use_id);
    let mut file = File::open(transcript).ok()?;
    let len = file.metadata().ok()?.len();
    let mut window = TAIL_CHUNK_BYTES;
    loop {
        let start = len.saturating_sub(window);
        file.seek(SeekFrom::Start(start)).ok()?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).ok()?;
        let text = String::from_utf8_lossy(&bytes);
        // The window usually starts in the middle of a line
        let lines: Vec<&str> = text.lines().skip(usize::from(start > 0)).collect();
        if let Some(found) = lines.iter().rposition(|l| l.contains(&needle)) {
            return text_of_message(&lines[..=found]);
        }
        if start == 0 || window >= TAIL_MAX_BYTES {
            return None;
        }
        window *= 2;
    }
}

/// Text blocks are stored as their own lines before the tool_use line of the same message,
/// so walk back from the tool call until the previous user record (a prompt or tool result).
fn text_of_message(lines: &[&str]) -> Option<String> {
    let tool_record: Value = serde_json::from_str(lines.last()?).ok()?;
    let message_id = tool_record["message"]["id"].as_str()?;
    for line in lines.iter().rev() {
        if !line.contains(message_id) && !line.contains("\"type\":\"user\"") {
            continue;
        }
        let Ok(record) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if record["type"].as_str() == Some("user") {
            return None;
        }
        if record["message"]["id"].as_str() != Some(message_id) {
            continue;
        }
        let Some(blocks) = record["message"]["content"].as_array() else {
            continue;
        };
        let said = blocks
            .iter()
            .filter(|b| b["type"].as_str() == Some("text"))
            .filter_map(|b| b["text"].as_str())
            .find_map(first_paragraph);
        if said.is_some() {
            return said;
        }
    }
    None
}
