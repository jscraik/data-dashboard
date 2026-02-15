import { Activity, Brain, Clock, Play, Scan, Shield, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RecentSessions } from "./RecentSessions";
import { ScoreCard } from "./ScoreCard";
import { TrendChart } from "./TrendChart";

// Types
interface SessionScore {
  session_id: string;
  timestamp: string;
  total_rules: number;
  passed_rules: number;
  score_percentage: number;
  rules?: Array<{
    rule_id: string;
    rule_name: string;
    passed: boolean;
    suggestion: string | null;
  }>;
  summary: string;
}

interface RuleStat {
  name: string;
  pass: number;
  icon: React.ElementType;
}

// Custom hook for session data - React UI Pattern: Extract reusable logic
function useSessionData() {
  const [sessions, setSessions] = useState<SessionScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // In a real implementation, we'd load from the database via Tauri
      // For now, using mock data
      const mockSessions: SessionScore[] = [
        {
          session_id: "2026-02-15-session",
          timestamp: new Date().toISOString(),
          total_rules: 8,
          passed_rules: 6,
          score_percentage: 75.0,
          rules: [
            {
              rule_id: "binary_decision",
              rule_name: "Binary decisions",
              passed: false,
              suggestion: "End decisions with “Ship now? Y/N” to make next steps explicit.",
            },
            {
              rule_id: "objective_before_execution",
              rule_name: "Objective first",
              passed: false,
              suggestion: "State the objective in 1–2 lines before running commands.",
            },
            {
              rule_id: "approval_for_external",
              rule_name: "Approval for external",
              passed: true,
              suggestion: null,
            },
          ],
          summary: "Good adherence. 2 minor improvements possible.",
        },
        {
          session_id: "2026-02-14-session",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          total_rules: 8,
          passed_rules: 7,
          score_percentage: 87.5,
          rules: [
            {
              rule_id: "local_memory_first",
              rule_name: "Local-memory query",
              passed: false,
              suggestion: "Query local-memory before reading files for repo context.",
            },
            {
              rule_id: "no_email_trust",
              rule_name: "Email safety",
              passed: true,
              suggestion: null,
            },
          ],
          summary: "Excellent adherence.",
        },
      ];

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSessions(mockSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const sessionsByTimeAsc = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [sessions]
  );

  // Derived state - React UI Pattern: Compute derived values
  const stats = {
    averageScore:
      sessionsByTimeAsc.length > 0
        ? sessionsByTimeAsc.reduce((sum, s) => sum + s.score_percentage, 0) /
          sessionsByTimeAsc.length
        : 0,
    totalSessions: sessionsByTimeAsc.length,
    sessionsTrendingUp: sessionsByTimeAsc.filter((s, i) => {
      if (i === 0) return false;
      return s.score_percentage > sessionsByTimeAsc[i - 1].score_percentage;
    }).length,
  };

  return { sessions: sessionsByTimeAsc, loading, error, stats, refetch: loadSessions };
}

// Rule performance data with icons - React UI Pattern: Data with presentation
const ruleStats: RuleStat[] = [
  { name: "Confidence calibration", pass: 85, icon: Brain },
  { name: "Objective first", pass: 70, icon: Play },
  { name: "Local-memory query", pass: 60, icon: Brain },
  { name: "Email safety", pass: 100, icon: Shield },
  { name: "Binary decisions", pass: 45, icon: Activity },
];

// Loading skeleton - React UI Pattern: Loading states
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card overflow-hidden">
            <div className="card-body h-24 animate-shimmer" />
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="card-header h-12 animate-shimmer" />
        <div className="card-body h-48 animate-shimmer" />
      </div>
    </div>
  );
}

// Error state - React UI Pattern: Error boundaries
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center h-64">
      <div className="text-red-500 mb-4">Error: {message}</div>
      <button type="button" onClick={onRetry} className="btn-primary">
        Retry
      </button>
    </div>
  );
}

// Empty state - React UI Pattern: Empty states
function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="text-slate-400 mb-2">No sessions scored yet</div>
      <p className="text-sm text-slate-500 mb-4">
        Use the &quot;Score Session&quot; tab to analyze your first session.
      </p>
      <button type="button" onClick={onRefresh} className="btn-secondary">
        Refresh
      </button>
    </div>
  );
}

// Rule performance chart component - React UI Pattern: Small focused components
function RulePerformanceChart({ rules }: { rules: RuleStat[] }) {
  return (
    <div className="space-y-4">
      {rules.map((rule, index) => {
        const Icon = rule.icon;
        return (
          <div
            key={rule.name}
            className="flex items-center gap-3 animate-entrance"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="p-1.5 bg-slate-100 rounded-md">
              <Icon className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700 font-medium">{rule.name}</span>
                <span
                  className={`font-semibold ${
                    rule.pass >= 80
                      ? "text-green-600"
                      : rule.pass >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {rule.pass}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full animate-bar-grow ${
                    rule.pass >= 80
                      ? "bg-green-500"
                      : rule.pass >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{
                    width: `${rule.pass}%`,
                    animationDelay: `${index * 100 + 200}ms`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Main Dashboard component - React UI Pattern: Composition
export function Dashboard({ onGoToScore }: { onGoToScore?: () => void }) {
  const { sessions, loading, error, stats, refetch } = useSessionData();

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (sessions.length === 0) return <EmptyState onRefresh={refetch} />;

  const { averageScore, totalSessions, sessionsTrendingUp } = stats;
  const sessionsByTimeDesc = [...sessions].reverse();
  const latest = sessionsByTimeDesc[0] ?? null;
  const previous = sessionsByTimeDesc[1] ?? null;
  const delta = latest && previous ? latest.score_percentage - previous.score_percentage : null;

  return (
    <div className="space-y-6">
      {/* Hero - React UI Pattern: Focusing mechanism */}
      {latest && (
        <section className="card animate-entrance" aria-label="Latest score summary">
          <div className="card-body flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Latest score</h2>
                {delta !== null && (
                  <span
                    className={`text-sm font-semibold ${delta >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} pts
                  </span>
                )}
              </div>
              <div className="flex items-end gap-4 mt-2">
                <div className="text-4xl font-bold text-slate-900">
                  {latest.score_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-slate-500 pb-1">
                  {latest.passed_rules}/{latest.total_rules} rules passed
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2">{latest.summary}</p>
            </div>

            <div className="flex items-center gap-3">
              {onGoToScore && (
                <button
                  type="button"
                  className="btn-primary flex items-center gap-2"
                  onClick={onGoToScore}
                >
                  <Scan className="w-4 h-4" />
                  Score new session
                </button>
              )}
              <div className="text-xs text-slate-500">
                Updated {new Date(latest.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats Overview - React UI Pattern: Grid layouts */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Dashboard statistics">
        <ScoreCard
          title="Average Score"
          value={`${averageScore.toFixed(1)}%`}
          icon={Activity}
          trend={sessionsTrendingUp > sessions.length / 2 ? "up" : "down"}
          trendValue={`${sessionsTrendingUp} improving`}
          delay={0}
        />
        <ScoreCard
          title="Total Sessions"
          value={totalSessions.toString()}
          icon={Clock}
          subtitle="Scored sessions"
          delay={50}
        />
        <ScoreCard
          title="Current Trend"
          value={averageScore >= 75 ? "Good" : "Needs Work"}
          icon={TrendingUp}
          status={averageScore >= 75 ? "success" : "warning"}
          delay={100}
        />
      </section>

      {/* Charts - React UI Pattern: Card layouts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-label="Performance charts">
        <article className="card">
          <header className="card-header">
            <h3 className="font-semibold text-slate-900">Score Trend</h3>
          </header>
          <div className="card-body">
            <TrendChart sessions={sessions} />
          </div>
        </article>

        <article className="card">
          <header className="card-header">
            <h3 className="font-semibold text-slate-900">Rule Performance</h3>
          </header>
          <div className="card-body">
            <RulePerformanceChart rules={ruleStats} />
          </div>
        </article>
      </section>

      {/* Recent Sessions */}
      <RecentSessions sessions={sessions} />
    </div>
  );
}
