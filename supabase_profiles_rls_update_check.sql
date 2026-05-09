-- profiles UPDATE 정책에 WITH CHECK 추가 (일부 환경에서 UPDATE가 새 행 조건을 만족하지 않아 조용히 실패하는 경우 대비)
-- Supabase SQL Editor에서 실행하세요.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
