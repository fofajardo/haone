-- Create Supabase Storage bucket for uploaded images (replaces Firestore pseudo-storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to uploaded images
CREATE POLICY "Public read access for uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- Allow authenticated/service role uploads and deletes
CREATE POLICY "Authenticated upload access for uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Authenticated delete access for uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploads');
