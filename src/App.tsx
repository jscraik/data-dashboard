import { invoke } from "@tauri-apps/api/core";
import { Activity, List, Scan } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { RuleList } from "./components/RuleList";
import { SessionScorer } from "./components/SessionScorer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/Tabs";

interface Rule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  weight: number;
  category: string;
}

function App() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  const loadRules = useCallback(async () => {
    try {
      const rulesData = await invoke<Rule[]>("get_rules");
      setRules(rulesData);
    } catch (error) {
      console.error("Failed to load rules:", error);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Data Behavior Dashboard</h1>
            <p className="text-sm text-slate-500">Track adherence to operating rules</p>
          </div>
          <div className="text-sm text-slate-400">v0.1.0</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="score" className="flex items-center gap-2">
              <Scan className="w-4 h-4" />
              Score Session
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard onGoToScore={() => setActiveTab("score")} />
          </TabsContent>

          <TabsContent value="rules">
            <RuleList rules={rules} />
          </TabsContent>

          <TabsContent value="score">
            <SessionScorer />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
