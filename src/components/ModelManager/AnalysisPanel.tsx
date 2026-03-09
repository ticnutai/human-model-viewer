import { useState, useEffect, useRef } from "react";
import { ParallelAnalysisEngine, AnalysisJob } from "./ParallelAnalysisEngine";
import type { ModelRecord } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain, CheckCircle2, XCircle, AlertCircle, PlayCircle, StopCircle, Bot, Zap, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnalysisPanelProps {
  models?: ModelRecord[];
  onLoad?: () => void;
}

// --- Stats Dashboard Component ---
function StatsDashboard({ models }: { models: ModelRecord[] }) {
  const total = models.length;
  const withParts = models.filter(m => m.mesh_parts && Array.isArray(m.mesh_parts) && (m.mesh_parts as any[]).length > 0);
  const analyzed = withParts.length;
  const totalParts = withParts.reduce((sum, m) => sum + (m.mesh_parts as any[]).length, 0);
  const genericCount = withParts.filter(m => {
    const parts = m.mesh_parts as string[];
    return parts.some(p => /^Object[_\s]*\d*$/i.test(p) || /^Mesh[_\s]*\d*$/i.test(p));
  }).length;
  const pending = total - analyzed;

  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      <StatCard icon={<BarChart3 className="w-4 h-4 text-blue-400" />} label="סה״כ מודלים" value={total} color="blue" />
      <StatCard icon={<CheckCircle2 className="w-4 h-4 text-green-400" />} label="נותחו" value={analyzed} color="green" />
      <StatCard icon={<Brain className="w-4 h-4 text-purple-400" />} label="חלקים זוהו" value={totalParts} color="purple" />
      <StatCard icon={<AlertCircle className="w-4 h-4 text-amber-400" />} label="ממתינים" value={pending} color="amber" />
      <div className="col-span-2">
        <StatCard icon={<Bot className="w-4 h-4 text-orange-400" />} label="עם שמות גנריים (דורשים AI)" value={genericCount} color="orange" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-2.5 border border-border bg-card/50`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-bold text-foreground">{value.toLocaleString()}</div>
    </div>
  );
}

export default function AnalysisPanel({ models: propsModels, onLoad }: AnalysisPanelProps) {
  const [localModels, setLocalModels] = useState<ModelRecord[]>([]);
  const [loading, setLoading] = useState(!propsModels);
  const [engine] = useState(() => new ParallelAnalysisEngine(4));
  const [jobs, setJobs] = useState<Record<string, AnalysisJob>>({});
  const [stats, setStats] = useState({ active: 0, completed: 0, total: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "failed" | "success" | "stats">("stats");
  const [aiAnalyzing, setAiAnalyzing] = useState<Set<string>>(new Set());
  const [batchAiRunning, setBatchAiRunning] = useState(false);
  const [batchAiProgress, setBatchAiProgress] = useState({ done: 0, total: 0 });
  const batchAbortRef = useRef(false);
  const { toast } = useToast();

  const fetchModels = async () => {
    setLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/models?select=*&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      if (data) setLocalModels(data);
    } catch (e: any) {
      toast({ title: "שגיאה בטעינת מודלים", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (propsModels) {
      setLocalModels(propsModels);
      setLoading(false);
    } else {
      fetchModels();
    }
  }, [propsModels]);

  const modelsToUse = propsModels || localModels;
  const unanalyzedModels = modelsToUse.filter(m => !m.mesh_parts || (Array.isArray(m.mesh_parts) && m.mesh_parts.length === 0));
  
  // Models with generic names that need AI identification
  const genericNameModels = modelsToUse.filter(m => {
    if (!m.mesh_parts || !Array.isArray(m.mesh_parts) || m.mesh_parts.length === 0) return false;
    const parts = m.mesh_parts as string[];
    return parts.some(p => /^Object[_\s]*\d*$/i.test(p) || /^Mesh[_\s]*\d*$/i.test(p));
  });

  useEffect(() => {
    return () => { engine.stop(); };
  }, [engine]);

  const handleStartAll = () => {
    if (modelsToUse.length === 0) return;
    setIsRunning(true);
    engine.start(modelsToUse, (state) => {
      setJobs(state.jobs);
      setStats({ active: state.activeCount, completed: state.completedCount, total: state.totalCount });
      if (state.completedCount === state.totalCount) {
        setIsRunning(false);
        if (onLoad) onLoad(); else fetchModels();
      }
    });
  };

  const handleStartNew = () => {
    if (unanalyzedModels.length === 0) return;
    setIsRunning(true);
    engine.start(unanalyzedModels, (state) => {
      setJobs(state.jobs);
      setStats({ active: state.activeCount, completed: state.completedCount, total: state.totalCount });
      if (state.completedCount === state.totalCount) {
        setIsRunning(false);
        if (onLoad) onLoad(); else fetchModels();
      }
    });
  };

  const handleStop = () => {
    engine.stop();
    setIsRunning(false);
  };

  const runAiIdentification = async (model: ModelRecord) => {
    if (!model.mesh_parts || !Array.isArray(model.mesh_parts) || model.mesh_parts.length === 0) return;
    
    setAiAnalyzing(prev => new Set(prev).add(model.id));
    
    try {
      const parts = model.mesh_parts as string[];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-analyze-mesh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          meshNames: parts,
          modelName: model.display_name,
          hebrewName: model.hebrew_name,
          partsCount: parts.length
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI function returned ${response.status}: ${errText}`);
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const identifiedNames = data.results.map((r: any) => 
          typeof r === 'string' ? r : (r.hebrewName ? `${r.hebrewName} (${r.meshName})` : r.meshName)
        );
        
        await fetch(
          `${supabaseUrl}/rest/v1/models?id=eq.${model.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ mesh_parts: identifiedNames })
          }
        );
      }
      
      return data.results?.length || 0;
    } catch (e: any) {
      console.error("[AnalysisPanel] AI error:", e);
      throw e;
    } finally {
      setAiAnalyzing(prev => {
        const next = new Set(prev);
        next.delete(model.id);
        return next;
      });
    }
  };

  // Batch AI identification for all generic-name models
  const handleBatchAi = async () => {
    if (genericNameModels.length === 0) {
      toast({ title: "אין מודלים עם שמות גנריים" });
      return;
    }
    
    setBatchAiRunning(true);
    batchAbortRef.current = false;
    setBatchAiProgress({ done: 0, total: genericNameModels.length });
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < genericNameModels.length; i++) {
      if (batchAbortRef.current) break;
      
      const model = genericNameModels[i];
      try {
        const identified = await runAiIdentification(model);
        successCount++;
      } catch (e: any) {
        failCount++;
        // If rate limited, wait and retry
        if (e.message?.includes("429")) {
          toast({ title: "מוגבל קצב — ממתין 10 שניות...", variant: "destructive" });
          await new Promise(r => setTimeout(r, 10000));
          i--; // retry this model
          failCount--;
          continue;
        }
      }
      
      setBatchAiProgress({ done: i + 1, total: genericNameModels.length });
      
      // Small delay between requests to avoid rate limiting
      if (i < genericNameModels.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    
    setBatchAiRunning(false);
    toast({ 
      title: "זיהוי AI קבוצתי הושלם", 
      description: `הצלחות: ${successCount} | שגיאות: ${failCount}` 
    });
    if (onLoad) onLoad(); else fetchModels();
  };

  const handleStopBatchAi = () => {
    batchAbortRef.current = true;
    setBatchAiRunning(false);
  };

  const displayList = modelsToUse.filter(m => {
    const job = jobs[m.id];
    if (filter === "all" || filter === "stats") return true;
    if (filter === "pending") return !job || job.status === "pending";
    if (filter === "failed") return job?.status === "failed";
    if (filter === "success") return job?.status === "success" || (m.mesh_parts && (m.mesh_parts as any[]).length > 0);
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-background" style={{ direction: "rtl" }}>
      {/* Dashboard Header */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              זיהוי וניתוח חכם
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              ניתוח מקבילי + זיהוי AI של מבנים אנטומיים
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <>
                <button
                  onClick={handleStartNew}
                  disabled={unanalyzedModels.length === 0}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  <PlayCircle className="w-4 h-4" />
                  נתח חדשים ({unanalyzedModels.length})
                </button>
                <button
                  onClick={handleStartAll}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80"
                >
                  <PlayCircle className="w-4 h-4" />
                  נתח הכל ({modelsToUse.length})
                </button>
              </>
            ) : (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90"
              >
                <StopCircle className="w-4 h-4" />
                עצור ניתוח
              </button>
            )}
          </div>
        </div>

        {/* Batch AI Button */}
        <div className="flex gap-2 mb-3">
          {!batchAiRunning ? (
            <button
              onClick={handleBatchAi}
              disabled={genericNameModels.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              זיהוי AI קבוצתי — {genericNameModels.length} מודלים עם שמות גנריים
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={handleStopBatchAi}
                className="flex items-center gap-2 px-3 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium"
              >
                <StopCircle className="w-4 h-4" />
                עצור
              </button>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    מריץ זיהוי AI...
                  </span>
                  <span className="font-bold text-purple-500">
                    {batchAiProgress.done}/{batchAiProgress.total}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${batchAiProgress.total ? (batchAiProgress.done / batchAiProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Stats */}
        {stats.total > 0 && (
          <div className="bg-background rounded-lg p-3 border border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">התקדמות ניתוח:</span>
              <span className="text-sm font-bold text-primary">
                {Math.round((stats.completed / stats.total) * 100)}% ({stats.completed}/{stats.total})
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div 
                className="bg-purple-500 h-full transition-all duration-300"
                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{stats.active} רצים כעת...</span>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 p-2 border-b border-border bg-muted/20">
        {(["stats", "all", "pending", "success", "failed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filter === f ? "bg-background shadow-sm border border-border" : "text-muted-foreground hover:bg-background/50"}`}
          >
            {f === "stats" ? "📊 סטטיסטיקות" : f === "all" ? "הכל" : f === "pending" ? "ממתינים" : f === "success" ? "הושלמו" : "שגיאות"}
          </button>
        ))}
      </div>

      {/* Stats Dashboard */}
      {filter === "stats" && <StatsDashboard models={modelsToUse} />}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {displayList.map(model => {
          const job = jobs[model.id];
          const hasParts = model.mesh_parts && Array.isArray(model.mesh_parts) && model.mesh_parts.length > 0;
          const isProcessingAi = aiAnalyzing.has(model.id);
          const hasGenericNames = hasParts && (model.mesh_parts as string[]).some(p => /^Object[_\s]*\d*$/i.test(p) || /^Mesh[_\s]*\d*$/i.test(p));
          
          return (
            <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  {job?.status === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  ) : job?.status === "success" || (hasParts && !hasGenericNames) ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : hasParts && hasGenericNames ? (
                    <Bot className="w-4 h-4 text-amber-500" />
                  ) : job?.status === "failed" ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{model.hebrew_name || model.display_name}</h4>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>
                      {job?.status === "running" ? "מנתח עכשיו..." 
                        : job?.status === "failed" ? job.error 
                        : hasParts && hasGenericNames ? `${(model.mesh_parts as any[]).length} חלקים — שמות גנריים ⚠️`
                        : hasParts ? `${(model.mesh_parts as any[]).length} חלקים זוהו ✓` 
                        : "ממתין לניתוח"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {hasParts && (
                  <button
                    onClick={() => runAiIdentification(model).then(() => {
                      toast({ title: "זיהוי AI הושלם" });
                      if (onLoad) onLoad(); else fetchModels();
                    }).catch(e => toast({ title: "שגיאת AI", description: e.message, variant: "destructive" }))}
                    disabled={isProcessingAi}
                    className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 text-purple-600 rounded text-xs font-semibold hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
                  >
                    {isProcessingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    זיהוי AI
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {displayList.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            לא נמצאו מודלים מתאימים
          </div>
        )}
      </div>
    </div>
  );
}
