
-- Create a public storage bucket for 3D models
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true);

-- Allow public read access to all files in the models bucket
CREATE POLICY "Public read access for models"
ON storage.objects
FOR SELECT
USING (bucket_id = 'models');

-- Allow authenticated users to upload models
CREATE POLICY "Authenticated users can upload models"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'models');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete models"
ON storage.objects
FOR DELETE
USING (bucket_id = 'models');
