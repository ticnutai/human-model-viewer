-- Fix RLS policies: change from RESTRICTIVE to PERMISSIVE

-- model_categories: drop restrictive, create permissive
DROP POLICY IF EXISTS "Public read categories" ON public.model_categories;
DROP POLICY IF EXISTS "Public manage categories" ON public.model_categories;

CREATE POLICY "Public read categories" ON public.model_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public manage categories" ON public.model_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- models: drop restrictive, create permissive  
DROP POLICY IF EXISTS "Public read models" ON public.models;
DROP POLICY IF EXISTS "Public manage models" ON public.models;

CREATE POLICY "Public read models" ON public.models
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public manage models" ON public.models
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- model_mesh_mappings: drop restrictive, create permissive
DROP POLICY IF EXISTS "Public read mesh mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "Public manage mesh mappings" ON public.model_mesh_mappings;

CREATE POLICY "Public read mesh mappings" ON public.model_mesh_mappings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public manage mesh mappings" ON public.model_mesh_mappings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- migration_logs: drop restrictive, create permissive
DROP POLICY IF EXISTS "Public read migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "Public manage migration_logs" ON public.migration_logs;

CREATE POLICY "Public read migration_logs" ON public.migration_logs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public manage migration_logs" ON public.migration_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- dev_migrations: drop restrictive, create permissive
DROP POLICY IF EXISTS "Public read migrations" ON public.dev_migrations;
DROP POLICY IF EXISTS "Public manage migrations" ON public.dev_migrations;

CREATE POLICY "Public read migrations" ON public.dev_migrations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public manage migrations" ON public.dev_migrations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
