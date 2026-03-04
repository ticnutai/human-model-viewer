import { readFileSync } from "fs";
const env = readFileSync(".env", "utf8");
const url = env.match(/VITE_SUPABASE_URL=["']?([^"'\r\n]+)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\r\n]+)/)?.[1]?.trim();

// 1. Fix RLS on model_categories
const rlsSql = `
ALTER TABLE public.model_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='model_categories' AND policyname='Anyone can read model_categories') THEN
    CREATE POLICY "Anyone can read model_categories" ON public.model_categories FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='model_categories' AND policyname='Anyone can manage model_categories') THEN
    CREATE POLICY "Anyone can manage model_categories" ON public.model_categories FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

const r1 = await fetch(`${url}/rest/v1/rpc/execute_safe_migration`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
  body: JSON.stringify({ p_migration_name: "fix_model_categories_rls", p_migration_sql: rlsSql }),
});
const d1 = await r1.json();
console.log("RLS fix:", JSON.stringify(d1));

// 2. Check how many categories exist
const r2 = await fetch(`${url}/rest/v1/model_categories?select=id,name,icon,sort_order&order=sort_order`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
});
const cats = await r2.json();
console.log("Categories in DB:", JSON.stringify(cats, null, 2));
