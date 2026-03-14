-- =============================================
-- VICS - profiles 테이블에 bio 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL;
