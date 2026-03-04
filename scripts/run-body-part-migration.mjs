import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=["']?([^"'\r\n]+)["']?/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\r\n]+)["']?/)?.[1]?.trim();

const sql = readFileSync(
  "supabase/migrations/20260305180000_body_part_categories_media_type.sql",
  "utf8"
);

const res = await fetch(`${url}/rest/v1/rpc/execute_safe_migration`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    p_migration_name: "20260305180000_body_part_categories_media_type",
    p_migration_sql: sql,
  }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
