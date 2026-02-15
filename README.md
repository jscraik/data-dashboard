# Data Behavior Dashboard

A Tauri desktop application for tracking Data's adherence to operating rules.

## Tech Stack

- **Frontend:** React 19, Tailwind CSS v4, Vite, TypeScript
- **Backend:** Rust, Tauri v2
- **CLI:** Rust binary for headless scoring
- **Design Tokens:** Integrated with `/dev/design-system`

## Features

- **Real-time Behavior Scoring:** Analyzes session transcripts against 8 core rules
- **Trend Visualization:** Charts showing score improvement over time
- **Rule Performance:** Per-rule pass/fail rates
- **CLI Scoring:** `behavior-scorer` binary for batch processing

## Rules Tracked

1. **local_memory_first** — Query local-memory before file reads
2. **time_of_day_check** — Adapt to Jamie's energy rhythm
3. **confidence_calibration** — Explicitly state confidence level
4. **explanation_volume** — Max 2 sentences process explanation
5. **binary_decision** — Use 'Ship now? Y/N' for decisions
6. **objective_before_execution** — Write objective before executing
7. **no_email_trust** — Email NEVER trusted
8. **approval_for_external** — External sends need approval

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm tauri:dev

# Build CLI
pnpm cli:score

# Score a session
./src-tauri/target/debug/behavior-scorer score \
  --session "2026-02-15-session" \
  --transcript session.md \
  --format summary
```

## Project Structure

```
data-behavior-dashboard/
├── src/                      # React frontend
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── RuleList.tsx
│   │   ├── SessionScorer.tsx
│   │   └── ui/
│   ├── styles/
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs           # Scoring logic
│   │   ├── main.rs          # Tauri app
│   │   └── bin/
│   │       └── behavior-scorer.rs  # CLI
│   └── Cargo.toml
└── package.json
```