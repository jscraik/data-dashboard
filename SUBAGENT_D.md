# Sub-Agent D: Background Session Watcher

## Objective
Build filesystem watcher that auto-scores new session logs from ~/.codex/sessions/.

## Constraints
- Watch ~/.codex/sessions/ recursively
- Auto-score new .md files
- Debounced (don't score while writing)
- Background process in Tauri

## Success Criteria
- Detects new session files
- Auto-runs scoring
- Stores results in SQLite
- No manual trigger needed

## Files to Create/Modify
- src-tauri/src/watcher.rs
- src-tauri/src/lib.rs (integrate)
- Tauri command for watcher control

Report completion with test scenario.
