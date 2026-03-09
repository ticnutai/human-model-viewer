import { analyzeGlbSmart } from "./SmartAnalysis";
import { supabase } from "@/integrations/supabase/client";
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
    
    this.jobs = {};
    this.queue = models.map(model => {
      const job: AnalysisJob = { model, status: "pending" };
      this.jobs[model.id] = job;
      return job;
    });
    
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
    if (this.abortController?.signal.aborted) return;
    
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.activeCount++;
      this.runJob(job).finally(() => {
        this.activeCount--;
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
      
      // Simulate fetch to blob
      const res = await fetch(job.model.file_url, { signal: this.abortController?.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], job.model.file_name, { type: job.model.media_type || "model/gltf-binary" });
      
      const result = await analyzeGlbSmart(file, job.model.id);
      
      if (result.translatedNames && result.translatedNames.length > 0) {
        const { error } = await supabase
          .from("models")
          .update({ mesh_parts: result.translatedNames })
          .eq("id", job.model.id);
          
        if (error) throw error;
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
