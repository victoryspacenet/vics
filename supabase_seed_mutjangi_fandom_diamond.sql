-- Supabase SQL Editor에서 실행 (postgres / service_role 권한)
-- 닉네임「멋쟁이해병」프로필을 다이아 팬덤 등급으로 올립니다.
-- 주의: 이후 해당 유저의 V-Card에 새 Clap이 들어오면 트리거가 Clap 수로 등급을 다시 계산합니다.
--       Clap 5,000 미만이면 골드 등으로 되돌아갈 수 있어요. 상시 다이아가 필요하면 Clap을 백필하거나 별도 정책이 필요합니다.

UPDATE public.profiles
SET
  fandom_tier = 'diamond',
  fandom_points = GREATEST(COALESCE(fandom_points, 0), 25000),
  updated_at = now()
WHERE nickname = '멋쟁이해병';

SELECT id, nickname, fandom_tier, fandom_points
FROM public.profiles
WHERE nickname = '멋쟁이해병';
