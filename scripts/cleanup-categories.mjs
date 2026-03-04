import { readFileSync } from "fs";
const env = readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=["']?([^"'\r\n]+)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\r\n]+)/)?.[1]?.trim();

// Delete the test "na" entry (id known)
const r = await fetch(`${url}/rest/v1/model_categories?id=eq.9663acbc-c9a2-4549-b389-b657f07f9c1e`, {
  method: "DELETE",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
});
console.log("Delete na:", r.status, r.statusText);

// Fix sort_order of old "כללי" (id known) to 10 so it appears last
const r2 = await fetch(`${url}/rest/v1/model_categories?id=eq.5864a3a6-6a0a-4021-ab21-114135cbe642`, {
  method: "PATCH",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ sort_order: 10, icon: "📁" }),
});
console.log("Fix כללי sort_order:", r2.status, r2.statusText);
