-- =============================================
-- VICS — 매치업 등급(Star~Goat) 최초 달성 시 1회 포인트 보너스
-- 선행: profiles, supabase_profiles_tier_rank_snapshot_rpc.sql (티어·Goat 순위)
-- 선택: supabase_point_expiration.sql (point_transactions + insert_point_transaction)
--       supabase_seasons.sql (season_points)
--
-- 금액은 lib/tiers.js 의 TIER_MILESTONE_BONUS_POINTS 와 동기 유지
--   Star 1000 / Master 2000 / Vip 3000 / Goat 5000
-- 최소 보유 P는 lib/tiers.js TIER_MIN_HOLD_POINTS 와 동기
--   Star 500 / Master 2500 / Vip 5500 / Goat 10500
-- =============================================

-- ─────────────────────────────────────────────
-- 1. point_transactions.source CHECK (tier_milestone 추가)
--    supabase_ranking_celebration_bonus.sql 과 동일 목록 유지 — ranking_celebration 누락 시 23514
--    오류 시: SELECT DISTINCT source FROM public.point_transactions;
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.point_transactions') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.point_transactions DROP CONSTRAINT IF EXISTS point_transactions_source_check;
  ALTER TABLE public.point_transactions ADD CONSTRAINT point_transactions_source_check CHECK (
    source IN (
      'attendance', 'vote', 'matchup_create',
      'creator_win', 'creator_lose', 'creator_draw',
      'voter_win', 'voter_lose', 'voter_draw',
      'tier_milestone',
      'ranking_celebration'
    )
  );
END $$;

-- ─────────────────────────────────────────────
-- 2. 프로필: 이미 지급한 티어 비트마스크 (bit1=Star … bit4=Goat)
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS matchup_tier_bonus_mask integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.matchup_tier_bonus_mask IS
  'Star=2, Master=4, Vip=8, Goat=16 — 최초 달성 보너스 지급 완료 비트';

-- ─────────────────────────────────────────────
-- 3. RPC: 현재 자격 티어에 맞춰 미지급 구간만 지급 (멱등)
--    getTier(tiers.js) 와 동기: **누적 체인** — Master는 Star 조건, Vip는 Star+Master, Goat는 Star+Master+Vip를
--    모두 만족한 뒤 해당 티어 전용 조건·최소 보유 P (Star 500 / Master 2500 / Vip 5500 / Goat 10500)
--    Star: 매치업 10회 이상 및 투표 20회 이상
--    Goat: 위 누적 + Champion/Oracle 전체·주·월 순위 조건 중 하나 이상
--    Vip: 위 누적 + 전체 상위 10% + (PT 있을 때) C/O 중 한 트랙 이상 누적 획득 P>0
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_matchup_tier_milestone_bonuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_mask        integer;
  v_tier_idx    integer := 0;
  v_delta       integer := 0;
  v_m           integer;
  v_amt         integer;
  v_bit         integer;
  v_snap        RECORD;
  v_cm          integer;
  v_tm          integer;
  v_vt          integer;
  v_vh          integer;
  v_hit         numeric;
  v_hit_profile numeric;
  v_has_season  boolean;
  v_has_pt      boolean;
  v_new_pts     integer;
  v_new_season  integer;
  v_grants      jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated', 'total_granted', 0);
  END IF;

  PERFORM pg_advisory_xact_lock(88192001, abs(hashtext(v_uid::text))::integer);

  SELECT
    coalesce(p.matchup_tier_bonus_mask, 0),
    coalesce(p.creator_wins, 0)::integer,
    coalesce(p.total_matchups, 0)::integer,
    coalesce(p.vote_total, 0)::integer,
    coalesce(p.vote_hits, 0)::integer,
    coalesce(p.points, 0)::integer,
    coalesce(p.season_points, 0)::integer,
    coalesce(p.hit_rate::numeric, 0)
  INTO v_mask, v_cm, v_tm, v_vt, v_vh, v_new_pts, v_new_season, v_hit_profile
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found', 'total_granted', 0);
  END IF;

  -- Star~Goat 마일스톤(비트 1~4) 모두 지급됨 → 무거운 랭킹 스냅샷 생략
  IF (v_mask & 15) = 15 THEN
    RETURN jsonb_build_object('ok', true, 'total_granted', 0, 'grants', '[]'::jsonb);
  END IF;

  -- Player 구간: 활동·보유 P 미달 시 스냅샷 RPC 생략
  IF v_new_pts < 500 AND v_tm < 10 AND v_vt < 20 THEN
    RETURN jsonb_build_object('ok', true, 'total_granted', 0, 'grants', '[]'::jsonb);
  END IF;

  IF v_vt > 0 THEN
    v_hit := round((v_vh::numeric / v_vt::numeric) * 100, 1);
  ELSE
    v_hit := v_hit_profile;
  END IF;

  SELECT to_regclass('public.point_transactions') IS NOT NULL INTO v_has_pt;

  SELECT
    s.profile_id,
    s.overall_rank,
    s.total_users,
    s.champion_overall_rank,
    s.oracle_overall_rank,
    s.week_rank_champion,
    s.week_rank_oracle,
    s.month_rank_champion,
    s.month_rank_oracle,
    s.has_point_transactions,
    s.champion_lifetime_pts,
    s.oracle_lifetime_pts
  INTO v_snap
  FROM public.profiles_tier_rank_snapshot_for_ids(ARRAY[v_uid]) AS s
  LIMIT 1;

  -- 누적 체인 (lib/tiers.js getTier): Goat > Vip > Master > Star > Player
  -- Goat: Star+Master+Vip 충족 + 순위 + 보유 P 10500+
  IF v_tm >= 10 AND v_vt >= 20
     AND v_cm >= 20 AND v_hit >= 65
     AND v_new_pts >= 5500
     AND v_snap.total_users > 0 AND v_snap.overall_rank IS NOT NULL
     AND v_snap.overall_rank <= ceil(v_snap.total_users::numeric * 0.1)::bigint
     AND (
       NOT coalesce(v_snap.has_point_transactions, false)
       OR coalesce(v_snap.champion_lifetime_pts, 0) > 0
       OR coalesce(v_snap.oracle_lifetime_pts, 0) > 0
     )
     AND v_new_pts >= 10500
     AND (
       (v_snap.champion_overall_rank IS NOT NULL AND v_snap.champion_overall_rank BETWEEN 1 AND 10)
       OR (v_snap.oracle_overall_rank IS NOT NULL AND v_snap.oracle_overall_rank BETWEEN 1 AND 10)
       OR (v_snap.week_rank_champion IS NOT NULL AND v_snap.week_rank_champion BETWEEN 1 AND 3)
       OR (v_snap.week_rank_oracle IS NOT NULL AND v_snap.week_rank_oracle BETWEEN 1 AND 3)
       OR (v_snap.month_rank_champion IS NOT NULL AND v_snap.month_rank_champion BETWEEN 1 AND 7)
       OR (v_snap.month_rank_oracle IS NOT NULL AND v_snap.month_rank_oracle BETWEEN 1 AND 7)
     )
  THEN
    v_tier_idx := 4;
  -- Vip: Star+Master 충족 + 상위 10% 등 + 보유 P 5500+
  ELSIF v_tm >= 10 AND v_vt >= 20
        AND v_cm >= 20 AND v_hit >= 65
        AND v_new_pts >= 5500
        AND v_snap.total_users > 0 AND v_snap.overall_rank IS NOT NULL
        AND v_snap.overall_rank <= ceil(v_snap.total_users::numeric * 0.1)::bigint
        AND (
          NOT coalesce(v_snap.has_point_transactions, false)
          OR coalesce(v_snap.champion_lifetime_pts, 0) > 0
          OR coalesce(v_snap.oracle_lifetime_pts, 0) > 0
        ) THEN
    v_tier_idx := 3;
  -- Master: Star 충족 + 승리·적중률 + 보유 P 2500+
  ELSIF v_new_pts >= 2500 AND v_tm >= 10 AND v_vt >= 20 AND v_cm >= 20 AND v_hit >= 65 THEN
    v_tier_idx := 2;
  -- Star: 매치업·투표 + 보유 P 500+
  ELSIF v_new_pts >= 500 AND v_tm >= 10 AND v_vt >= 20 THEN
    v_tier_idx := 1;
  ELSE
    v_tier_idx := 0;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  FOR v_m IN 1..LEAST(v_tier_idx, 4) LOOP
    v_bit := (1::integer << v_m);
    IF (v_mask & v_bit) <> 0 THEN
      CONTINUE;
    END IF;
    v_amt := CASE v_m
      WHEN 1 THEN 1000
      WHEN 2 THEN 2000
      WHEN 3 THEN 3000
      WHEN 4 THEN 5000
      ELSE 0
    END;
    IF v_amt <= 0 THEN
      CONTINUE;
    END IF;
    v_delta := v_delta + v_amt;
    v_mask := v_mask | v_bit;
    v_grants := v_grants || jsonb_build_array(jsonb_build_object('tier_index', v_m, 'amount', v_amt));

    IF v_has_pt THEN
      INSERT INTO public.point_transactions (user_id, amount, source, related_id)
      VALUES (v_uid, v_amt, 'tier_milestone', NULL);
    END IF;
  END LOOP;

  IF v_delta > 0 THEN
    IF v_has_season THEN
      UPDATE public.profiles
      SET
        points = points + v_delta,
        season_points = season_points + v_delta,
        matchup_tier_bonus_mask = v_mask,
        updated_at = now()
      WHERE id = v_uid
      RETURNING points, season_points INTO v_new_pts, v_new_season;
    ELSE
      UPDATE public.profiles
      SET
        points = points + v_delta,
        matchup_tier_bonus_mask = v_mask,
        updated_at = now()
      WHERE id = v_uid
      RETURNING points INTO v_new_pts;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'total_granted', v_delta,
    'tier_index', v_tier_idx,
    'mask', v_mask,
    'granted', v_grants,
    'points', v_new_pts,
    'season_points', CASE WHEN v_has_season THEN v_new_season ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_matchup_tier_milestone_bonuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_matchup_tier_milestone_bonuses() TO authenticated;

COMMENT ON FUNCTION public.grant_matchup_tier_milestone_bonuses() IS
  '매치업 등급 Star~Goat 각 최초 1회 포인트 보너스. 클라이언트 로그인 후 프로필 로드 시 호출.';
