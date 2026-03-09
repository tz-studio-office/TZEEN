/*
  # Add image support to reading materials

  1. Modified Tables
    - `reading_materials`
      - `image_url` (text, nullable) - URL for an uploaded image/thumbnail

  2. Storage
    - Create `reading-images` bucket for storing uploaded images
    - Public access for reading images
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_materials' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE reading_materials ADD COLUMN image_url text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('reading-images', 'reading-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Coaches can upload reading images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reading-images'
    AND public.get_my_role() IN ('coach', 'admin')
  );

CREATE POLICY "Anyone can view reading images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'reading-images');

CREATE POLICY "Coaches can delete reading images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reading-images'
    AND public.get_my_role() IN ('coach', 'admin')
  );
