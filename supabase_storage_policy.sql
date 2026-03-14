-- =============================================
-- VICS Storage Policy for matchup-media bucket
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 인증된 사용자 파일 업로드 허용
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'matchup-media'
  AND auth.role() = 'authenticated'
);

-- 누구나 파일 조회 가능 (public bucket)
CREATE POLICY "Anyone can view media"
ON storage.objects FOR SELECT
USING (bucket_id = 'matchup-media');

-- 본인 파일 수정 허용
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'matchup-media'
  AND auth.uid()::text = owner::text
);

-- 본인 파일 삭제 허용
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'matchup-media'
  AND auth.uid()::text = owner::text
);
