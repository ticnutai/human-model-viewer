-- Add file_url and thumbnail_url columns to models table
-- file_url: full public URL to the GLB file in Supabase Storage
-- thumbnail_url: optional preview image URL

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Backfill file_url for existing rows that have file_name but no file_url
UPDATE public.models
SET file_url = 'https://ouuixsnealrwymlvtjxr.supabase.co/storage/v1/object/public/models/' || file_name
WHERE file_url IS NULL AND file_name IS NOT NULL;
