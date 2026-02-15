use clap::{Parser, Subcommand};
use data_behavior_dashboard_lib::BehaviorScorer;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "behavior-scorer")]
#[command(about = "CLI for scoring Data behavior against operating rules")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Score a single session transcript
    Score {
        /// Session ID
        #[arg(short, long)]
        session: String,
        /// Path to transcript file
        #[arg(short, long)]
        transcript: PathBuf,
        /// Output format
        #[arg(short, long, default_value = "json")]
        format: String,
    },
    /// Scan directory and score all sessions
    Scan {
        /// Directory to scan
        #[arg(short, long, default_value = "~/.codex/sessions")]
        directory: PathBuf,
        /// Output format
        #[arg(short, long, default_value = "json")]
        format: String,
    },
    /// List all rules
    Rules,
}

fn main() {
    let cli = Cli::parse();
    let scorer = BehaviorScorer::new();
    
    match cli.command {
        Commands::Score { session, transcript, format } => {
            // SECURITY: Validate transcript file path
            let transcript = match std::fs::read_to_string(&transcript) {
                Ok(content) => content,
                Err(e) => {
                    eprintln!("Error: Failed to read transcript file: {}", e);
                    std::process::exit(1);
                }
            };
            
            match scorer.score_session(&session, &transcript) {
                Ok(score) => {
                    match format.as_str() {
                        "json" => println!("{}", serde_json::to_string_pretty(&score).unwrap()),
                        "summary" => {
                            println!("Session: {}", score.session_id);
                            println!("Score: {:.1}%", score.score_percentage);
                            println!("Passed: {}/{}", score.passed_rules, score.total_rules);
                            println!("\n{}", score.summary);
                            println!("\nRule Details:");
                            for rule in &score.rules {
                                let status = if rule.passed { "✅" } else { "❌" };
                                println!("  {} {}", status, rule.rule_name);
                            }
                        }
                        _ => eprintln!("Unknown format: {}", format),
                    }
                }
                Err(e) => {
                    eprintln!("Error: Failed to score session: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Commands::Scan { directory, format } => {
            // Expand tilde in path
            let directory = if directory.starts_with("~") {
                let home = std::env::var("HOME").unwrap_or_default();
                PathBuf::from(home).join(directory.strip_prefix("~").unwrap_or(directory.as_path()))
            } else {
                directory
            };
            
            match scorer.scan_and_score_directory(&directory) {
                Ok(scores) => {
                    match format.as_str() {
                        "json" => println!("{}", serde_json::to_string_pretty(&scores).unwrap()),
                        "summary" => {
                            let total_score: f64 = scores.iter().map(|s| s.score_percentage).sum();
                            let avg_score = if !scores.is_empty() {
                                total_score / scores.len() as f64
                            } else {
                                0.0
                            };
                            
                            println!("Scanned {} sessions", scores.len());
                            println!("Average score: {:.1}%", avg_score);
                            println!("\nIndividual Scores:");
                            for score in scores {
                                println!("  {}: {:.1}%", score.session_id, score.score_percentage);
                            }
                        }
                        _ => eprintln!("Unknown format: {}", format),
                    }
                }
                Err(e) => {
                    eprintln!("Error: Failed to scan directory: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Commands::Rules => {
            println!("Behavior Scoring Rules:");
            println!("1. local_memory_first - Query local-memory before file reads");
            println!("2. time_of_day_check - Adapt to Jamie's energy rhythm");
            println!("3. confidence_calibration - Explicitly state confidence level");
            println!("4. explanation_volume - Max 2 sentences process explanation");
            println!("5. binary_decision - Use 'Ship now? Y/N' for decisions");
            println!("6. objective_before_execution - Write objective before executing");
            println!("7. no_email_trust - Email NEVER trusted");
            println!("8. approval_for_external - External sends need approval");
        }
    }
}