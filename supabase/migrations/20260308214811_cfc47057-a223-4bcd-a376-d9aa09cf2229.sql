
-- Fix models table: drop restrictive policies and create permissive ones
DROP POLICY IF EXISTS "allow_read_models" ON public.models;
DROP POLICY IF EXISTS "allow_manage_models" ON public.models;

CREATE POLICY "allow_read_models" ON public.models FOR SELECT USING (true);
CREATE POLICY "allow_manage_models" ON public.models FOR ALL USING (true) WITH CHECK (true);

-- Fix model_categories table
DROP POLICY IF EXISTS "allow_read_categories" ON public.model_categories;
DROP POLICY IF EXISTS "allow_manage_categories" ON public.model_categories;

CREATE POLICY "allow_read_categories" ON public.model_categories FOR SELECT USING (true);
CREATE POLICY "allow_manage_categories" ON public.model_categories FOR ALL USING (true) WITH CHECK (true);

-- Fix model_mesh_mappings table
DROP POLICY IF EXISTS "allow_read_mesh_mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "allow_manage_mesh_mappings" ON public.model_mesh_mappings;

CREATE POLICY "allow_read_mesh_mappings" ON public.model_mesh_mappings FOR SELECT USING (true);
CREATE POLICY "allow_manage_mesh_mappings" ON public.model_mesh_mappings FOR ALL USING (true) WITH CHECK (true);

-- Fix dev_migrations table
DROP POLICY IF EXISTS "allow_read_dev_migrations" ON public.dev_migrations;
DROP POLICY IF EXISTS "allow_manage_dev_migrations" ON public.dev_migrations;

CREATE POLICY "allow_read_dev_migrations" ON public.dev_migrations FOR SELECT USING (true);
CREATE POLICY "allow_manage_dev_migrations" ON public.dev_migrations FOR ALL USING (true) WITH CHECK (true);

-- Fix migration_logs table
DROP POLICY IF EXISTS "allow_read_migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "allow_manage_migration_logs" ON public.migration_logs;

CREATE POLICY "allow_read_migration_logs" ON public.migration_logs FOR SELECT USING (true);
CREATE POLICY "allow_manage_migration_logs" ON public.migration_logs FOR ALL USING (true) WITH CHECK (true);
