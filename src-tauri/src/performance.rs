use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Cache for scored sessions to avoid re-scoring
#[derive(Debug)]
pub struct ScoreCache {
    cache: Arc<RwLock<HashMap<String, CachedScore>>>,
    ttl: Duration,
}

#[derive(Debug, Clone)]
struct CachedScore {
    score: crate::SessionScore,
    timestamp: Instant,
}

impl ScoreCache {
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }
    
    /// Get cached score if not expired
    pub async fn get(&self,
        session_id: &str,
    ) -> Option<crate::SessionScore> {
        let cache = self.cache.read().await;
        cache.get(session_id).and_then(|cached| {
            if cached.timestamp.elapsed() < self.ttl {
                Some(cached.score.clone())
            } else {
                None
            }
        })
    }
    
    /// Store score in cache
    pub async fn set(&self,
        session_id: String,
        score: crate::SessionScore,
    ) {
        let mut cache = self.cache.write().await;
        cache.insert(session_id, CachedScore {
            score,
            timestamp: Instant::now(),
        });
    }
    
    /// Clear expired entries
    pub async fn cleanup(&self) {
        let mut cache = self.cache.write().await;
        cache.retain(|_, cached| cached.timestamp.elapsed() < self.ttl);
    }
}

/// Batch processing for multiple sessions
pub async fn score_sessions_batch(
    scorer: &crate::BehaviorScorer,
    sessions: Vec<(String, String)>, // (session_id, transcript)
    cache: &ScoreCache,
) -> Vec<Result<crate::SessionScore, String>> {
    use tokio::task::JoinSet;
    
    let mut results = Vec::with_capacity(sessions.len());
    let mut tasks = JoinSet::new();
    
    for (session_id, transcript) in sessions {
        // Check cache first
        if let Some(cached) = cache.get(&session_id).await {
            results.push(Ok(cached));
            continue;
        }
        
        // Score in parallel
        tasks.spawn(async move {
            let result = scorer.score_session(&session_id, &transcript);
            (session_id, result)
        });
    }
    
    // Collect results
    while let Some(Ok((session_id, result))) = tasks.join_next().await {
        if let Ok(ref score) = result {
            cache.set(session_id, score.clone()).await;
        }
        results.push(result);
    }
    
    results
}