use std::time::Duration;
use tokio::time::sleep;
use thiserror::Error;

/// Error types for retry logic
#[derive(Debug, Error)]
pub enum RetryError {
    #[error("Max retry attempts exceeded: {0}")]
    MaxRetriesExceeded(String),
    #[error("Transient error: {0}")]
    Transient(String),
    #[error("Permanent error: {0}")]
    Permanent(String),
}

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
        }
    }
}

/// Retry a fallible operation with exponential backoff
pub async fn retry_with_backoff<T, F, Fut>(
    config: &RetryConfig,
    operation: F,
) -> Result<T, RetryError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, RetryError>>,
{
    let mut attempts = 0;
    let mut delay_ms = config.base_delay_ms;

    loop {
        attempts += 1;
        
        match operation().await {
            Ok(result) => return Ok(result),
            Err(RetryError::Permanent(e)) => return Err(RetryError::Permanent(e)),
            Err(e) if attempts >= config.max_attempts => {
                return Err(RetryError::MaxRetriesExceeded(e.to_string()));
            }
            Err(_) => {
                sleep(Duration::from_millis(delay_ms)).await;
                delay_ms = ((delay_ms as f64 * config.backoff_multiplier) as u64)
                    .min(config.max_delay_ms);
            }
        }
    }
}

/// Score a session with retry logic
pub async fn score_session_with_retry(
    scorer: &crate::BehaviorScorer,
    session_id: &str,
    transcript: &str,
) -> Result<crate::SessionScore, RetryError> {
    let config = RetryConfig::default();
    
    retry_with_backoff(&config, || async {
        match scorer.score_session(session_id, transcript) {
            Ok(score) => Ok(score),
            Err(e) if e.contains("database") => Err(RetryError::Transient(e)),
            Err(e) if e.contains("timeout") => Err(RetryError::Transient(e)),
            Err(e) => Err(RetryError::Permanent(e)),
        }
    }).await
}