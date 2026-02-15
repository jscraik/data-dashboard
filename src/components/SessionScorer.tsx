import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function buildSessionId(now: Date) {
  // Example: 2026-02-15-1820-session (local time)
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}${min}-session`;
}

interface SessionScore {
  session_id: string;
  timestamp: string;
  total_rules: number;
  passed_rules: number;
  score_percentage: number;
  rules: RuleCheck[];
  summary: string;
}

interface RuleCheck {
  rule_id: string;
  rule_name: string;
  description: string;
  passed: boolean;
  confidence: number;
  evidence: string | null;
  suggestion: string | null;
}

export function SessionScorer() {
  const [sessionId, setSessionId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<SessionScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showResultsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (showResultsTimeoutRef.current) {
        clearTimeout(showResultsTimeoutRef.current);
        showResultsTimeoutRef.current = null;
      }
    };
  }, []);

  const handleScore = async () => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) return;

    setLoading(true);
    setShowResults(false);
    setError(null);

    try {
      const effectiveSessionId = sessionId.trim() || buildSessionId(new Date());
      if (!sessionId.trim()) {
        setSessionId(effectiveSessionId);
      }
      const result = await invoke<SessionScore>("score_session", {
        sessionId: effectiveSessionId,
        transcript: trimmedTranscript,
      });
      setScore(result);
      // Trigger animation after a brief delay
      if (showResultsTimeoutRef.current) {
        clearTimeout(showResultsTimeoutRef.current);
      }
      showResultsTimeoutRef.current = setTimeout(() => {
        setShowResults(true);
        showResultsTimeoutRef.current = null;
      }, 50);
    } catch (error) {
      setScore(null);
      setError(error instanceof Error ? error.message : "Failed to score session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-900">Score New Session</h3>
        </div>
        <div className="card-body space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="transcript" className="block text-sm font-medium text-slate-700 mb-1">
              Session Transcript
            </label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste session transcript here..."
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm transition-all duration-fast"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="sessionId" className="block text-sm font-medium text-slate-700 mb-1">
                Session ID <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <button
                type="button"
                className="text-sm text-indigo-600 hover:text-indigo-700"
                onClick={() => setSessionId(buildSessionId(new Date()))}
              >
                Use timestamp
              </button>
            </div>
            <input
              id="sessionId"
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Leave blank to auto-generate"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-fast"
            />
          </div>

          <button
            type="button"
            onClick={handleScore}
            disabled={!transcript.trim() || loading}
            aria-busy={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scoring...</span>
              </>
            )}
            {!loading && "Score Session"}
          </button>

          <output aria-live="polite" className="text-sm text-slate-500">
            {loading
              ? "Scoring session…"
              : score
                ? "Score ready below."
                : transcript.trim()
                  ? "Ready to score."
                  : "Paste a transcript to score."}
          </output>
        </div>
      </div>

      {score && (
        <div
          className={`card border-indigo-200 transition-all duration-moderate ease-out ${
            showResults
              ? "opacity-100 translate-y-0 max-h-[2000px]"
              : "opacity-0 -translate-y-4 max-h-0 overflow-hidden"
          }`}
        >
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Score Results</h3>
              <span
                className={`text-2xl font-bold ${
                  score.score_percentage >= 80
                    ? "text-green-600"
                    : score.score_percentage >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {score.score_percentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="card-body">
            <p className="text-slate-600 mb-4">{score.summary}</p>

            <div className="space-y-2">
              <h4 className="font-medium text-slate-900">Rule Breakdown:</h4>

              {score.rules.map((rule, index) => (
                <div
                  key={rule.rule_id}
                  className={`flex items-start gap-3 p-3 rounded-lg animate-entrance ${
                    rule.passed ? "bg-green-50" : "bg-red-50"
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {rule.passed ? (
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5 animate-scale-in" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-scale-in" />
                  )}

                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{rule.rule_name}</p>
                    <p className="text-sm text-slate-600">{rule.description}</p>

                    {rule.evidence && (
                      <div className="mt-2 text-xs text-slate-500 font-mono bg-white p-2 rounded animate-fade-in">
                        Evidence: {rule.evidence.substring(0, 100)}...
                      </div>
                    )}

                    {rule.suggestion && (
                      <p className="mt-2 text-sm text-red-600">{rule.suggestion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
