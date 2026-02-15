//! SQLite Database Layer for Data Behavior Dashboard
//!
//! Provides persistent storage for:
//! - Sessions: AI agent session metadata
//! - Scores: Overall session behavior scores
//! - Rule Checks: Individual rule pass/fail results

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use thiserror::Error;

// Re-export sqlx types for consumers
pub use sqlx::sqlite::SqlitePool;
pub use sqlx::{Pool, Sqlite};

/// Database errors with context
#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database connection failed: {0}")]
    Connection(String),
    #[error("Migration failed: {0}")]
    Migration(String),
    #[error("Query failed: {0}")]
    Query(String),
    #[error("Invalid data: {0}")]
    Validation(String),
    #[error("Not found: {0}")]
    NotFound(String),
}

impl From<sqlx::Error> for DbError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => DbError::NotFound("Record not found".to_string()),
            sqlx::Error::Migrate(m) => DbError::Migration(m.to_string()),
            _ => DbError::Query(err.to_string()),
        }
    }
}

/// Database manager with connection pool
#[derive(Debug, Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

/// Session record - represents an AI agent session
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Session {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub source: String,
    pub transcript_path: Option<String>,
    pub metadata: Option<String>,
}

/// Score record - overall behavior score for a session
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Score {
    pub id: i64,
    pub session_id: String,
    pub scored_at: DateTime<Utc>,
    pub total_rules: i32,
    pub passed_rules: i32,
    pub score_percentage: f64,
    pub summary: String,
}

/// Rule check record - individual rule evaluation result
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RuleCheckRecord {
    pub id: i64,
    pub score_id: i64,
    pub rule_id: String,
    pub rule_name: String,
    pub description: String,
    pub passed: bool,
    pub confidence: f64,
    pub evidence: Option<String>,
    pub suggestion: Option<String>,
}

/// Migration record tracking
#[derive(Debug, Clone)]
struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

/// Database migrations - ordered by version
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create_sessions_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                source TEXT NOT NULL DEFAULT 'unknown',
                transcript_path TEXT,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_created_at
                ON sessions(created_at);

            CREATE INDEX IF NOT EXISTS idx_sessions_source
                ON sessions(source);
        "#,
    },
    Migration {
        version: 2,
        name: "create_scores_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                scored_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                total_rules INTEGER NOT NULL DEFAULT 0,
                passed_rules INTEGER NOT NULL DEFAULT 0,
                score_percentage REAL NOT NULL DEFAULT 0.0,
                summary TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_scores_session_id
                ON scores(session_id);

            CREATE INDEX IF NOT EXISTS idx_scores_scored_at
                ON scores(scored_at);

            CREATE INDEX IF NOT EXISTS idx_scores_percentage
                ON scores(score_percentage);
        "#,
    },
    Migration {
        version: 3,
        name: "create_rule_checks_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS rule_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                score_id INTEGER NOT NULL,
                rule_id TEXT NOT NULL,
                rule_name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                passed BOOLEAN NOT NULL DEFAULT 0,
                confidence REAL NOT NULL DEFAULT 0.0,
                evidence TEXT,
                suggestion TEXT,
                FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_rule_checks_score_id
                ON rule_checks(score_id);

            CREATE INDEX IF NOT EXISTS idx_rule_checks_rule_id
                ON rule_checks(rule_id);

            CREATE INDEX IF NOT EXISTS idx_rule_checks_passed
                ON rule_checks(passed);
        "#,
    },
    Migration {
        version: 4,
        name: "create_migrations_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS _migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        "#,
    },
];

impl Database {
    /// Initialize database connection and run migrations
    pub async fn new(db_path: impl AsRef<Path>) -> Result<Self, DbError> {
        let db_path = db_path.as_ref();

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| DbError::Connection(format!("Failed to create db directory: {e}")))?;
        }

        let db_url = format!("sqlite:{}", db_path.display());

        let pool = Pool::<Sqlite>::connect(&db_url)
            .await
            .map_err(|e| DbError::Connection(e.to_string()))?;

        let db = Self { pool };
        db.run_migrations().await?;

        Ok(db)
    }

    /// Create in-memory database for testing
    pub async fn new_in_memory() -> Result<Self, DbError> {
        let pool = Pool::<Sqlite>::connect(":memory:")
            .await
            .map_err(|e| DbError::Connection(e.to_string()))?;

        let db = Self { pool };
        db.run_migrations().await?;

        Ok(db)
    }

    /// Run pending migrations
    async fn run_migrations(&self) -> Result<(), DbError> {
        // Create migrations table if it doesn't exist
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS _migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Get current version
        let current_version: Option<i64> =
            sqlx::query_scalar("SELECT MAX(version) FROM _migrations")
                .fetch_optional(&self.pool)
                .await?;

        let current_version = current_version.flatten().unwrap_or(0);

        // Apply pending migrations
        for migration in MIGRATIONS {
            if migration.version > current_version {
                let mut tx = self.pool.begin().await?;

                // Execute migration SQL
                sqlx::query(migration.sql).execute(&mut *tx).await?;

                // Record migration
                sqlx::query(
                    "INSERT INTO _migrations (version, name) VALUES (?1, ?2)",
                )
                .bind(migration.version)
                .bind(migration.name)
                .execute(&mut *tx)
                .await?;

                tx.commit().await?;
            }
        }

        Ok(())
    }

    /// Get current migration version
    pub async fn migration_version(&self) -> Result<i64, DbError> {
        let version: Option<i64> = sqlx::query_scalar("SELECT MAX(version) FROM _migrations")
            .fetch_optional(&self.pool)
            .await?;

        Ok(version.flatten().unwrap_or(0))
    }

    // =========================================================================
    // Session Operations
    // =========================================================================

    /// Create a new session
    pub async fn create_session(
        &self,
        id: &str,
        source: &str,
        transcript_path: Option<&str>,
        metadata: Option<&str>,
    ) -> Result<Session, DbError> {
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO sessions (id, created_at, updated_at, source, transcript_path, metadata)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
        )
        .bind(id)
        .bind(now)
        .bind(now)
        .bind(source)
        .bind(transcript_path)
        .bind(metadata)
        .execute(&self.pool)
        .await?;

        Ok(Session {
            id: id.to_string(),
            created_at: now,
            updated_at: now,
            source: source.to_string(),
            transcript_path: transcript_path.map(|s| s.to_string()),
            metadata: metadata.map(|s| s.to_string()),
        })
    }

    /// Get session by ID
    pub async fn get_session(&self, id: &str) -> Result<Session, DbError> {
        let row = sqlx::query_as::<_, SessionRow>(
            r#"
            SELECT id, created_at, updated_at, source, transcript_path, metadata
            FROM sessions WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.into())
    }

    /// List all sessions with optional limit
    pub async fn list_sessions(&self, limit: Option<i64>) -> Result<Vec<Session>, DbError> {
        let limit = limit.unwrap_or(100);

        let rows = sqlx::query_as::<_, SessionRow>(
            r#"
            SELECT id, created_at, updated_at, source, transcript_path, metadata
            FROM sessions
            ORDER BY created_at DESC
            LIMIT ?1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Update session metadata
    pub async fn update_session(
        &self,
        id: &str,
        transcript_path: Option<&str>,
        metadata: Option<&str>,
    ) -> Result<Session, DbError> {
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE sessions
            SET updated_at = ?1, transcript_path = COALESCE(?2, transcript_path), metadata = COALESCE(?3, metadata)
            WHERE id = ?4
            "#,
        )
        .bind(now)
        .bind(transcript_path)
        .bind(metadata)
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_session(id).await
    }

    /// Delete session (cascades to scores and rule_checks)
    pub async fn delete_session(&self, id: &str) -> Result<bool, DbError> {
        let result = sqlx::query("DELETE FROM sessions WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    // =========================================================================
    // Score Operations
    // =========================================================================

    /// Create a new score record
    pub async fn create_score(
        &self,
        session_id: &str,
        total_rules: i32,
        passed_rules: i32,
        score_percentage: f64,
        summary: &str,
    ) -> Result<Score, DbError> {
        let scored_at = Utc::now();

        let id = sqlx::query(
            r#"
            INSERT INTO scores (session_id, scored_at, total_rules, passed_rules, score_percentage, summary)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
        )
        .bind(session_id)
        .bind(scored_at)
        .bind(total_rules)
        .bind(passed_rules)
        .bind(score_percentage)
        .bind(summary)
        .execute(&self.pool)
        .await?
        .last_insert_rowid();

        Ok(Score {
            id,
            session_id: session_id.to_string(),
            scored_at,
            total_rules,
            passed_rules,
            score_percentage,
            summary: summary.to_string(),
        })
    }

    /// Get score by ID
    pub async fn get_score(&self, id: i64) -> Result<Score, DbError> {
        let row = sqlx::query_as::<_, ScoreRow>(
            r#"
            SELECT id, session_id, scored_at, total_rules, passed_rules, score_percentage, summary
            FROM scores WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.into())
    }

    /// Get scores for a session
    pub async fn get_session_scores(&self, session_id: &str) -> Result<Vec<Score>, DbError> {
        let rows = sqlx::query_as::<_, ScoreRow>(
            r#"
            SELECT id, session_id, scored_at, total_rules, passed_rules, score_percentage, summary
            FROM scores WHERE session_id = ?1
            ORDER BY scored_at DESC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Get latest score for a session
    pub async fn get_latest_score(&self, session_id: &str) -> Result<Score, DbError> {
        let row = sqlx::query_as::<_, ScoreRow>(
            r#"
            SELECT id, session_id, scored_at, total_rules, passed_rules, score_percentage, summary
            FROM scores WHERE session_id = ?1
            ORDER BY scored_at DESC
            LIMIT 1
            "#,
        )
        .bind(session_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.into())
    }

    /// List all scores with optional limit
    pub async fn list_scores(&self, limit: Option<i64>) -> Result<Vec<Score>, DbError> {
        let limit = limit.unwrap_or(100);

        let rows = sqlx::query_as::<_, ScoreRow>(
            r#"
            SELECT id, session_id, scored_at, total_rules, passed_rules, score_percentage, summary
            FROM scores
            ORDER BY scored_at DESC
            LIMIT ?1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Delete score (cascades to rule_checks)
    pub async fn delete_score(&self, id: i64) -> Result<bool, DbError> {
        let result = sqlx::query("DELETE FROM scores WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    // =========================================================================
    // Rule Check Operations
    // =========================================================================

    /// Create a new rule check record
    pub async fn create_rule_check(
        &self,
        score_id: i64,
        rule_id: &str,
        rule_name: &str,
        description: &str,
        passed: bool,
        confidence: f64,
        evidence: Option<&str>,
        suggestion: Option<&str>,
    ) -> Result<RuleCheckRecord, DbError> {
        let id = sqlx::query(
            r#"
            INSERT INTO rule_checks (score_id, rule_id, rule_name, description, passed, confidence, evidence, suggestion)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
        )
        .bind(score_id)
        .bind(rule_id)
        .bind(rule_name)
        .bind(description)
        .bind(passed)
        .bind(confidence)
        .bind(evidence)
        .bind(suggestion)
        .execute(&self.pool)
        .await?
        .last_insert_rowid();

        Ok(RuleCheckRecord {
            id,
            score_id,
            rule_id: rule_id.to_string(),
            rule_name: rule_name.to_string(),
            description: description.to_string(),
            passed,
            confidence,
            evidence: evidence.map(|s| s.to_string()),
            suggestion: suggestion.map(|s| s.to_string()),
        })
    }

    /// Get rule check by ID
    pub async fn get_rule_check(&self, id: i64) -> Result<RuleCheckRecord, DbError> {
        let row = sqlx::query_as::<_, RuleCheckRow>(
            r#"
            SELECT id, score_id, rule_id, rule_name, description, passed, confidence, evidence, suggestion
            FROM rule_checks WHERE id = ?1
            "#,
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.into())
    }

    /// Get rule checks for a score
    pub async fn get_score_rule_checks(&self, score_id: i64) -> Result<Vec<RuleCheckRecord>, DbError> {
        let rows = sqlx::query_as::<_, RuleCheckRow>(
            r#"
            SELECT id, score_id, rule_id, rule_name, description, passed, confidence, evidence, suggestion
            FROM rule_checks WHERE score_id = ?1
            ORDER BY rule_id
            "#,
        )
        .bind(score_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Get rule checks for a specific rule across all scores
    pub async fn get_rule_history(&self, rule_id: &str, limit: Option<i64>) -> Result<Vec<RuleCheckRecord>, DbError> {
        let limit = limit.unwrap_or(100);

        let rows = sqlx::query_as::<_, RuleCheckRow>(
            r#"
            SELECT rc.id, rc.score_id, rc.rule_id, rc.rule_name, rc.description, rc.passed, rc.confidence, rc.evidence, rc.suggestion
            FROM rule_checks rc
            JOIN scores s ON rc.score_id = s.id
            WHERE rc.rule_id = ?1
            ORDER BY s.scored_at DESC
            LIMIT ?2
            "#,
        )
        .bind(rule_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Get pass rate for a specific rule
    pub async fn get_rule_pass_rate(&self, rule_id: &str) -> Result<f64, DbError> {
        let result: Option<(i64, i64)> = sqlx::query_as(
            r#"
            SELECT COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed
            FROM rule_checks
            WHERE rule_id = ?1
            "#,
        )
        .bind(rule_id)
        .fetch_optional(&self.pool)
        .await?;

        match result {
            Some((total, passed)) if total > 0 => Ok((passed as f64 / total as f64) * 100.0),
            _ => Ok(0.0),
        }
    }

    /// Delete rule check
    pub async fn delete_rule_check(&self, id: i64) -> Result<bool, DbError> {
        let result = sqlx::query("DELETE FROM rule_checks WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    // =========================================================================
    // Analytics Operations
    // =========================================================================

    /// Get average score across all sessions
    pub async fn get_average_score(&self) -> Result<f64, DbError> {
        let avg: Option<f64> = sqlx::query_scalar("SELECT AVG(score_percentage) FROM scores")
            .fetch_optional(&self.pool)
            .await?;

        Ok(avg.unwrap_or(0.0))
    }

    /// Get score distribution
    pub async fn get_score_distribution(&self) -> Result<ScoreDistribution, DbError> {
        let excellent: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM scores WHERE score_percentage >= 90"
        )
        .fetch_one(&self.pool)
        .await?;

        let good: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM scores WHERE score_percentage >= 75 AND score_percentage < 90"
        )
        .fetch_one(&self.pool)
        .await?;

        let moderate: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM scores WHERE score_percentage >= 50 AND score_percentage < 75"
        )
        .fetch_one(&self.pool)
        .await?;

        let poor: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM scores WHERE score_percentage < 50"
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(ScoreDistribution {
            excellent,
            good,
            moderate,
            poor,
        })
    }

    /// Get database statistics
    pub async fn get_stats(&self) -> Result<DbStats, DbError> {
        let sessions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sessions")
            .fetch_one(&self.pool)
            .await?;

        let scores: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM scores")
            .fetch_one(&self.pool)
            .await?;

        let rule_checks: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rule_checks")
            .fetch_one(&self.pool)
            .await?;

        let avg_score: f64 = self.get_average_score().await?;

        Ok(DbStats {
            sessions,
            scores,
            rule_checks,
            avg_score,
        })
    }
}

/// Score distribution buckets
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScoreDistribution {
    pub excellent: i64, // >= 90%
    pub good: i64,      // 75-89%
    pub moderate: i64,  // 50-74%
    pub poor: i64,      // < 50%
}

/// Database statistics
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DbStats {
    pub sessions: i64,
    pub scores: i64,
    pub rule_checks: i64,
    pub avg_score: f64,
}

// ============================================================================
// SQLx Row Types (internal)
// ============================================================================

#[derive(sqlx::FromRow)]
struct SessionRow {
    id: String,
    created_at: chrono::NaiveDateTime,
    updated_at: chrono::NaiveDateTime,
    source: String,
    transcript_path: Option<String>,
    metadata: Option<String>,
}

impl From<SessionRow> for Session {
    fn from(row: SessionRow) -> Self {
        Self {
            id: row.id,
            created_at: DateTime::from_naive_utc_and_offset(row.created_at, Utc),
            updated_at: DateTime::from_naive_utc_and_offset(row.updated_at, Utc),
            source: row.source,
            transcript_path: row.transcript_path,
            metadata: row.metadata,
        }
    }
}

#[derive(sqlx::FromRow)]
struct ScoreRow {
    id: i64,
    session_id: String,
    scored_at: chrono::NaiveDateTime,
    total_rules: i32,
    passed_rules: i32,
    score_percentage: f64,
    summary: String,
}

impl From<ScoreRow> for Score {
    fn from(row: ScoreRow) -> Self {
        Self {
            id: row.id,
            session_id: row.session_id,
            scored_at: DateTime::from_naive_utc_and_offset(row.scored_at, Utc),
            total_rules: row.total_rules,
            passed_rules: row.passed_rules,
            score_percentage: row.score_percentage,
            summary: row.summary,
        }
    }
}

#[derive(sqlx::FromRow)]
struct RuleCheckRow {
    id: i64,
    score_id: i64,
    rule_id: String,
    rule_name: String,
    description: String,
    passed: bool,
    confidence: f64,
    evidence: Option<String>,
    suggestion: Option<String>,
}

impl From<RuleCheckRow> for RuleCheckRecord {
    fn from(row: RuleCheckRow) -> Self {
        Self {
            id: row.id,
            score_id: row.score_id,
            rule_id: row.rule_id,
            rule_name: row.rule_name,
            description: row.description,
            passed: row.passed,
            confidence: row.confidence,
            evidence: row.evidence,
            suggestion: row.suggestion,
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_creation() {
        let db = Database::new_in_memory().await.unwrap();
        let version = db.migration_version().await.unwrap();
        assert_eq!(version, 4);
    }

    #[tokio::test]
    async fn test_session_crud() {
        let db = Database::new_in_memory().await.unwrap();

        // Create
        let session = db
            .create_session("test-session", "test", Some("/path/to/transcript.md"), None)
            .await
            .unwrap();
        assert_eq!(session.id, "test-session");
        assert_eq!(session.source, "test");

        // Read
        let fetched = db.get_session("test-session").await.unwrap();
        assert_eq!(fetched.id, "test-session");

        // List
        let sessions = db.list_sessions(None).await.unwrap();
        assert_eq!(sessions.len(), 1);

        // Update
        let updated = db
            .update_session("test-session", None, Some("{\"key\": \"value\"}"))
            .await
            .unwrap();
        assert!(updated.metadata.is_some());

        // Delete
        let deleted = db.delete_session("test-session").await.unwrap();
        assert!(deleted);
    }

    #[tokio::test]
    async fn test_score_crud() {
        let db = Database::new_in_memory().await.unwrap();

        // Create session first
        db.create_session("test-session", "test", None, None)
            .await
            .unwrap();

        // Create score
        let score = db
            .create_score("test-session", 10, 8, 80.0, "Good score")
            .await
            .unwrap();
        assert_eq!(score.session_id, "test-session");
        assert_eq!(score.total_rules, 10);
        assert_eq!(score.passed_rules, 8);

        // Get
        let fetched = db.get_score(score.id).await.unwrap();
        assert_eq!(fetched.id, score.id);

        // List by session
        let scores = db.get_session_scores("test-session").await.unwrap();
        assert_eq!(scores.len(), 1);
    }

    #[tokio::test]
    async fn test_rule_check_crud() {
        let db = Database::new_in_memory().await.unwrap();

        // Setup
        db.create_session("test-session", "test", None, None)
            .await
            .unwrap();
        let score = db
            .create_score("test-session", 10, 8, 80.0, "Good")
            .await
            .unwrap();

        // Create rule check
        let check = db
            .create_rule_check(
                score.id,
                "rule-1",
                "Test Rule",
                "A test rule",
                true,
                1.0,
                Some("Evidence"),
                None,
            )
            .await
            .unwrap();
        assert_eq!(check.score_id, score.id);
        assert!(check.passed);

        // Get
        let fetched = db.get_rule_check(check.id).await.unwrap();
        assert_eq!(fetched.id, check.id);

        // List by score
        let checks = db.get_score_rule_checks(score.id).await.unwrap();
        assert_eq!(checks.len(), 1);
    }

    #[tokio::test]
    async fn test_cascade_delete() {
        let db = Database::new_in_memory().await.unwrap();

        // Setup
        db.create_session("test-session", "test", None, None)
            .await
            .unwrap();
        let score = db
            .create_score("test-session", 10, 8, 80.0, "Good")
            .await
            .unwrap();
        db.create_rule_check(score.id, "rule-1", "Test", "Desc", true, 1.0, None, None)
            .await
            .unwrap();

        // Delete session should cascade
        db.delete_session("test-session").await.unwrap();

        // Verify cascade
        let scores = db.get_session_scores("test-session").await.unwrap();
        assert!(scores.is_empty());
    }

    #[tokio::test]
    async fn test_analytics() {
        let db = Database::new_in_memory().await.unwrap();

        // Setup
        db.create_session("session-1", "test", None, None)
            .await
            .unwrap();
        db.create_session("session-2", "test", None, None)
            .await
            .unwrap();
        db.create_score("session-1", 10, 9, 90.0, "Excellent")
            .await
            .unwrap();
        db.create_score("session-2", 10, 7, 70.0, "Good")
            .await
            .unwrap();

        // Stats
        let stats = db.get_stats().await.unwrap();
        assert_eq!(stats.sessions, 2);
        assert_eq!(stats.scores, 2);
        assert_eq!(stats.avg_score, 80.0);

        // Distribution
        let dist = db.get_score_distribution().await.unwrap();
        assert_eq!(dist.excellent, 1);
        assert_eq!(dist.good, 0);
        assert_eq!(dist.moderate, 1);
        assert_eq!(dist.poor, 0);
    }
}
