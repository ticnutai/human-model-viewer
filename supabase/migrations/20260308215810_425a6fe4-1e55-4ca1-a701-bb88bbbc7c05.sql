
-- Drop ALL restrictive policies and recreate as PERMISSIVE

-- models
DROP POLICY IF EXISTS "allow_read_models" ON public.models;
DROP POLICY IF EXISTS "allow_manage_models" ON public.models;
CREATE POLICY "public_read_models" ON public.models FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_manage_models" ON public.models FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- model_categories
DROP POLICY IF EXISTS "allow_read_categories" ON public.model_categories;
DROP POLICY IF EXISTS "allow_manage_categories" ON public.model_categories;
CREATE POLICY "public_read_categories" ON public.model_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_manage_categories" ON public.model_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- model_mesh_mappings
DROP POLICY IF EXISTS "allow_read_mesh_mappings" ON public.model_mesh_mappings;
DROP POLICY IF EXISTS "allow_manage_mesh_mappings" ON public.model_mesh_mappings;
CREATE POLICY "public_read_mesh_mappings" ON public.model_mesh_mappings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_manage_mesh_mappings" ON public.model_mesh_mappings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- dev_migrations
DROP POLICY IF EXISTS "allow_read_dev_migrations" ON public.dev_migrations;
DROP POLICY IF EXISTS "allow_manage_dev_migrations" ON public.dev_migrations;
CREATE POLICY "public_read_dev_migrations" ON public.dev_migrations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_manage_dev_migrations" ON public.dev_migrations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- migration_logs
DROP POLICY IF EXISTS "allow_read_migration_logs" ON public.migration_logs;
DROP POLICY IF EXISTS "allow_manage_migration_logs" ON public.migration_logs;
CREATE POLICY "public_read_migration_logs" ON public.migration_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_manage_migration_logs" ON public.migration_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Also drop any old policies that might conflict
DROP POLICY IF EXISTS "Anyone can read model_categories" ON public.model_categories;
DROP POLICY IF EXISTS "Anyone can manage model_categories" ON public.model_categories;
