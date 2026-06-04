-- 도전자(B) 전용 제목·설명 (작성자 A는 title / description 컬럼)
-- Supabase SQL Editor에서 실행

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS right_title text;

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS right_description text;

COMMENT ON COLUMN public.matchups.right_title IS '미사용(예약). 경쟁 제목은 작성자 A의 title만 사용';
COMMENT ON COLUMN public.matchups.right_description IS '도전자(B)가 도전장에서 작성한 도전 설명(선택)';
