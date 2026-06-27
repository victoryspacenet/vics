-- =============================================
-- VICS — 가입 취향 체크 (signup_taste_answers)
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_taste_answers jsonb DEFAULT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_signup_taste_answers_obj;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_signup_taste_answers_obj
  CHECK (
    signup_taste_answers IS NULL
    OR jsonb_typeof(signup_taste_answers) = 'object'
  );

COMMENT ON COLUMN public.profiles.signup_taste_answers IS
  '가입 시 취향 3문항 — personality_type, matchup_role, interest_topic';
