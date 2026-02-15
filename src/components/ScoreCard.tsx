import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { useCountUp } from "../lib/animations";

interface ScoreCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  subtitle?: string;
  status?: "success" | "warning" | "error" | "info";
  delay?: number; // Animation delay in ms
}

export function ScoreCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtitle,
  status = "info",
  delay = 0,
}: ScoreCardProps) {
  // Extract numeric value for count-up animation
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ""));
  const isPercentage = value.includes("%");
  const displayValue = useCountUp(numericValue || 0, 600);

  const statusColors = {
    success: "bg-green-50/50 border-green-200 hover:border-green-300",
    warning: "bg-yellow-50/50 border-yellow-200 hover:border-yellow-300",
    error: "bg-red-50/50 border-red-200 hover:border-red-300",
    info: "bg-white border-slate-200 hover:border-slate-300",
  };

  const iconColors = {
    success: "text-green-600",
    warning: "text-yellow-600",
    error: "text-red-600",
    info: "text-slate-600",
  };

  return (
    <div
      className={`card group ${statusColors[status]} animate-entrance transition-all duration-fast ease-standard hover:-translate-y-0.5 hover:shadow-md`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {isPercentage ? `${displayValue}%` : displayValue}
            </p>

            {trend && trendValue && (
              <div
                className={`flex items-center gap-1 mt-2 text-sm transition-transform duration-fast hover:translate-x-0.5 ${
                  trend === "up"
                    ? "text-green-600"
                    : trend === "down"
                      ? "text-red-600"
                      : "text-slate-500"
                }`}
              >
                {trend === "up" && <TrendingUp className="w-4 h-4" />}
                {trend === "down" && <TrendingDown className="w-4 h-4" />}
                <span>{trendValue}</span>
              </div>
            )}

            {subtitle && !trend && <p className="text-sm text-slate-500 mt-2">{subtitle}</p>}
          </div>

          <div
            className={`p-2 bg-slate-100 rounded-lg transition-all duration-fast group-hover:bg-slate-200 ${iconColors[status]}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
