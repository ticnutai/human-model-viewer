-- Bootstrap Migration Runner for human-model-viewer
-- Run this ONCE in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ouuixsnealrwymlvtjxr/sql/new

-- Step 1: migration_logs table
CREATE TABLE IF NOT EXISTS public.migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sql_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','success','failed')),
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  duration_ms INTEGER
);

ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='migration_logs'
      AND policyname='Anyone can read migration_logs'
  ) THEN
    CREATE POLICY "Anyone can read migration_logs"
      ON public.migration_logs FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='migration_logs'
      AND policyname='Anyone can manage migration_logs'
  ) THEN
    CREATE POLICY "Anyone can manage migration_logs"
      ON public.migration_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Step 2: execute_safe_migration function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.execute_safe_migration(
  p_migration_name TEXT,
  p_migration_sql TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_start TIMESTAMPTZ;
  v_duration INTEGER;
BEGIN
  v_start := clock_timestamp();

  INSERT INTO public.migration_logs (name, sql_content, status)
  VALUES (p_migration_name, p_migration_sql, 'running')
  RETURNING id INTO v_log_id;

  BEGIN
    EXECUTE p_migration_sql;

    v_duration := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INTEGER;

    UPDATE public.migration_logs
    SET status = 'success', duration_ms = v_duration
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'log_id', v_log_id,
      'duration_ms', v_duration,
      'message', 'Migration executed successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    v_duration := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INTEGER;

    UPDATE public.migration_logs
    SET status = 'failed',
        error_message = SQLERRM,
        duration_ms = v_duration
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'success', false,
      'log_id', v_log_id,
      'duration_ms', v_duration,
      'error', SQLERRM
    );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_safe_migration(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.execute_safe_migration(TEXT, TEXT) TO authenticated;
