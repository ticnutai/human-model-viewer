
-- Fix models table: drop restrictive, create permissive
DROP POLICY IF EXISTS "Anyone can manage models" ON public.models;
DROP POLICY IF EXISTS "Anyone can read models" ON public.models;
CREATE POLICY "Public read models" ON public.models FOR SELECT USING (true);
CREATE POLICY "Public manage models" ON public.models FOR ALL USING (true) WITH CHECK (true);

-- Fix model_categories table
DROP POLICY IF EXISTS "Anyone can manage categories" ON public.model_categories;
DROP POLICY IF EXISTS "Anyone can read categories" ON public.model_categories;
DROP POLICY IF EXISTS "Anyone can manage model_categories" ON public.model_categories;
DROP POLICY IF EXISTS "Anyone can read model_categories" ON public.model_categories;
CREATE POLICY "Public read categories" ON public.model_categories FOR SELECT USING (true);
CREATE POLICY "Public manage categories" ON public.model_categories FOR ALL USING (true) WITH CHECK (true);

-- Fix model_mesh_mappings table
DROP POLICY IF EXISTS "Anyone can manage model mesh mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "Anyone can read model mesh mappings" ON public.model_mesh_mappings;
CREATE POLICY "Public read mesh mappings" ON public.model_mesh_mappings FOR SELECT USING (true);
CREATE POLICY "Public manage mesh mappings" ON public.model_mesh_mappings FOR ALL USING (true) WITH CHECK (true);

-- Fix migration_logs and dev_migrations too
DROP POLICY IF EXISTS "Anyone can manage migrations" ON public.dev_migrations;
DROP POLICY IF EXISTS "Anyone can read migrations" ON public.dev_migrations;
CREATE POLICY "Public read migrations" ON public.dev_migrations FOR SELECT USING (true);
CREATE POLICY "Public manage migrations" ON public.dev_migrations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can manage migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "Anyone can read migration_logs" ON public.migration_logs;
CREATE POLICY "Public read migration_logs" ON public.migration_logs FOR SELECT USING (true);
CREATE POLICY "Public manage migration_logs" ON public.migration_logs FOR ALL USING (true) WITH CHECK (true);
