import type { Category, ModelRecord } from "@/components/ModelManager/types";

export type CloudLibrary = { models: ModelRecord[]; categories: Category[] };
type LoadOptions = { modelOrder?: "created_at.desc" | "display_name"; retries?: number };

function configuration() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !apiKey) throw new Error("Cloud model library is not configured");
  return { baseUrl, headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" } };
}

async function fetchJson<T>(url: string, headers: Record<string, string>, retries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(url, { headers, signal: controller.signal }).finally(() => window.clearTimeout(timeout));
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function loadCloudModels(options: LoadOptions = {}): Promise<ModelRecord[]> {
  const { baseUrl, headers } = configuration();
  const order = options.modelOrder ?? "created_at.desc";
  return fetchJson<ModelRecord[]>(`${baseUrl}/rest/v1/models?select=*&order=${order}`, headers, options.retries ?? 1);
}

export async function loadCloudCategories(retries = 1): Promise<Category[]> {
  const { baseUrl, headers } = configuration();
  return fetchJson<Category[]>(`${baseUrl}/rest/v1/model_categories?select=*&order=sort_order`, headers, retries);
}

export async function loadCloudLibrary(options: LoadOptions = {}): Promise<CloudLibrary> {
  const [models, categories] = await Promise.all([loadCloudModels(options), loadCloudCategories(options.retries ?? 1)]);
  return { models, categories };
}
