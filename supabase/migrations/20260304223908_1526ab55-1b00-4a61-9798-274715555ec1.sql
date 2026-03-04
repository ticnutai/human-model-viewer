
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can manage migrations" ON public.dev_migrations;
DROP POLICY IF EXISTS "Anyone can read migrations" ON public.dev_migrations;

CREATE POLICY "Anyone can manage migrations"
ON public.dev_migrations
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can read migrations"
ON public.dev_migrations
FOR SELECT
USING (true);
