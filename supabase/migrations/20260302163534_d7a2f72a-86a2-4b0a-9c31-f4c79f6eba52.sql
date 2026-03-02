
-- Allow anyone to upload models (no auth required for demo)
DROP POLICY "Authenticated users can upload models" ON storage.objects;
CREATE POLICY "Anyone can upload models"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'models');
