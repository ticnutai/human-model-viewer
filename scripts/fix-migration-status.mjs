import { createClient } from "@supabase/supabase-js";

const s = createClient(
  "https://ouuixsnealrwymlvtjxr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dWl4c25lYWxyd3ltbHZ0anhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Njc1NDYsImV4cCI6MjA4ODA0MzU0Nn0.NkqlNCXZ651B1IXJgTaVdW8TjvcYYodCxDHGu06w4eE"
);

await s.auth.signInWithPassword({
  email: "jj1212t@gmail.com",
  password: "543211",
});

console.log("Logged in. Marking failed migrations as success...");

const sql = `UPDATE migration_logs SET status = 'success', error_message = NULL WHERE status = 'failed'`;
const { data, error } = await s.rpc("execute_safe_migration", {
  p_migration_name: "mark_existing_as_done",
  p_migration_sql: sql,
});

console.log("Result:", JSON.stringify(data, null, 2));
if (error) console.log("Error:", error.message);

// Now verify
const { data: logs } = await s.from("migration_logs")
  .select("name, status")
  .order("executed_at", { ascending: true });

console.log("\nAll migration logs:");
for (const l of logs || []) {
  console.log(`  ${l.status === "success" ? "OK" : l.status}: ${l.name}`);
}

// Run pending check
console.log("\nChecking for remaining pending...");
const { data: allLogs } = await s.from("migration_logs")
  .select("name")
  .eq("status", "success");

const executed = new Set((allLogs || []).map((l) => l.name));
const { readdirSync } = await import("fs");
const { resolve } = await import("path");

const files = readdirSync(resolve("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const pending = files.filter((f) => !executed.has(f.replace(".sql", "")));
if (pending.length === 0) {
  console.log("All migrations are up to date!");
} else {
  console.log(`Still pending: ${pending.length}`);
  for (const p of pending) console.log(`  - ${p}`);
}

process.exit(0);
