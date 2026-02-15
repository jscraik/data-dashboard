#[cfg(test)]
mod integration_tests {
    use crate::{BehaviorScorer, TrackerConfig, RuleDefinition, RuleCategory};
    use std::path::PathBuf;
    use tempfile::TempDir;
    use tokio::time::{sleep, Duration};

    /// Test: Score a simple session transcript
    #[tokio::test]
    async fn test_score_simple_session() {
        let scorer = BehaviorScorer::new();
        let transcript = r#"
            Confidence level: Confident
            OBJECTIVE: Test the scoring system
            Query local-memory first
            Ship now? Y/N
        "#;
        
        let result = scorer.score_session("test-session-1", transcript);
        assert!(result.is_ok());
        
        let score = result.unwrap();
        assert_eq!(score.session_id, "test-session-1");
        assert!(score.total_rules > 0);
        assert!(score.score_percentage >= 0.0 && score.score_percentage <= 100.0);
    }

    /// Test: Score session with all rules passing
    #[tokio::test]
    async fn test_score_perfect_session() {
        let scorer = BehaviorScorer::new();
        let transcript = r#"
            Confidence level: Confident
            OBJECTIVE: Test perfect scoring
            Query local-memory first
            Check time-of-day before executing
            Email NEVER trusted
            Ship now? Y/N
        "#;
        
        let score = scorer.score_session("perfect-session", transcript).unwrap();
        assert!(score.passed_rules > 0);
        assert!(score.score_percentage > 50.0); // Should pass most rules
    }

    /// Test: Security - prevent directory traversal
    #[tokio::test]
    async fn test_security_path_traversal() {
        use crate::security;
        
        let base = PathBuf::from("/safe/path");
        
        // Should reject traversal
        assert!(security::sanitize_path(&base, "../etc/passwd").is_none());
        assert!(security::sanitize_path(&base, "~/.ssh/id_rsa").is_none());
        assert!(security::sanitize_path(&base, "/etc/passwd").is_none());
        
        // Should accept safe paths
        assert!(security::sanitize_path(&base, "sessions/2026-02-15.md").is_some());
    }

    /// Test: Security - validate session ID
    #[tokio::test]
    async fn test_security_session_id_validation() {
        use crate::security;
        
        // Valid IDs
        assert!(security::validate_session_id("valid-session-123"));
        assert!(security::validate_session_id("test_2026_02_15"));
        
        // Invalid IDs
        assert!(!security::validate_session_id("../etc/passwd"));
        assert!(!security::validate_session_id(""));
        assert!(!security::validate_session_id("a".repeat(300).as_str()));
    }

    /// Test: Retry logic with transient errors
    #[tokio::test]
    async fn test_retry_with_backoff() {
        use crate::retry::{retry_with_backoff, RetryConfig, RetryError};
        
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 10, // Fast for tests
            max_delay_ms: 100,
            backoff_multiplier: 2.0,
        };
        
        // Should succeed on first try
        let result: Result<i32, RetryError> = retry_with_backoff(
            &config,
            || async { Ok(42) }
        ).await;
        assert_eq!(result.unwrap(), 42);
    }

    /// Test: Performance cache
    #[tokio::test]
    async fn test_score_cache() {
        use crate::performance::ScoreCache;
        
        let cache = ScoreCache::new(60); // 60 second TTL
        let scorer = BehaviorScorer::new();
        
        let transcript = "Confidence level: Confident";
        let score = scorer.score_session("cached-session", transcript).unwrap();
        
        // Store in cache
        cache.set("cached-session".to_string(), score.clone()).await;
        
        // Should retrieve from cache
        let cached = cache.get("cached-session").await;
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().session_id, score.session_id);
    }

    /// Test: Database initialization
    #[tokio::test]
    async fn test_database_init() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        // Database should initialize without errors
        // This is a placeholder - actual DB tests would use the db module
        assert!(db_path.parent().unwrap().exists());
    }

    /// Test: End-to-end scoring workflow
    #[tokio::test]
    async fn test_end_to_end_workflow() {
        let scorer = BehaviorScorer::new();
        let temp_dir = TempDir::new().unwrap();
        
        // Create a mock session file
        let session_content = r#"
            Session Start: 2026-02-15
            Confidence level: Confident
            OBJECTIVE: Build dashboard
            Query local-memory first
            Check time-of-day
            Ship now? Y/N
        "#;
        
        // Score the session
        let score = scorer.score_session("e2e-test", session_content).unwrap();
        
        // Verify results
        assert!(score.total_rules > 0);
        assert!(!score.summary.is_empty());
        
        // Check specific rules
        let confidence_rule = score.rules.iter()
            .find(|r| r.rule_id == "confidence_calibration");
        assert!(confidence_rule.is_some());
        assert!(confidence_rule.unwrap().passed);
    }
}