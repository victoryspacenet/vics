-- =============================================
-- VICS - matchups 테이블에 tags 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 태그 검색을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS matchups_tags_idx ON public.matchups USING GIN (tags);
