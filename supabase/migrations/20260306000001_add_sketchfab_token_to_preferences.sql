-- Add sketchfab_api_token column to user_preferences for cross-device token persistence
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS sketchfab_api_token text DEFAULT NULL;
