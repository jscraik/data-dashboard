import { format, parseISO } from "date-fns";
import { CheckCircle, ChevronRight, FileText, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface Session {
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

interface RecentSessionsProps {
  sessions: Session[];
}

export function RecentSessions({ sessions }: RecentSessionsProps) {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedSession) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSession(null);
        return;
      }

      if (e.key !== "Tab") return;

      const container = dialogRef.current;
      if (!container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          [
            "a[href]",
            "button:not([disabled])",
            "textarea:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            '[tabindex]:not([tabindex="-1"])',
          ].join(",")
        )
      );

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
        return;
      }

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [selectedSession]);

  return (
    <div className="card animate-entrance" style={{ animationDelay: "200ms" }}>
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Recent Sessions</h3>
        <span className="text-sm text-slate-500">{sessions.length} total</span>
      </div>

      <div className="divide-y divide-slate-100">
        {sortedSessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">No sessions scored yet</div>
        ) : (
          sortedSessions.map((session, index) => (
            <button
              key={session.session_id}
              type="button"
              onClick={() => setSelectedSession(session)}
              className="w-full text-left px-4 py-4 hover:bg-slate-50 focus-visible:bg-slate-50 transition-all duration-fast group animate-entrance"
              style={{ animationDelay: `${300 + index * 50}ms` }}
              aria-label={`Open details for ${session.session_id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg transition-colors group-hover:bg-slate-200">
                    <FileText className="w-4 h-4 text-slate-600" />
                  </div>

                  <div>
                    <p className="font-medium text-slate-900">{session.session_id}</p>
                    <p className="text-sm text-slate-500">
                      {format(parseISO(session.timestamp), "MMM d, yyyy HH:mm")}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{session.summary}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p
                      className={`text-body font-semibold ${
                        session.score_percentage >= 80
                          ? "text-green-600"
                          : session.score_percentage >= 60
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {session.score_percentage.toFixed(1)}%
                    </p>
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>
                        {session.passed_rules}/{session.total_rules}
                      </span>
                    </div>
                  </div>

                  {/* Chevron slides in on hover */}
                  <ChevronRight className="w-5 h-5 text-slate-400 opacity-0 -translate-x-2 transition-all duration-fast group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedSession && (
        <div className="fixed inset-0 z-50">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setSelectedSession(null)}
          />

          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              className="card w-full max-w-xl bg-white shadow-xl"
            >
              <div className="card-header flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 id={dialogTitleId} className="font-semibold text-slate-900 truncate">
                    {selectedSession.session_id}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {format(parseISO(selectedSession.timestamp), "MMM d, yyyy HH:mm")}
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2"
                  onClick={() => setSelectedSession(null)}
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </div>

              <div className="card-body space-y-4">
                <p className="text-slate-700">{selectedSession.summary}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Score</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {selectedSession.score_percentage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Passed</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {selectedSession.passed_rules}/{selectedSession.total_rules}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Scored
                    </div>
                  </div>
                </div>

                {selectedSession.rules?.some((r) => !r.passed) && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h4 className="text-sm font-semibold text-slate-900">Top opportunities</h4>
                    <ul className="mt-2 space-y-2">
                      {selectedSession.rules
                        .filter((r) => !r.passed)
                        .slice(0, 2)
                        .map((r) => (
                          <li key={r.rule_id} className="text-sm text-slate-700">
                            <span className="font-medium">{r.rule_name}:</span>{" "}
                            <span className="text-slate-600">
                              {r.suggestion ?? "Review this rule and capture a concrete next step."}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="text-xs text-slate-500">
                  Tip: Press <span className="font-mono">Esc</span> to close.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
