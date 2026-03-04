-- Add media_type column to models
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'glb'
    CHECK (media_type IN ('glb', 'animation', 'image', 'video'));

-- Seed predefined body-part categories (skip if already exists by name)
INSERT INTO public.model_categories (name, description, icon, sort_order)
SELECT v.name, v.description, v.icon, v.sort_order
FROM (VALUES
  ('לב',        'מודלים של הלב ומערכת הלב-כלי דם', '❤️',  1),
  ('ריאות',     'מודלים של ריאות ומערכת הנשימה',   '🫁',  2),
  ('כבד',       'מודלים של כבד ומערכת העיכול',     '🟤',  3),
  ('מוח',       'מודלים של המוח ומערכת העצבים',    '🧠',  4),
  ('שלד',       'מודלים של עצמות ומערכת השלד',     '🦴',  5),
  ('שרירים',    'מודלים של שרירים ומערכת התנועה',  '💪',  6),
  ('כליות',     'מודלים של כליות ומערכת השתן',     '🩸',  7),
  ('עור',       'מודלים של עור ומערכת ההגנה',      '🧬',  8),
  ('גוף מלא',  'מודלים של הגוף המלא',              '🧍',  9),
  ('כללי',      'מודלים כלליים ומגוונים',           '📁', 10)
) AS v(name, description, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.model_categories WHERE name = v.name
);
