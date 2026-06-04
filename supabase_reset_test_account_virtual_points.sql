-- 테스트·스몰 라인업 계정 — 가상 포인트·투표받은 수·티어 보너스 초기화
-- Supabase SQL Editor에서 1회 실행 (닉네임은 필요 시 변경)
-- 가입 100P만 남기고 축하 500P만 회수: `supabase_revoke_small_lineup_virtual_points.sql` (포인트+투표 통합)

-- 1) 프로필
UPDATE public.profiles
SET
  points = 100,
  oracle_points = 0,
  vote_hits = 0,
  vote_total = 0,
  creator_wins = 0,
  total_votes_received = 0,
  total_matchups = 0,
  matchup_tier_bonus_mask = 0,
  neon_profile_theme_unlocked_at = NULL,
  neon_profile_theme_expires_at = NULL,
  neon_profile_theme_id = NULL,
  profile_public_unlocked_at = NULL,
  profile_public_expires_at = NULL,
  updated_at = now()
WHERE trim(nickname) IN ('스몰 라인업', '멋쟁이해병');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_total_votes_received'
  ) THEN
    UPDATE public.profiles
    SET season_total_votes_received = 0, updated_at = now()
    WHERE trim(nickname) IN ('스몰 라인업', '멋쟁이해병');
  END IF;
END $$;

-- 2) 해당 유저 매치업 투표·votes
DELETE FROM public.votes v
USING public.matchups m, public.profiles p
WHERE v.matchup_id = m.id
  AND m.user_id = p.id
  AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

UPDATE public.matchups m
SET left_votes = 0, right_votes = 0, total_votes = 0, updated_at = now()
FROM public.profiles p
WHERE m.user_id = p.id
  AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

-- 3) 랭킹 축하 지급 이력
DELETE FROM public.ranking_celebration_grants g
USING public.profiles p
WHERE g.user_id = p.id
  AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

-- 4) 티어·축하 보너스 거래 내역
DO $$
BEGIN
  IF to_regclass('public.point_transactions') IS NOT NULL THEN
    DELETE FROM public.point_transactions pt
    USING public.profiles p
    WHERE p.id = pt.user_id
      AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병')
      AND pt.source IN ('tier_milestone', 'ranking_celebration');
  END IF;
END $$;

SELECT id, nickname, points, total_votes_received, vote_total, total_matchups
FROM public.profiles
WHERE trim(nickname) IN ('스몰 라인업', '멋쟁이해병');
