import { Brain, MessageSquare, Play, Shield, Zap } from "lucide-react";

interface Rule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  weight: number;
  category: string;
}

interface RuleListProps {
  rules: Rule[];
}

const categoryIcons: Record<string, React.ElementType> = {
  Startup: Play,
  Response: MessageSquare,
  Confidence: Brain,
  Safety: Shield,
  Communication: Zap,
};

const categoryColors: Record<string, string> = {
  Startup: "bg-slate-50 text-slate-700 border border-slate-200",
  Response: "bg-slate-50 text-slate-700 border border-slate-200",
  Confidence: "bg-slate-50 text-slate-700 border border-slate-200",
  Safety: "bg-slate-50 text-slate-700 border border-slate-200",
  Communication: "bg-slate-50 text-slate-700 border border-slate-200",
};

export function RuleList({ rules }: RuleListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Behavior Rules</h2>
        <span className="text-sm text-slate-500">{rules.length} rules</span>
      </div>

      <div className="grid gap-4">
        {rules.map((rule) => {
          const Icon = categoryIcons[rule.category] || Zap;
          const badgeClass = categoryColors[rule.category] || "bg-slate-100 text-slate-800";

          return (
            <div key={rule.id} className="card hover:shadow-md transition-shadow">
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">{rule.name}</h3>
                        <p className="text-sm text-slate-600 mt-1">{rule.description}</p>
                      </div>

                      <span className={`badge ${badgeClass} shrink-0`}>{rule.category}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div className="text-slate-500">
                        Weight: <span className="font-medium text-slate-700">{rule.weight}x</span>
                      </div>

                      <div className="flex-1 text-slate-400 truncate font-mono text-xs">
                        Pattern: {rule.pattern.substring(0, 50)}...
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
