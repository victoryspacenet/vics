-- 스몰 라인업(운영 QA) — 가상 포인트·투표받은 수 정리
-- Supabase SQL Editor에서 1회 실행하세요.
--
-- · 600P → 100P : 가입 100P + (가상) 랭킹 축하 3위 500P
-- · 3.1만표 → 0 : profiles.total_votes_received ≈ 31,000 (시드 매치업 투표 수 합산)
-- 대상 닉네임: 스몰 라인업 · 멋쟁이해병 (필요 시 IN 목록만 수정)

-- 대상 닉네임 (QA 계정 이름이 바뀐 경우 둘 다 포함)
--   스몰 라인업 · 멋쟁이해병

-- 1) 실행 전 확인
SELECT p.id, p.nickname, p.points, p.season_points, p.vote_total, p.total_matchups,
       p.total_votes_received, p.signup_bonus_granted_at
FROM public.profiles p
WHERE trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

SELECT g.period_key, g.type_tab, g.sort_by, g.rank_snapshot, g.amount, g.granted_at
FROM public.ranking_celebration_grants g
JOIN public.profiles p ON p.id = g.user_id
WHERE trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병')
ORDER BY g.granted_at DESC;

-- 2) 랭킹 축하 지급 이력·거래 내역 삭제
DELETE FROM public.ranking_celebration_grants g
USING public.profiles p
WHERE g.user_id = p.id
  AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

DO $$
BEGIN
  IF to_regclass('public.point_transactions') IS NOT NULL THEN
    DELETE FROM public.point_transactions pt
    USING public.profiles p
    WHERE pt.user_id = p.id
      AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병')
      AND pt.source IN ('ranking_celebration', 'tier_milestone');
  END IF;
END $$;

-- 3) 잔액 회수 — 100P(가입)만 남김, season_points 도 동일하게 차감
DO $$
DECLARE
  v_uid uuid;
  v_pts integer;
  v_season integer;
  v_revoke integer := 500;
  v_keep integer := 100;
  v_has_season boolean;
BEGIN
  SELECT id, coalesce(points, 0), coalesce(season_points, 0)
  INTO v_uid, v_pts, v_season
  FROM public.profiles
  WHERE trim(nickname) IN ('스몰 라인업', '멋쟁이해병')
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE NOTICE '대상 프로필 없음 — 닉네임을 확인하세요.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  UPDATE public.profiles
  SET
    points = GREATEST(v_keep, v_pts - v_revoke),
    season_points = CASE
      WHEN v_has_season THEN GREATEST(0, v_season - v_revoke)
      ELSE season_points
    END,
    matchup_tier_bonus_mask = 0,
    updated_at = now()
  WHERE id = v_uid;

  RAISE NOTICE '회수 완료 — 이전 % P → 목표 최소 % P (실제 잔액은 SELECT로 확인)', v_pts, v_keep;
END $$;

-- 4) 가상 투표받은 수 제거 (UI 「3.1만표」≈ total_votes_received 31,000 근처)
DELETE FROM public.votes v
USING public.matchups m, public.profiles p
WHERE v.matchup_id = m.id
  AND m.user_id = p.id
  AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

UPDATE public.matchups m
SET
  left_votes = 0,
  right_votes = 0,
  total_votes = 0,
  updated_at = now()
FROM public.profiles p
WHERE m.user_id = p.id
  AND trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

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

UPDATE public.profiles p
SET
  total_votes_received = COALESCE((
    SELECT SUM(m.total_votes)::integer FROM public.matchups m WHERE m.user_id = p.id
  ), 0),
  updated_at = now()
WHERE trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

-- 5) 결과 확인
SELECT p.id, p.nickname, p.points, p.season_points, p.vote_total, p.total_matchups,
       p.total_votes_received,
       (SELECT coalesce(SUM(m.total_votes), 0) FROM public.matchups m WHERE m.user_id = p.id) AS matchup_vote_sum
FROM public.profiles p
WHERE trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');
