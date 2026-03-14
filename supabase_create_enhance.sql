-- =============================================
-- VICS - 매치업 생성 기능 강화
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 카테고리 컬럼 추가
ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

-- 투표 기간 (만료 시간) 컬럼 추가
ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- 카테고리 인덱스
CREATE INDEX IF NOT EXISTS matchups_category_idx ON public.matchups(category);
