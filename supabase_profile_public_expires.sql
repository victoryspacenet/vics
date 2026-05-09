-- =============================================
-- VICS — 프로필 공개 권한 만료 시각
-- =============================================
-- `purchase_profile_public_unlock` RPC가 갱신합니다. CTA는 `expires_at > now()` 일 때만 활성.
-- 선행: supabase_profile_public_unlock.sql
-- Supabase SQL Editor에서 실행하세요.

alter table public.profiles
  add column if not exists profile_public_expires_at timestamptz null;

comment on column public.profiles.profile_public_expires_at is
  '프로필 공개 권한 만료 시각. 이 시각이 지나면 V-Card View Full Profile 비활성.';

comment on column public.profiles.profile_public_unlocked_at is
  '프로필 공개 권한 마지막 결제(또는 연장) 시각.';

-- 기존 구매자: 구매 시각 + 1개월로 만료 보정 (이미 expires가 있으면 유지)
update public.profiles p
set profile_public_expires_at = p.profile_public_unlocked_at + interval '1 month'
where p.profile_public_unlocked_at is not null
  and p.profile_public_expires_at is null;
