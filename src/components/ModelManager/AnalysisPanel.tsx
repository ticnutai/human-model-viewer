import { useState, useEffect } from "react";
import { ParallelAnalysisEngine, AnalysisJob } from "./ParallelAnalysisEngine";
import type { ModelRecord } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain, CheckCircle2, XCircle, AlertCircle, PlayCircle, StopCircle, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnalysisPanelProps {
  models?: ModelRecord[];
  onLoad?: () => void;
}

export default function AnalysisPanel({ models: propsModels, onLoad }: AnalysisPanelProps) {
  const [localModels, setLocalModels] = useState<ModelRecord[]>([]);
  const [loading, setLoading] = useState(!propsModels);
  const [engine] = useState(() => new ParallelAnalysisEngine(4));
  const [jobs, setJobs] = useState<Record<string, AnalysisJob>>({});
  const [stats, setStats] = useState({ active: 0, completed: 0, total: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "failed" | "success">("all");
  const [aiAnalyzing, setAiAnalyzing] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const unanalyzedModels = models.filter(m => !m.mesh_parts || (Array.isArray(m.mesh_parts) && m.mesh_parts.length === 0));
  
  useEffect(() => {
    return () => {
      engine.stop();
    };
  }, [engine]);

  const handleStartAll = () => {
    setIsRunning(true);
    engine.start(models, (state) => {
      setJobs(state.jobs);
      setStats({
        active: state.activeCount,
        completed: state.completedCount,
        total: state.totalCount
      });
      if (state.completedCount === state.totalCount) {
        setIsRunning(false);
        onLoad();
      }
    });
  };

  const handleStartNew = () => {
    setIsRunning(true);
    engine.start(unanalyzedModels, (state) => {
      setJobs(state.jobs);
      setStats({
        active: state.activeCount,
        completed: state.completedCount,
        total: state.totalCount
      });
      if (state.completedCount === state.totalCount) {
        setIsRunning(false);
        onLoad();
      }
    });
  };

  const handleStop = () => {
    engine.stop();
    setIsRunning(false);
  };

  const runAiIdentification = async (model: ModelRecord) => {
    if (!model.mesh_parts || !Array.isArray(model.mesh_parts) || model.mesh_parts.length === 0) {
      toast({ title: "אין חלקים לניתוח", variant: "destructive" });
      return;
    }
    
    setAiAnalyzing(prev => new Set(prev).add(model.id));
    
    try {
      const parts = model.mesh_parts as string[];
      
      const { data, error } = await supabase.functions.invoke('ai-analyze-mesh', {
        body: { meshNames: parts }
      });
      
      if (error) throw error;
      
      toast({ title: "ניתוח AI הושלם", description: `זוהו ${data.results?.length || 0} מבנים` });
      onLoad();
    } catch (e: any) {
      console.error(e);
      toast({ title: "שגיאת AI", description: e.message, variant: "destructive" });
    } finally {
      setAiAnalyzing(prev => {
        const next = new Set(prev);
        next.delete(model.id);
        return next;
      });
    }
  };

  const displayList = models.filter(m => {
    const job = jobs[m.id];
    if (filter === "all") return true;
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
              ניתוח מקבילי של מודלים תלת-ממדיים לזיהוי מבנים אנטומיים
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
                  נתח הכל ({models.length})
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
        {(["all", "pending", "success", "failed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filter === f ? "bg-background shadow-sm border border-border" : "text-muted-foreground hover:bg-background/50"}`}
          >
            {f === "all" ? "הכל" : f === "pending" ? "ממתינים" : f === "success" ? "הושלמו" : "שגיאות"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {displayList.map(model => {
          const job = jobs[model.id];
          const hasParts = model.mesh_parts && Array.isArray(model.mesh_parts) && model.mesh_parts.length > 0;
          const isProcessingAi = aiAnalyzing.has(model.id);
          
          return (
            <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  {job?.status === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  ) : job?.status === "success" || hasParts ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : job?.status === "failed" ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{model.hebrew_name || model.display_name}</h4>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{job?.status === "running" ? "מנתח עכשיו..." : job?.status === "failed" ? job.error : hasParts ? `${(model.mesh_parts as any[]).length} חלקים זוהו` : "ממתין לניתוח"}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {hasParts && (
                  <button
                    onClick={() => runAiIdentification(model)}
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
