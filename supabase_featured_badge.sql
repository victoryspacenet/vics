-- 프로필에 대표 배지 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS featured_badge TEXT DEFAULT NULL;

COMMENT ON COLUMN public.profiles.featured_badge IS '유저가 선택한 대표 배지 ID (예: level_3, creator_1)';
