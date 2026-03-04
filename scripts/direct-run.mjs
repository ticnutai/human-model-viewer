#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// 🔧 Direct Migration Runner — human-model-viewer
// ══════════════════════════════════════════════════════════════
// Usage:
//   node scripts/direct-run.mjs file "supabase/migrations/xxx.sql"
//   node scripts/direct-run.mjs sql  "SELECT COUNT(*) FROM model_categories"
//   node scripts/direct-run.mjs pending
//   node scripts/direct-run.mjs logs
// ══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { resolve, basename } from "path";

// ── Project config ────────────────────────────────────────────
const SUPABASE_URL = "https://ouuixsnealrwymlvtjxr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dWl4c25lYWxyd3ltbHZ0anhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Njc1NDYsImV4cCI6MjA4ODA0MzU0Nn0.NkqlNCXZ651B1IXJgTaVdW8TjvcYYodCxDHGu06w4eE";

// Admin credentials — used to authenticate to Supabase Auth
// (these are NOT the service role key — just a regular user
//  who happens to be admin in the application)
const ADMIN_EMAIL = "jj1212t@gmail.com";
const ADMIN_PASSWORD = "543211";

// ── Helpers ───────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function banner(text) {
  console.log("\n══════════════════════════════════════════════════");
  console.log(`   ${text}`);
  console.log("══════════════════════════════════════════════════\n");
}

async function login() {
  console.log("🔐 Logging in as admin...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) {
    console.error("❌ Login failed:", error.message);
    process.exit(1);
  }
  console.log(`✅ Logged in as: ${data.user.email}\n`);
}

async function runMigration(name, sql) {
  console.log(`🚀 Running migration: ${name}`);
  console.log("──────────────────────────────────────────────────");

  const { data, error } = await supabase.rpc("execute_safe_migration", {
    p_migration_name: name,
    p_migration_sql: sql,
  });

  if (error) {
    console.error(`\n❌ RPC error: ${error.message}`);
    console.error(
      "   אם אתה רואה 'function does not exist', הרץ קודם את:"
    );
    console.error(
      "   scripts/bootstrap-migration-runner.sql  ← ב-SQL Editor בדאשבורד"
    );
    process.exit(1);
  }

  if (data?.success) {
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   Duration: ${data.duration_ms}ms`);
  } else {
    console.error(`\n❌ Migration failed: ${data?.error}`);
    process.exit(1);
  }
  return data;
}

async function showLogs() {
  const { data, error } = await supabase
    .from("migration_logs")
    .select("*")
    .order("executed_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("❌ Cannot read logs:", error.message);
    return;
  }

  if (!data?.length) {
    console.log("📭 No migration logs yet.");
    return;
  }

  console.log(`📋 Last ${data.length} migrations:\n`);
  for (const log of data) {
    const icon = log.status === "success" ? "✅" : log.status === "failed" ? "❌" : "⏳";
    const ts = new Date(log.executed_at).toLocaleString("he-IL");
    console.log(`  ${icon} ${log.name}`);
    console.log(`     ${ts}  •  ${log.duration_ms ?? "?"}ms  •  ${log.status}`);
    if (log.error_message) {
      console.log(`     ⚠️  ${log.error_message}`);
    }
    console.log();
  }
}

// ── Commands ──────────────────────────────────────────────────
const [, , command, arg] = process.argv;

if (!command || command === "--help" || command === "-h") {
  banner("🔧 Direct Migration Runner");
  console.log("Usage:");
  console.log('  node scripts/direct-run.mjs file "path/to/migration.sql"');
  console.log('  node scripts/direct-run.mjs sql  "SELECT ..."');
  console.log("  node scripts/direct-run.mjs pending");
  console.log("  node scripts/direct-run.mjs logs");
  console.log();
  process.exit(0);
}

banner("🔧 Direct Migration Runner");
await login();

switch (command) {
  case "file": {
    if (!arg) {
      console.error("❌ Missing file path. Example:");
      console.error(
        '   node scripts/direct-run.mjs file "supabase/migrations/xxx.sql"'
      );
      process.exit(1);
    }
    const filePath = resolve(arg);
    const sql = readFileSync(filePath, "utf-8");
    const name = basename(filePath, ".sql");
    console.log(`📄 File: ${filePath}`);
    console.log(`   Size: ${sql.length} chars, ${sql.split("\n").length} lines\n`);
    await runMigration(name, sql);
    break;
  }

  case "sql": {
    if (!arg) {
      console.error("❌ Missing SQL. Example:");
      console.error(
        '   node scripts/direct-run.mjs sql "SELECT COUNT(*) FROM model_categories"'
      );
      process.exit(1);
    }
    await runMigration(`inline_${Date.now()}`, arg);
    break;
  }

  case "pending": {
    const migrationsDir = resolve("supabase/migrations");
    let files;
    try {
      files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    } catch {
      console.error("❌ Cannot read supabase/migrations/ directory");
      process.exit(1);
    }

    // Get already-executed migrations from logs
    const { data: logs } = await supabase
      .from("migration_logs")
      .select("name, status")
      .eq("status", "success");

    const executedNames = new Set((logs || []).map((l) => l.name));

    const pending = files.filter(
      (f) => !executedNames.has(f.replace(".sql", ""))
    );

    if (pending.length === 0) {
      console.log("✅ All migrations are up to date! Nothing to run.");
      break;
    }

    console.log(`📋 Found ${pending.length} pending migration(s):\n`);
    for (const f of pending) {
      console.log(`  ⏳ ${f}`);
    }

    console.log(
      `\n🚀 Running ${pending.length} pending migration(s)...\n`
    );

    let success = 0;
    let failed = 0;
    for (const f of pending) {
      const sql = readFileSync(resolve(migrationsDir, f), "utf-8");
      const name = f.replace(".sql", "");
      try {
        const result = await runMigration(name, sql);
        if (result?.success) success++;
        else failed++;
      } catch {
        failed++;
      }
      console.log();
    }

    console.log("──────────────────────────────────────────────────");
    console.log(`🏁 Done! ✅ ${success} succeeded, ❌ ${failed} failed`);
    break;
  }

  case "logs": {
    await showLogs();
    break;
  }

  default:
    console.error(`❌ Unknown command: ${command}`);
    console.error("   Use: file | sql | pending | logs");
    process.exit(1);
}

console.log("\n🏁 Done!\n");
process.exit(0);
