-- Add mesh_parts and media_type columns to models table (if not already added)
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS mesh_parts JSONB,
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'glb'
    CHECK (media_type IN ('glb', 'animation', 'image', 'video'));

-- Backfill media_type for existing rows
UPDATE public.models
SET media_type = 'glb'
WHERE media_type IS NULL;
