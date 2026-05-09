-- 프로필 사진 배경 링/그라데이션 효과 (ProfileImageEditPage: none | neon | candy | dark)
alter table public.profiles
  add column if not exists avatar_ring_effect text default 'none';

comment on column public.profiles.avatar_ring_effect is 'Avatar frame preset id for profile photo editor';
