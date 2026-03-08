
-- Drop all existing restrictive policies on models and model_categories
DROP POLICY IF EXISTS "Public read models" ON public.models;
DROP POLICY IF EXISTS "Public manage models" ON public.models;
DROP POLICY IF EXISTS "Public read categories" ON public.model_categories;
DROP POLICY IF EXISTS "Public manage categories" ON public.model_categories;
DROP POLICY IF EXISTS "Public read mesh mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "Public manage mesh mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "Public read migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "Public manage migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "Public read migrations" ON public.dev_migrations;
DROP POLICY IF EXISTS "Public manage migrations" ON public.dev_migrations;

-- Also drop the permissive ones from the previous migration attempt (in case they exist)
DROP POLICY IF EXISTS "Permissive public read models" ON public.models;
DROP POLICY IF EXISTS "Permissive public manage models" ON public.models;
DROP POLICY IF EXISTS "Permissive public read categories" ON public.model_categories;
DROP POLICY IF EXISTS "Permissive public manage categories" ON public.model_categories;
DROP POLICY IF EXISTS "Permissive public read mesh_mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "Permissive public manage mesh_mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "Permissive public read migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "Permissive public manage migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "Permissive public read dev_migrations" ON public.dev_migrations;
DROP POLICY IF EXISTS "Permissive public manage dev_migrations" ON public.dev_migrations;

-- Create PERMISSIVE policies for models
CREATE POLICY "allow_read_models" ON public.models FOR SELECT USING (true);
CREATE POLICY "allow_manage_models" ON public.models FOR ALL USING (true) WITH CHECK (true);

-- Create PERMISSIVE policies for model_categories
CREATE POLICY "allow_read_categories" ON public.model_categories FOR SELECT USING (true);
CREATE POLICY "allow_manage_categories" ON public.model_categories FOR ALL USING (true) WITH CHECK (true);

-- Create PERMISSIVE policies for model_mesh_mappings
CREATE POLICY "allow_read_mesh_mappings" ON public.model_mesh_mappings FOR SELECT USING (true);
CREATE POLICY "allow_manage_mesh_mappings" ON public.model_mesh_mappings FOR ALL USING (true) WITH CHECK (true);

-- Create PERMISSIVE policies for migration_logs
CREATE POLICY "allow_read_migration_logs" ON public.migration_logs FOR SELECT USING (true);
CREATE POLICY "allow_manage_migration_logs" ON public.migration_logs FOR ALL USING (true) WITH CHECK (true);

-- Create PERMISSIVE policies for dev_migrations
CREATE POLICY "allow_read_dev_migrations" ON public.dev_migrations FOR SELECT USING (true);
CREATE POLICY "allow_manage_dev_migrations" ON public.dev_migrations FOR ALL USING (true) WITH CHECK (true);
