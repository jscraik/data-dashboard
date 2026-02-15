use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// SQLite database layer
pub mod db;

/// Error recovery and retry logic
pub mod retry;

/// Performance optimizations (caching, batching)
pub mod performance;

#[cfg(test)]
mod integration_tests;

/// SECURITY: Input validation and sanitization helpers
mod security {
    use std::path::{Path, PathBuf};
    
    /// Validate session ID to prevent directory traversal
    pub fn validate_session_id(session_id: &str) -> bool {
        // Only allow alphanumeric, hyphens, and underscores
        session_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
            && !session_id.is_empty()
            && session_id.len() <= 256
    }
    
    /// Sanitize and validate file path to prevent path traversal
    pub fn sanitize_path(base_path: &Path, input_path: &str) -> Option<PathBuf> {
        let input = input_path.trim();
        
        // Reject paths with traversal components
        if input.contains("..") || input.contains("~") || input.starts_with('/') {
            return None;
        }
        
        // Reject absolute paths
        if Path::new(input).is_absolute() {
            return None;
        }
        
        let sanitized = base_path.join(input);
        
        // Verify the canonical path is within base_path (prevent traversal)
        match sanitized.canonicalize() {
            Ok(canonical) => {
                if canonical.starts_with(base_path) {
                    Some(canonical)
                } else {
                    None
                }
            }
            Err(_) => {
                // Path doesn't exist yet, check if parent is valid
                if sanitized.parent().map(|p| p.starts_with(base_path)).unwrap_or(false) {
                    Some(sanitized)
                } else {
                    None
                }
            }
        }
    }
    
    /// Validate transcript content to prevent DoS
    pub fn validate_transcript(content: &str) -> Result<&str, &'static str> {
        const MAX_SIZE: usize = 10 * 1024 * 1024; // 10MB limit
        
        if content.len() > MAX_SIZE {
            return Err("Transcript exceeds maximum size of 10MB");
        }
        
        // Check for null bytes
        if content.contains('\0') {
            return Err("Transcript contains invalid characters");
        }
        
        Ok(content)
    }
}

/// Represents a single behavior rule and its detection
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RuleCheck {
    pub rule_id: String,
    pub rule_name: String,
    pub description: String,
    pub passed: bool,
    pub confidence: f64, // 0.0 to 1.0
    pub evidence: Option<String>,
    pub suggestion: Option<String>,
}

/// Overall session score
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SessionScore {
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub total_rules: usize,
    pub passed_rules: usize,
    pub score_percentage: f64,
    pub rules: Vec<RuleCheck>,
    pub summary: String,
}

/// Behavior tracker configuration
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TrackerConfig {
    pub rules: Vec<RuleDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RuleDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub pattern: String, // Regex pattern
    pub weight: f64,
    pub category: RuleCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum RuleCategory {
    Startup,
    Response,
    Confidence,
    Safety,
    Communication,
}

/// Main behavior scorer with security considerations
pub struct BehaviorScorer {
    config: TrackerConfig,
    compiled_rules: HashMap<String, Regex>,
    base_path: PathBuf,
}

impl BehaviorScorer {
    pub fn new() -> Self {
        let config = Self::default_config();
        let compiled_rules = Self::compile_rules(&config);
        let base_path = PathBuf::from("/Users/jamiecraik/dev/data-behavior-dashboard");
        
        Self {
            config,
            compiled_rules,
            base_path,
        }
    }
    
    pub fn with_config(config: TrackerConfig) -> Self {
        let compiled_rules = Self::compile_rules(&config);
        let base_path = PathBuf::from("/Users/jamiecraik/dev/data-behavior-dashboard");
        
        Self {
            config,
            compiled_rules,
            base_path,
        }
    }
    
    /// SECURITY: Set base path for path sanitization
    pub fn with_base_path(mut self, path: PathBuf) -> Self {
        self.base_path = path;
        self
    }
    
    fn default_config() -> TrackerConfig {
        TrackerConfig {
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
        }
    }
    
    fn compile_rules(config: &TrackerConfig) -> HashMap<String, Regex> {
        let mut compiled = HashMap::new();
        for rule in &config.rules {
            // SECURITY: Validate regex before compiling
            if let Ok(regex) = Regex::new(&rule.pattern) {
                compiled.insert(rule.id.clone(), regex);
            } else {
                eprintln!("Warning: Failed to compile regex for rule {}", rule.id);
            }
        }
        compiled
    }
    
    /// SECURITY: Score a single session transcript with validation
    pub fn score_session(
        &self,
        session_id: &str,
        transcript: &str,
    ) -> Result<SessionScore, String> {
        // Validate session ID
        if !security::validate_session_id(session_id) {
            return Err("Invalid session ID".to_string());
        }
        
        // Validate transcript content
        let transcript = security::validate_transcript(transcript)
            .map_err(|e| e.to_string())?;
        
        let mut rules = Vec::new();
        let mut passed_count = 0;
        let mut total_weight = 0.0;
        let mut passed_weight = 0.0;
        
        for rule_def in &self.config.rules {
            let passed = if let Some(regex) = self.compiled_rules.get(&rule_def.id) {
                regex.is_match(transcript)
            } else {
                false
            };
            
            if passed {
                passed_count += 1;
                passed_weight += rule_def.weight;
            }
            total_weight += rule_def.weight;
            
            let evidence = if passed {
                self.extract_evidence(transcript, &rule_def.pattern)
            } else {
                None
            };
            
            rules.push(RuleCheck {
                rule_id: rule_def.id.clone(),
                rule_name: rule_def.name.clone(),
                description: rule_def.description.clone(),
                passed,
                confidence: if passed { 1.0 } else { 0.0 },
                evidence,
                suggestion: if !passed {
                    Some(format!("Consider: {}", rule_def.description))
                } else {
                    None
                },
            });
        }
        
        let score_percentage = if total_weight > 0.0 {
            (passed_weight / total_weight) * 100.0
        } else {
            0.0
        };
        
        let summary = self.generate_summary(&rules, score_percentage);
        
        Ok(SessionScore {
            session_id: session_id.to_string(),
            timestamp: Utc::now(),
            total_rules: rules.len(),
            passed_rules: passed_count,
            score_percentage,
            rules,
            summary,
        })
    }
    
    fn extract_evidence(
        &self,
        transcript: &str,
        pattern: &str,
    ) -> Option<String> {
        // Extract first matching line as evidence
        if let Ok(regex) = Regex::new(pattern) {
            if let Some(mat) = regex.find(transcript) {
                let start = transcript[..mat.start()].rfind('\n').map(|i| i + 1).unwrap_or(0);
                let end = transcript[mat.end()..].find('\n').map(|i| mat.end() + i).unwrap_or(transcript.len());
                
                // SECURITY: Limit evidence length
                let evidence = &transcript[start..end];
                Some(if evidence.len() > 200 {
                    format!("{}...", &evidence[..200])
                } else {
                    evidence.to_string()
                })
            } else {
                None
            }
        } else {
            None
        }
    }
    
    fn generate_summary(
        &self,
        rules: &[RuleCheck],
        score: f64,
    ) -> String {
        let failed_count = rules.iter().filter(|r| !r.passed).count();
        
        if score >= 90.0 {
            format!("Excellent adherence ({}%). All critical rules followed.", score as i32)
        } else if score >= 75.0 {
            format!("Good adherence ({}%). {} minor improvements possible.", score as i32, failed_count)
        } else if score >= 50.0 {
            format!("Moderate adherence ({}%). {} rules need attention.", score as i32, failed_count)
        } else {
            format!("Needs improvement ({}%). {} critical rules missed.", score as i32, failed_count)
        }
    }
    
    /// SECURITY: Scan directory for session logs with path validation
    pub fn scan_and_score_directory(
        &self,
        dir_path: &Path,
    ) -> Result<Vec<SessionScore>, String> {
        // Validate directory path is within base path
        let canonical_base = self.base_path.canonicalize()
            .map_err(|e| format!("Invalid base path: {}", e))?;
        
        let canonical_dir = dir_path.canonicalize()
            .map_err(|e| format!("Invalid directory path: {}", e))?;
        
        if !canonical_dir.starts_with(&canonical_base) {
            return Err("Directory path is outside allowed base path".to_string());
        }
        
        let mut scores = Vec::new();
        
        for entry in WalkDir::new(dir_path).max_depth(2) {
            if let Ok(entry) = entry {
                if entry.file_type().is_file() {
                    if let Some(ext) = entry.path().extension() {
                        if ext == "md" || ext == "json" {
                            // SECURITY: Validate file size before reading
                            if let Ok(metadata) = fs::metadata(entry.path()) {
                                const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB
                                if metadata.len() > MAX_FILE_SIZE {
                                    eprintln!("Skipping large file: {:?}", entry.path());
                                    continue;
                                }
                            }
                            
                            if let Ok(content) = fs::read_to_string(entry.path()) {
                                let session_id = entry.file_name().to_string_lossy().to_string();
                                match self.score_session(&session_id, &content) {
                                    Ok(score) => scores.push(score),
                                    Err(e) => eprintln!("Failed to score {}: {}", session_id, e),
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(scores)
    }
}

impl Default for BehaviorScorer {
    fn default() -> Self {
        Self::new()
    }
}
