---
name: emote
description: Make the desktop pet show an emote (cheer, wave, nod, sorry, surprised, blush, puzzled, thanks), optionally with a line to say. Use it on your own at fitting moments — a task finished, a mistake, praise or thanks from the user, an unclear request — at most once or twice per turn.
user-invocable: true
---

# /emote command

Plays a short expression on the Claude Status Pet over whatever state it shows, for two to three seconds, then the pet returns to its state. It only has an effect while the pet is running; otherwise the command writes a file nobody reads, which is harmless.

## Usage

- `/emote <name> [words]` — the user asks for one directly, for example `/emote cheer 搞定了`. The first word is the emote, the rest is what the pet says.
- On your own — call it when the moment fits. Never emote on routine tool calls; one or two per turn is plenty. The pet already waves when a session starts, apologizes when a turn fails, cheers after a turn longer than five minutes, and blushes or thanks when the user's message says so, so do not repeat those.

| Emote | When |
|---|---|
| cheer | a task finished, tests passed, a build went green |
| wave | greeting at the start, saying goodbye |
| nod | understood, agreeing with the user |
| sorry | you made a mistake, something failed, you cannot do what was asked |
| surprised | an unexpected finding |
| blush | the user praised you |
| puzzled | the request is unclear and you are about to ask |
| thanks | the user helped out or thanked you |

## Implementation

Run the binary's `emote` subcommand. It finds the session from `CLAUDE_CODE_SESSION_ID` in the environment (falling back to the Claude process it runs under), returns at once and never blocks. Do not check its output or retry; if the binary is missing, say so once and move on.

**bash** (Claude Code runs the Bash tool through Git Bash on Windows too):

```bash
~/.claude/pet-data/bin/claude-status-pet emote <name> --say "<words>"
```

Leave out `--say` when there is nothing to say. Keep the words to one short sentence: the bubble shows two lines, about 120 characters. `--ms <millis>` overrides how long the emote plays.

**PowerShell**, when bash is not available:

```powershell
& "$env:USERPROFILE\.claude\pet-data\bin\claude-status-pet-windows-x64.exe" emote <name> --say "<words>"
```

To see which emotes the shown character has, with their poses and play time, one per line:

```bash
~/.claude/pet-data/bin/claude-status-pet emotes
```

A character without a picture for an emote, or for the pose it is in (standing or seated), hops instead, so any name from the table is safe to send.
