
-- Table for model categories/pages
CREATE TABLE public.model_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.model_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read categories"
ON public.model_categories FOR SELECT USING (true);

CREATE POLICY "Anyone can manage categories"
ON public.model_categories FOR ALL USING (true) WITH CHECK (true);

-- Table for model metadata and category assignments
CREATE TABLE public.models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category_id UUID REFERENCES public.model_categories(id) ON DELETE SET NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read models"
ON public.models FOR SELECT USING (true);

CREATE POLICY "Anyone can manage models"
ON public.models FOR ALL USING (true) WITH CHECK (true);

-- Table for migration history (developer panel)
CREATE TABLE public.dev_migrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sql_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'rolled_back')),
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dev_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read migrations"
ON public.dev_migrations FOR SELECT USING (true);

CREATE POLICY "Anyone can manage migrations"
ON public.dev_migrations FOR ALL USING (true) WITH CHECK (true);

-- Allow anyone to delete models from storage (for demo)
DROP POLICY IF EXISTS "Authenticated users can delete models" ON storage.objects;
CREATE POLICY "Anyone can delete models"
ON storage.objects FOR DELETE USING (bucket_id = 'models');

-- Insert default category
INSERT INTO public.model_categories (name, description, icon, sort_order)
VALUES ('כללי', 'מודלים כלליים', '🧬', 0);
