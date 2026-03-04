#!/usr/bin/env node
// Run all migrations, skipping those that have already been applied.
// Unlike direct-run.mjs "pending" mode, this does NOT exit on failure —
// it continues and reports a summary at the end.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { resolve, basename } from "path";

const SUPABASE_URL = "https://ouuixsnealrwymlvtjxr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dWl4c25lYWxyd3ltbHZ0anhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Njc1NDYsImV4cCI6MjA4ODA0MzU0Nn0.NkqlNCXZ651B1IXJgTaVdW8TjvcYYodCxDHGu06w4eE";

const ADMIN_EMAIL = "jj1212t@gmail.com";
const ADMIN_PASSWORD = "543211";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login
const { error: authErr } = await supabase.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (authErr) {
  console.error("AUTH ERROR:", authErr.message);
  process.exit(1);
}
console.log("Logged in OK\n");

// Get already-executed successful migrations
const { data: logs } = await supabase
  .from("migration_logs")
  .select("name, status")
  .eq("status", "success");

const executedNames = new Set((logs || []).map((l) => l.name));
console.log("Already executed:", [...executedNames]);

// Read migration files
const migrationsDir = resolve("supabase/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`\nTotal migration files: ${files.length}`);

let success = 0;
let skipped = 0;
let failed = 0;

for (const f of files) {
  const name = f.replace(".sql", "");

  // Skip if already executed
  if (executedNames.has(name)) {
    console.log(`SKIP (already done): ${f}`);
    skipped++;
    continue;
  }

  const sql = readFileSync(resolve(migrationsDir, f), "utf-8");
  console.log(`\nRUNNING: ${f} (${sql.length} chars)...`);

  const { data, error } = await supabase.rpc("execute_safe_migration", {
    p_migration_name: name,
    p_migration_sql: sql,
  });

  if (error) {
    console.log(`  RPC ERROR: ${error.message}`);
    failed++;
    continue;
  }

  if (data?.success) {
    console.log(`  OK (${data.duration_ms}ms)`);
    success++;
  } else {
    console.log(`  FAILED: ${data?.error}`);
    failed++;
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Success: ${success}`);
console.log(`Skipped: ${skipped}`);
console.log(`Failed:  ${failed}`);
console.log(`Total:   ${files.length}`);

process.exit(failed > 0 ? 1 : 0);
