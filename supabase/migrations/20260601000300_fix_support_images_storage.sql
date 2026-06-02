-- Drop previously created policies that may conflict
DROP POLICY IF EXISTS "Users can upload own support images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own support images"   ON storage.objects;
DROP POLICY IF EXISTS "Admins view all support images"      ON storage.objects;

-- Open policies: any authenticated user can upload and read support images
CREATE POLICY "allow_upload_support_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'support-images');

CREATE POLICY "allow_read_support_images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'support-images');
