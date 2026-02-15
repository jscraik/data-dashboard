import { format, parseISO } from "date-fns";
import { CheckCircle, XCircle, FileText, ChevronRight } from "lucide-react";

interface Session {
  session_id: string;
  timestamp: string;
  total_rules: number;
  passed_rules: number;
  score_percentage: number;
  summary: string;
}

interface RecentSessionsProps {
  sessions: Session[];
}

export function RecentSessions({ sessions }: RecentSessionsProps) {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="card animate-entrance" style={{ animationDelay: '200ms' }}>
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Recent Sessions</h3>
        <span className="text-sm text-slate-500">
          {sessions.length} total
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {sortedSessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">
            No sessions scored yet
          </div>
        ) : (
          sortedSessions.map((session, index) => (
            <div
              key={session.session_id}
              className="px-4 py-4 hover:bg-slate-50 transition-all duration-fast cursor-pointer group animate-entrance"
              style={{ animationDelay: `${300 + index * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg transition-colors group-hover:bg-slate-200">
                    <FileText className="w-4 h-4 text-slate-600" />
                  </div>
                  
                  <div>
                    <p className="font-medium text-slate-900">
                      {session.session_id}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(parseISO(session.timestamp), "MMM d, yyyy HH:mm")}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {session.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-body font-semibold ${
                      session.score_percentage >= 80
                        ? "text-green-600"
                        : session.score_percentage >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}>
                      {session.score_percentage.toFixed(1)}%
                    </p>
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>{session.passed_rules}/{session.total_rules}</span>
                    </div>
                  </div>
                  
                  {/* Chevron slides in on hover */}
                  <ChevronRight className="w-5 h-5 text-slate-400 opacity-0 -translate-x-2 transition-all duration-fast group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}