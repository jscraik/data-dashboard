import { format, parseISO } from "date-fns";

interface Session {
  session_id: string;
  timestamp: string;
  score_percentage: number;
}

interface TrendChartProps {
  sessions: Session[];
}

export function TrendChart({ sessions }: TrendChartProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">No data available</div>
    );
  }

  // Sort by timestamp
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const maxScore = 100;

  return (
    <div className="h-48">
      <div className="relative h-full">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-xs text-slate-400">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* Chart area */}
        <div className="absolute left-10 right-0 top-0 bottom-6">
          <div className="relative h-full">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-slate-100" />
              <div className="border-t border-slate-100" />
              <div className="border-t border-slate-100" />
            </div>

            {/* Data bars */}
            <div className="absolute inset-0 flex items-end justify-around gap-2">
              {sortedSessions.map((session, _i) => {
                const height = (session.score_percentage / maxScore) * 100;
                return (
                  <div
                    key={session.session_id}
                    className="flex flex-col items-center gap-1 flex-1 max-w-16"
                  >
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        session.score_percentage >= 80
                          ? "bg-green-500"
                          : session.score_percentage >= 60
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${session.session_id}: ${session.score_percentage.toFixed(1)}%`}
                    />
                    <span className="text-xs text-slate-400 truncate w-full text-center">
                      {format(parseISO(session.timestamp), "MMM d")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
