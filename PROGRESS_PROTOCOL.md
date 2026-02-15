# Sub-Agent Progress Tracking

## Protocol
Each sub-agent must write progress to `PROGRESS.md`:

```markdown
## Agent: [name]
- Started: [timestamp]
- Current Task: [description]
- Status: [in-progress|blocked|complete]
- Last Update: [timestamp]
- Next Checkpoint: [timestamp]
```

## Example
## Agent: UI Critique
- Started: 2026-02-15T15:44:00Z
- Current Task: Reviewing Dashboard.tsx
- Status: in-progress
- Last Update: 2026-02-15T15:46:00Z
- Next Checkpoint: 2026-02-15T15:49:00Z
```

## Orchestrator Checklist
- [ ] Spawn agent with progress file instruction
- [ ] Poll PROGRESS.md every 60 seconds
- [ ] If no update in 3 minutes → flag as stalled
- [ ] If no update in 5 minutes → kill and respawn
- [ ] On completion, archive PROGRESS.md to logs/
