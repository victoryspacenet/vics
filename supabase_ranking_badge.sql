-- =============================================
-- VICS — 랭킹 TOP10 기념 배지
-- profiles 에 배지 컬럼 추가 + claim_ranking_celebration_bonus RPC 배지 지급 로직 추가
-- 선행: supabase_ranking_celebration_bonus.sql
-- =============================================

-- ─────────────────────────────────────────────
-- 1. profiles 에 배지 컬럼 추가
--    ranking_badge_rank      : 달성 순위 (1~10)
--    ranking_badge_expires_at: 배지 만료 시각
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ranking_badge_rank       integer,
  ADD COLUMN IF NOT EXISTS ranking_badge_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.ranking_badge_rank IS
  '랭킹 TOP10 기념 배지 달성 순위 (1~10). NULL이면 배지 없음';
COMMENT ON COLUMN public.profiles.ranking_badge_expires_at IS
  '랭킹 기념 배지 만료 시각. 현재 시각보다 과거이면 만료';

-- ─────────────────────────────────────────────
-- 2. claim_ranking_celebration_bonus RPC 교체
--    배지 지급 로직 추가 (기존 포인트 로직 유지)
--    배지 만료일: 1위 30일 / 2위 14일 / 3~10위 7일
--    이미 더 좋은 배지가 활성 중이면 덮어쓰지 않음
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_ranking_celebration_bonus(
  p_type_tab text,
  p_sort_by text,
  p_category text DEFAULT 'all',
  p_period text DEFAULT 'weekly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid               uuid := auth.uid();
  v_now_local         date;
  v_period_key        text;
  v_rank              bigint;
  v_amt               integer;
  v_grant_id          uuid;
  v_prev_amt          integer;
  v_prev_rank         bigint;
  v_has_season        boolean;
  v_has_pt            boolean;
  v_new_pts           integer;
  v_new_season        integer;
  v_badge_days        integer;
  v_badge_expires     timestamptz;
  v_cur_badge_rank    integer;
  v_cur_badge_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_type_tab NOT IN ('creator', 'voter') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_type_tab');
  END IF;

  IF p_sort_by NOT IN ('points', 'votes', 'hitrate') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_sort_by');
  END IF;

  IF p_type_tab = 'creator' AND p_sort_by = 'hitrate' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_sort_for_creator');
  END IF;

  v_now_local := (timezone('Asia/Seoul', now()))::date;

  IF coalesce(p_period, 'weekly') = 'weekly' THEN
    v_period_key := 'w-' || to_char(v_now_local, 'IYYY-IW');
  ELSIF p_period = 'monthly' THEN
    v_period_key := 'm-' || to_char(v_now_local, 'YYYY-MM');
  ELSE
    v_period_key := 'all';
  END IF;

  -- ── 실시간 순위 계산 ──────────────────────────────
  SELECT z.rk INTO v_rank
  FROM (
    SELECT
      p.id,
      RANK() OVER (
        ORDER BY
          CASE
            WHEN p_type_tab = 'creator' AND p_sort_by = 'votes'   THEN coalesce(p.total_votes_received, 0)::numeric
            WHEN p_type_tab = 'creator' AND p_sort_by = 'points'  THEN coalesce(p.points, 0)::numeric
            WHEN p_type_tab = 'voter'   AND p_sort_by = 'points'  THEN coalesce(p.points, 0)::numeric
            WHEN p_type_tab = 'voter'   AND p_sort_by = 'hitrate' THEN coalesce(p.hit_rate, 0)::numeric
            ELSE coalesce(p.points, 0)::numeric
          END DESC NULLS LAST,
          p.id
      ) AS rk
    FROM public.profiles p
    WHERE (p_type_tab = 'voter' AND p_sort_by = 'hitrate' AND coalesce(p.vote_total, 0) >= 1)
       OR NOT (p_type_tab = 'voter' AND p_sort_by = 'hitrate')
  ) z
  WHERE z.id = v_uid;

  IF v_rank IS NULL OR v_rank > 10 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'not_top10',
      'rank', v_rank,
      'period_key', v_period_key
    );
  END IF;

  v_amt := CASE
    WHEN v_rank = 1 THEN 2000
    WHEN v_rank = 2 THEN 1000
    WHEN v_rank = 3 THEN 500
    ELSE 100
  END;

  -- ── 포인트 멱등 지급 ─────────────────────────────
  v_grant_id := NULL;

  INSERT INTO public.ranking_celebration_grants (
    user_id, period_key, type_tab, sort_by, category, rank_snapshot, amount
  )
  VALUES (
    v_uid,
    v_period_key,
    p_type_tab,
    p_sort_by,
    coalesce(nullif(trim(p_category), ''), 'all'),
    v_rank::integer,
    v_amt
  )
  ON CONFLICT (user_id, period_key, type_tab, sort_by, category) DO NOTHING
  RETURNING id INTO v_grant_id;

  -- 이미 수령한 경우
  IF v_grant_id IS NULL THEN
    SELECT g.amount, g.rank_snapshot
    INTO v_prev_amt, v_prev_rank
    FROM public.ranking_celebration_grants g
    WHERE g.user_id = v_uid
      AND g.period_key = v_period_key
      AND g.type_tab = p_type_tab
      AND g.sort_by = p_sort_by
      AND g.category = coalesce(nullif(trim(p_category), ''), 'all')
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'rank', coalesce(v_prev_rank, v_rank),
      'amount', coalesce(v_prev_amt, v_amt, 0),
      'period_key', v_period_key
    );
  END IF;

  -- ── 포인트 지급 ──────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  SELECT to_regclass('public.point_transactions') IS NOT NULL INTO v_has_pt;

  IF v_has_season THEN
    UPDATE public.profiles
    SET
      points = points + v_amt,
      season_points = season_points + v_amt,
      updated_at = now()
    WHERE id = v_uid
    RETURNING points, season_points INTO v_new_pts, v_new_season;
  ELSE
    UPDATE public.profiles
    SET
      points = points + v_amt,
      updated_at = now()
    WHERE id = v_uid
    RETURNING points INTO v_new_pts;
  END IF;

  IF v_has_pt THEN
    INSERT INTO public.point_transactions (user_id, amount, source, related_id)
    VALUES (v_uid, v_amt, 'ranking_celebration', NULL);
  END IF;

  -- ── 기념 배지 지급 ───────────────────────────────
  -- 배지 유효 기간: 1위 30일 / 2위 14일 / 3~10위 7일
  v_badge_days := CASE
    WHEN v_rank = 1 THEN 30
    WHEN v_rank = 2 THEN 14
    ELSE 7
  END;
  v_badge_expires := now() + (v_badge_days || ' days')::interval;

  -- 현재 활성 배지 확인
  SELECT ranking_badge_rank, ranking_badge_expires_at
  INTO v_cur_badge_rank, v_cur_badge_expires
  FROM public.profiles
  WHERE id = v_uid;

  -- 활성 배지가 없거나 새 배지가 더 높은 순위(낮은 숫자)이거나 만료된 경우 갱신
  IF v_cur_badge_expires IS NULL
     OR v_cur_badge_expires < now()
     OR v_rank < coalesce(v_cur_badge_rank, 99)
  THEN
    UPDATE public.profiles
    SET
      ranking_badge_rank = v_rank::integer,
      ranking_badge_expires_at = v_badge_expires,
      updated_at = now()
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'rank', v_rank,
    'amount', v_amt,
    'period_key', v_period_key,
    'points', v_new_pts,
    'season_points', CASE WHEN v_has_season THEN v_new_season ELSE NULL END,
    'badge_rank', v_rank,
    'badge_expires_at', v_badge_expires
  );
END;
$$;

COMMENT ON FUNCTION public.claim_ranking_celebration_bonus(text, text, text, text) IS
  '랭킹 TOP10 축하 보너스 멱등 지급 + 기념 배지 갱신. period: weekly|monthly|all';

REVOKE ALL ON FUNCTION public.claim_ranking_celebration_bonus(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ranking_celebration_bonus(text, text, text, text) TO authenticated;
