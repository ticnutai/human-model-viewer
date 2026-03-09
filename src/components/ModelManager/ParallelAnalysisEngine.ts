import { analyzeGlbSmart } from "./SmartAnalysis";
import type { ModelRecord } from "./types";

export type JobStatus = "pending" | "running" | "success" | "failed";

export interface AnalysisJob {
  model: ModelRecord;
  status: JobStatus;
  result?: any;
  error?: string;
  progress?: number;
}

export type ProgressCallback = (state: {
  jobs: Record<string, AnalysisJob>;
  activeCount: number;
  completedCount: number;
  totalCount: number;
}) => void;

export class ParallelAnalysisEngine {
  private queue: AnalysisJob[] = [];
  private jobs: Record<string, AnalysisJob> = {};
  private activeCount = 0;
  private concurrency = 4;
  private abortController: AbortController | null = null;
  private onProgress?: ProgressCallback;
  
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
  }
  
  public start(models: ModelRecord[], onProgress?: ProgressCallback) {
    this.stop(); // Stop any existing process
    this.abortController = new AbortController();
    this.onProgress = onProgress;
    
    console.log(`[AnalysisEngine] Starting analysis for ${models.length} models`);
    
    this.jobs = {};
    this.queue = models.map(model => {
      const job: AnalysisJob = { model, status: "pending" };
      this.jobs[model.id] = job;
      return job;
    });
    
    console.log(`[AnalysisEngine] Queue initialized with ${this.queue.length} jobs`);
    this.reportProgress();
    this.processQueue();
  }
  
  public stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.queue = [];
  }
  
  private reportProgress() {
    if (!this.onProgress) return;
    const allJobs = Object.values(this.jobs);
    const completedCount = allJobs.filter(j => j.status === "success" || j.status === "failed").length;
    
    this.onProgress({
      jobs: { ...this.jobs },
      activeCount: this.activeCount,
      completedCount,
      totalCount: allJobs.length
    });
  }
  
  private async processQueue() {
    if (this.abortController?.signal.aborted) {
      console.log(`[AnalysisEngine] Queue aborted`);
      return;
    }
    
    console.log(`[AnalysisEngine] processQueue: activeCount=${this.activeCount}, queueLength=${this.queue.length}`);
    
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.activeCount++;
      console.log(`[AnalysisEngine] Starting job for model: ${job.model.display_name}`);
      this.runJob(job).finally(() => {
        this.activeCount--;
        console.log(`[AnalysisEngine] Job finished: ${job.model.display_name}, status=${job.status}`);
        this.reportProgress();
        this.processQueue();
      });
    }
  }
  
  private async runJob(job: AnalysisJob) {
    job.status = "running";
    this.reportProgress();
    
    try {
      if (!job.model.file_url) throw new Error("No file URL");
      
      console.log(`[AnalysisEngine] Fetching GLB: ${job.model.file_url}`);
      const res = await fetch(job.model.file_url, { signal: this.abortController?.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      console.log(`[AnalysisEngine] Downloaded ${blob.size} bytes for ${job.model.display_name}`);
      
      const file = new File([blob], job.model.file_name, { type: job.model.media_type || "model/gltf-binary" });
      
      console.log(`[AnalysisEngine] Analyzing GLB...`);
      const result = await analyzeGlbSmart(file, job.model.id);
      console.log(`[AnalysisEngine] Analysis result:`, result.translatedNames?.length || 0, "parts");
      
      if (result.translatedNames && result.translatedNames.length > 0) {
        console.log(`[AnalysisEngine] Saving to DB via REST...`);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const saveRes = await fetch(
          `${supabaseUrl}/rest/v1/models?id=eq.${job.model.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ mesh_parts: result.translatedNames })
          }
        );
        if (!saveRes.ok) {
          const errText = await saveRes.text();
          console.error(`[AnalysisEngine] DB save error:`, saveRes.status, errText);
          throw new Error(`DB save failed: ${saveRes.status}`);
        }
        console.log(`[AnalysisEngine] ✅ Saved ${result.translatedNames.length} parts to DB`);
      }
      
      job.status = "success";
      job.result = result;
    } catch (e: any) {
      if (e.name === "AbortError") {
        job.status = "pending";
      } else {
        job.status = "failed";
        job.error = e.message || "Unknown error";
        console.error(`[AnalysisEngine] Failed ${job.model.id}:`, e);
      }
    }
  }
}
