-- Niflaot Haguf only: cloud persistence for this project's design system.
-- This migration intentionally has no dependency on any other project/database.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS active_theme text,
  ADD COLUMN IF NOT EXISTS custom_themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS design_overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS design_updated_at timestamp with time zone;

COMMENT ON COLUMN public.user_preferences.active_theme IS 'Niflaot Haguf active app theme id';
COMMENT ON COLUMN public.user_preferences.custom_themes IS 'Niflaot Haguf custom theme definitions';
COMMENT ON COLUMN public.user_preferences.design_overrides IS 'Niflaot Haguf live design-mode CSS overrides';
COMMENT ON COLUMN public.user_preferences.design_updated_at IS 'Client timestamp used for last-write-wins design sync';
