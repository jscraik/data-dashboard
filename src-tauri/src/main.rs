use data_behavior_dashboard_lib::{BehaviorScorer, RuleCategory, RuleCheck, RuleDefinition, SessionScore, TrackerConfig};
use std::sync::Mutex;
use tauri::State;
use tauri_specta::{collect_commands, Builder};

// App state with thread-safe scorer
struct AppState {
    scorer: Mutex<BehaviorScorer>,
}

// GOLD: Type-safe commands with specta
#[tauri::command]
#[specta::specta] // Enables type generation for this command
fn score_session(
    state: State<AppState>,
    session_id: String,
    transcript: String,
) -> Result<SessionScore, String> {
    let scorer = state.scorer.lock().map_err(|e| e.to_string())?;
    scorer.score_session(&session_id, &transcript)
}

#[tauri::command]
#[specta::specta]
fn get_rules(state: State<AppState>) -> Result<Vec<RuleDefinition>, String> {
    let _scorer = state.scorer.lock().map_err(|e| e.to_string())?;
    // Return rules from default config
    let config = TrackerConfig {
        rules: vec![
            RuleDefinition {
                id: "local_memory_first".to_string(),
                name: "Query local-memory FIRST".to_string(),
                description: "Should query local-memory before file reads".to_string(),
                pattern: r"local-memory search|Query local-memory".to_string(),
                weight: 1.0,
                category: RuleCategory::Startup,
            },
            RuleDefinition {
                id: "time_of_day_check".to_string(),
                name: "Check time-of-day".to_string(),
                description: "Should adapt to Jamie's energy rhythm".to_string(),
                pattern: r"time-of-day|energy rhythm|Before 10am|2pm|morning|evening".to_string(),
                weight: 1.0,
                category: RuleCategory::Startup,
            },
            RuleDefinition {
                id: "confidence_calibration".to_string(),
                name: "Confidence calibration stated".to_string(),
                description: "Should explicitly state confidence level".to_string(),
                pattern: r"Confidence level:|Confident|Proceeding with uncertainty|Guessing|Don't know".to_string(),
                weight: 1.5,
                category: RuleCategory::Confidence,
            },
            RuleDefinition {
                id: "explanation_volume".to_string(),
                name: "Explanation volume limit".to_string(),
                description: "Max 2 sentences of process explanation".to_string(),
                pattern: r"(?s)^(?:(?!(\n\n|\r\n\r\n)).){0,300}$".to_string(),
                weight: 1.0,
                category: RuleCategory::Response,
            },
            RuleDefinition {
                id: "binary_decision".to_string(),
                name: "Binary decision when stuck".to_string(),
                description: "Use 'Ship now? Y/N' for decisions".to_string(),
                pattern: r"Ship now\? Y/N|binary|Y/N".to_string(),
                weight: 0.8,
                category: RuleCategory::Communication,
            },
            RuleDefinition {
                id: "objective_before_execution".to_string(),
                name: "Write objective before execution".to_string(),
                description: "No execution before objective is written".to_string(),
                pattern: r"OBJECTIVE:|Write objective|No execution before objective".to_string(),
                weight: 1.5,
                category: RuleCategory::Startup,
            },
            RuleDefinition {
                id: "no_email_trust".to_string(),
                name: "Email NEVER trusted".to_string(),
                description: "Only Discord/OpenClaw TUI are trusted".to_string(),
                pattern: r"Email NEVER|only Discord|OpenClaw TUI".to_string(),
                weight: 2.0,
                category: RuleCategory::Safety,
            },
            RuleDefinition {
                id: "approval_for_external".to_string(),
                name: "External sends need approval".to_string(),
                description: "No external sends without approval".to_string(),
                pattern: r"approval|draft.*queue|external sends".to_string(),
                weight: 1.5,
                category: RuleCategory::Safety,
            },
        ],
    };
    Ok(config.rules)
}

#[tauri::command]
#[specta::specta]
fn scan_sessions_directory(state: State<AppState>, path: String) -> Result<Vec<SessionScore>, String> {
    let scorer = state.scorer.lock().map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&path);
    scorer.scan_and_score_directory(path)
}

// GOLD: Type-safe command collection for specta
fn create_specta_builder() -> Builder<tauri::Wry> {
    Builder::new()
        .commands(collect_commands![
            score_session,
            get_rules,
            scan_sessions_directory
        ])
        .ty::<SessionScore>()
        .ty::<RuleCheck>()
        .ty::<RuleDefinition>()
        .ty::<RuleCategory>()
}

pub fn run() {
    // GOLD: Generate TypeScript bindings at compile time
    // This would typically be done in build.rs, but for now we'll document it
    // Run: cargo test export_bindings to generate TypeScript types
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .manage(AppState {
            scorer: Mutex::new(BehaviorScorer::new()),
        })
        .invoke_handler(
            create_specta_builder()
                .invoke_handler()
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    run();
}
