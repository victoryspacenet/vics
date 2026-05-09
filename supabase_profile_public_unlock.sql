-- =============================================
-- VICS — 프로필 공개 권한 (Point Reward)
-- =============================================
-- 마지막 결제 시각. CTA 활성 여부는 `supabase_profile_public_expires.sql` 의 `profile_public_expires_at > now()` 로 판단합니다.
-- Supabase SQL Editor에서 실행하세요.

alter table public.profiles
  add column if not exists profile_public_unlocked_at timestamptz null;

comment on column public.profiles.profile_public_unlocked_at is
  'Point Reward「프로필 공개 권한」마지막 결제 시각.';
