-- Persist per-mesh educational mappings for GLB analysis (local + cloud sync)
CREATE TABLE IF NOT EXISTS public.model_mesh_mappings (
  model_url TEXT NOT NULL,
  mesh_key TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  system TEXT NOT NULL DEFAULT 'מערכת לא מוגדרת',
  icon TEXT NOT NULL DEFAULT '🔬',
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (model_url, mesh_key)
);

ALTER TABLE public.model_mesh_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'model_mesh_mappings'
      AND policyname = 'Anyone can read model mesh mappings'
  ) THEN
    CREATE POLICY "Anyone can read model mesh mappings"
      ON public.model_mesh_mappings
      FOR SELECT
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'model_mesh_mappings'
      AND policyname = 'Anyone can manage model mesh mappings'
  ) THEN
    CREATE POLICY "Anyone can manage model mesh mappings"
      ON public.model_mesh_mappings
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.touch_model_mesh_mappings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_model_mesh_mappings_updated_at ON public.model_mesh_mappings;
CREATE TRIGGER trg_touch_model_mesh_mappings_updated_at
BEFORE UPDATE ON public.model_mesh_mappings
FOR EACH ROW
EXECUTE FUNCTION public.touch_model_mesh_mappings_updated_at();
