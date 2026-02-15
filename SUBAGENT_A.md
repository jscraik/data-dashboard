# Sub-Agent A: SQLite Schema + Migrations

## Objective
Build SQLite database layer for time-series behavior scoring with proper migrations.

## Constraints
- Use Tauri SQL plugin v2
- Schema: sessions, scores, rule_checks tables
- Migrations: up/down with version tracking
- Type-safe queries

## Success Criteria
- Database initializes on app start
- Migrations run automatically
- Can store/retrieve session scores
- Tests pass

## Files to Create/Modify
- src-tauri/src/db.rs (database module)
- src-tauri/src/migrations/ (migration files)
- src-tauri/src/lib.rs (integrate db)

Report completion with verification commands.
