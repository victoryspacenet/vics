-- =============================================
-- VICS — 티어·Goat 판정용 순위 스냅샷 RPC
-- The Champion / The Oracle 트랙별 이번 주·이번 달 획득 포인트 집계 (point_transactions)
-- 주·월 경계: Asia/Seoul 달력 기준 (date_trunc week/month)
--
-- 선행: public.profiles, public.point_transactions (supabase_point_expiration.sql)
-- 적용 후: 기존 profiles_points_rank_snapshot_for_ids 는 본 함수의 부분 집합으로 동작
-- =============================================

DROP FUNCTION IF EXISTS public.profiles_points_rank_snapshot_for_ids(uuid[]);
DROP FUNCTION IF EXISTS public.profiles_tier_rank_snapshot_for_ids(uuid[]);

-- ─────────────────────────────────────────────
-- 1) 누적 포인트 순위(Vip) + Champion/Oracle 트랙별 누적·주·월 획득 P 및 순위
--    트랙 순위·누적 P는 point_transactions 가 있을 때만 유효 (없으면 순위 NULL, 누적 0, has_point_transactions false)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_tier_rank_snapshot_for_ids(p_ids uuid[])
RETURNS TABLE (
  profile_id uuid,
  overall_rank bigint,
  total_users bigint,
  champion_overall_rank integer,
  oracle_overall_rank integer,
  champion_week_pts bigint,
  oracle_week_pts bigint,
  champion_month_pts bigint,
  oracle_month_pts bigint,
  week_rank_champion integer,
  week_rank_oracle integer,
  month_rank_champion integer,
  month_rank_oracle integer,
  has_point_transactions boolean,
  champion_lifetime_pts bigint,
  oracle_lifetime_pts bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_pt boolean;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT to_regclass('public.point_transactions') IS NOT NULL INTO v_has_pt;

  RETURN QUERY
  WITH bounds AS (
    SELECT
      ((date_trunc('week', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul') AS wstart,
      ((date_trunc('month', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul') AS mstart
  ),
  champion_week AS (
    SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
    FROM public.point_transactions pt
    CROSS JOIN bounds b
    WHERE v_has_pt
      AND pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
      AND pt.reversed_at IS NULL
      AND pt.expired_at IS NULL
      AND pt.earned_at >= b.wstart
    GROUP BY pt.user_id
  ),
  oracle_week AS (
    SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
    FROM public.point_transactions pt
    CROSS JOIN bounds b
    WHERE v_has_pt
      AND pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
      AND pt.reversed_at IS NULL
      AND pt.expired_at IS NULL
      AND pt.earned_at >= b.wstart
    GROUP BY pt.user_id
  ),
  champion_month AS (
    SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
    FROM public.point_transactions pt
    CROSS JOIN bounds b
    WHERE v_has_pt
      AND pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
      AND pt.reversed_at IS NULL
      AND pt.expired_at IS NULL
      AND pt.earned_at >= b.mstart
    GROUP BY pt.user_id
  ),
  oracle_month AS (
    SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
    FROM public.point_transactions pt
    CROSS JOIN bounds b
    WHERE v_has_pt
      AND pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
      AND pt.reversed_at IS NULL
      AND pt.expired_at IS NULL
      AND pt.earned_at >= b.mstart
    GROUP BY pt.user_id
  ),
  champion_lifetime AS (
    SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
    FROM public.point_transactions pt
    WHERE v_has_pt
      AND pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
      AND pt.reversed_at IS NULL
      AND pt.expired_at IS NULL
    GROUP BY pt.user_id
  ),
  oracle_lifetime AS (
    SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
    FROM public.point_transactions pt
    WHERE v_has_pt
      AND pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
      AND pt.reversed_at IS NULL
      AND pt.expired_at IS NULL
    GROUP BY pt.user_id
  ),
  base AS (
    SELECT
      p.id AS pid,
      coalesce(cl.pts, 0)::bigint AS c_all,
      coalesce(ol.pts, 0)::bigint AS o_all,
      coalesce(cw.pts, 0)::bigint AS c_w,
      coalesce(ow.pts, 0)::bigint AS o_w,
      coalesce(cm.pts, 0)::bigint AS c_m,
      coalesce(om.pts, 0)::bigint AS o_m
    FROM public.profiles p
    LEFT JOIN champion_lifetime cl ON cl.uid = p.id
    LEFT JOIN oracle_lifetime ol ON ol.uid = p.id
    LEFT JOIN champion_week cw ON cw.uid = p.id
    LEFT JOIN oracle_week ow ON ow.uid = p.id
    LEFT JOIN champion_month cm ON cm.uid = p.id
    LEFT JOIN oracle_month om ON om.uid = p.id
  ),
  ranked AS (
    SELECT
      b.pid,
      b.c_all,
      b.o_all,
      b.c_w,
      b.o_w,
      b.c_m,
      b.o_m,
      CASE WHEN v_has_pt THEN
        row_number() OVER (
          ORDER BY CASE WHEN b.c_all > 0 THEN 0 ELSE 1 END, b.c_all DESC, b.pid
        )
      END AS cr_all,
      CASE WHEN v_has_pt THEN
        row_number() OVER (
          ORDER BY CASE WHEN b.o_all > 0 THEN 0 ELSE 1 END, b.o_all DESC, b.pid
        )
      END AS or_all,
      CASE WHEN v_has_pt THEN
        row_number() OVER (
          ORDER BY CASE WHEN b.c_w > 0 THEN 0 ELSE 1 END, b.c_w DESC, b.pid
        )
      END AS wr_c,
      CASE WHEN v_has_pt THEN
        row_number() OVER (
          ORDER BY CASE WHEN b.o_w > 0 THEN 0 ELSE 1 END, b.o_w DESC, b.pid
        )
      END AS wr_o,
      CASE WHEN v_has_pt THEN
        row_number() OVER (
          ORDER BY CASE WHEN b.c_m > 0 THEN 0 ELSE 1 END, b.c_m DESC, b.pid
        )
      END AS mr_c,
      CASE WHEN v_has_pt THEN
        row_number() OVER (
          ORDER BY CASE WHEN b.o_m > 0 THEN 0 ELSE 1 END, b.o_m DESC, b.pid
        )
      END AS mr_o
    FROM base b
  ),
  overall AS (
    SELECT
      p2.id AS oid,
      rank() OVER (ORDER BY p2.points DESC NULLS LAST) AS rk,
      count(*) OVER ()::bigint AS tc
    FROM public.profiles p2
  )
  SELECT
    r.pid,
    o.rk::bigint,
    o.tc::bigint,
    r.cr_all::integer,
    r.or_all::integer,
    r.c_w,
    r.o_w,
    r.c_m,
    r.o_m,
    r.wr_c::integer,
    r.wr_o::integer,
    r.mr_c::integer,
    r.mr_o::integer,
    v_has_pt AS has_point_transactions,
    coalesce(r.c_all, 0)::bigint AS champion_lifetime_pts,
    coalesce(r.o_all, 0)::bigint AS oracle_lifetime_pts
  FROM ranked r
  JOIN overall o ON o.oid = r.pid
  WHERE r.pid = ANY (p_ids);
END;
$$;

COMMENT ON FUNCTION public.profiles_tier_rank_snapshot_for_ids(uuid[]) IS
  'getTier용: 누적 포인트 순위(Vip) + Champion/Oracle 트랙 누적·주·월 획득 P·순위. 최종 티어는 lib/tiers.js getTier처럼 Star→Master→Vip→Goat 누적 체인과 조합됨.';

REVOKE ALL ON FUNCTION public.profiles_tier_rank_snapshot_for_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_tier_rank_snapshot_for_ids(uuid[]) TO anon, authenticated;

-- ─────────────────────────────────────────────
-- 2) 하위 호환: 전체 순위만 (기존 RPC 이름 유지)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_points_rank_snapshot_for_ids(p_ids uuid[])
RETURNS TABLE (profile_id uuid, overall_rank bigint, total_users bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.profile_id, s.overall_rank, s.total_users
  FROM public.profiles_tier_rank_snapshot_for_ids(p_ids) AS s;
$$;

REVOKE ALL ON FUNCTION public.profiles_points_rank_snapshot_for_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_points_rank_snapshot_for_ids(uuid[]) TO anon, authenticated;

-- ─────────────────────────────────────────────
-- 3) 메인 Goat 박제용: Champion·Oracle 누적 Top10 + 월·주 트랙별 Top (+ PT 없을 때 누적/시즌 Top10 폴백)
--    p_use_season: true면 폴백 Top10만 시즌 포인트 기준 정렬 (트랙 탭은 동일)
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.profiles_goat_period_leaderboard();

CREATE OR REPLACE FUNCTION public.profiles_goat_period_leaderboard(p_use_season boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_pt boolean;
  v_has_season boolean;
  v_out jsonb;
BEGIN
  SELECT to_regclass('public.point_transactions') IS NOT NULL INTO v_has_pt;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_pt THEN
    WITH bounds AS (
      SELECT
        ((date_trunc('week', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul') AS wstart,
        ((date_trunc('month', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul') AS mstart
    ),
    champion_week AS (
      SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
      FROM public.point_transactions pt
      CROSS JOIN bounds b
      WHERE pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
        AND pt.reversed_at IS NULL AND pt.expired_at IS NULL
        AND pt.earned_at >= b.wstart
      GROUP BY pt.user_id
    ),
    oracle_week AS (
      SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
      FROM public.point_transactions pt
      CROSS JOIN bounds b
      WHERE pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
        AND pt.reversed_at IS NULL AND pt.expired_at IS NULL
        AND pt.earned_at >= b.wstart
      GROUP BY pt.user_id
    ),
    champion_month AS (
      SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
      FROM public.point_transactions pt
      CROSS JOIN bounds b
      WHERE pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
        AND pt.reversed_at IS NULL AND pt.expired_at IS NULL
        AND pt.earned_at >= b.mstart
      GROUP BY pt.user_id
    ),
    oracle_month AS (
      SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
      FROM public.point_transactions pt
      CROSS JOIN bounds b
      WHERE pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
        AND pt.reversed_at IS NULL AND pt.expired_at IS NULL
        AND pt.earned_at >= b.mstart
      GROUP BY pt.user_id
    ),
    top_cw AS (
      SELECT uid, pts, rk FROM (
        SELECT uid, pts, row_number() OVER (ORDER BY pts DESC, uid) AS rk
        FROM champion_week
      ) z WHERE rk <= 3
    ),
    top_ow AS (
      SELECT uid, pts, rk FROM (
        SELECT uid, pts, row_number() OVER (ORDER BY pts DESC, uid) AS rk
        FROM oracle_week
      ) z WHERE rk <= 3
    ),
    top_cm AS (
      SELECT uid, pts, rk FROM (
        SELECT uid, pts, row_number() OVER (ORDER BY pts DESC, uid) AS rk
        FROM champion_month
      ) z WHERE rk <= 7
    ),
    top_om AS (
      SELECT uid, pts, rk FROM (
        SELECT uid, pts, row_number() OVER (ORDER BY pts DESC, uid) AS rk
        FROM oracle_month
      ) z WHERE rk <= 7
    ),
    champion_lifetime AS (
      SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
      FROM public.point_transactions pt
      WHERE pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
        AND pt.reversed_at IS NULL AND pt.expired_at IS NULL
      GROUP BY pt.user_id
    ),
    oracle_lifetime AS (
      SELECT pt.user_id AS uid, sum(pt.amount)::bigint AS pts
      FROM public.point_transactions pt
      WHERE pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
        AND pt.reversed_at IS NULL AND pt.expired_at IS NULL
      GROUP BY pt.user_id
    ),
    top_champ_all AS (
      SELECT uid, pts, rk FROM (
        SELECT uid, pts, row_number() OVER (ORDER BY pts DESC, uid) AS rk
        FROM champion_lifetime
      ) z WHERE rk <= 10
    ),
    top_ora_all AS (
      SELECT uid, pts, rk FROM (
        SELECT uid, pts, row_number() OVER (ORDER BY pts DESC, uid) AS rk
        FROM oracle_lifetime
      ) z WHERE rk <= 10
    )
    SELECT jsonb_build_object(
      'champion_overall_top10',
      coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url,
            'points', p.points, 'season_points', CASE WHEN v_has_season THEN p.season_points ELSE NULL END,
            'total_matchups', p.total_matchups, 'featured_badge', p.featured_badge,
            'period_points', x.pts, 'rank', x.rk
          ) ORDER BY x.rk
        )
        FROM top_champ_all x
        JOIN public.profiles p ON p.id = x.uid
      ), '[]'::jsonb),
      'oracle_overall_top10',
      coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url,
            'points', p.points, 'season_points', CASE WHEN v_has_season THEN p.season_points ELSE NULL END,
            'total_matchups', p.total_matchups, 'featured_badge', p.featured_badge,
            'period_points', x.pts, 'rank', x.rk
          ) ORDER BY x.rk
        )
        FROM top_ora_all x
        JOIN public.profiles p ON p.id = x.uid
      ), '[]'::jsonb),
      'champion_week_top3',
      coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url,
            'points', p.points, 'season_points', CASE WHEN v_has_season THEN p.season_points ELSE NULL END,
            'total_matchups', p.total_matchups, 'featured_badge', p.featured_badge,
            'period_points', x.pts, 'rank', x.rk
          ) ORDER BY x.rk
        )
        FROM top_cw x
        JOIN public.profiles p ON p.id = x.uid
      ), '[]'::jsonb),
      'oracle_week_top3',
      coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url,
            'points', p.points, 'season_points', CASE WHEN v_has_season THEN p.season_points ELSE NULL END,
            'total_matchups', p.total_matchups, 'featured_badge', p.featured_badge,
            'period_points', x.pts, 'rank', x.rk
          ) ORDER BY x.rk
        )
        FROM top_ow x
        JOIN public.profiles p ON p.id = x.uid
      ), '[]'::jsonb),
      'champion_month_top7',
      coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url,
            'points', p.points, 'season_points', CASE WHEN v_has_season THEN p.season_points ELSE NULL END,
            'total_matchups', p.total_matchups, 'featured_badge', p.featured_badge,
            'period_points', x.pts, 'rank', x.rk
          ) ORDER BY x.rk
        )
        FROM top_cm x
        JOIN public.profiles p ON p.id = x.uid
      ), '[]'::jsonb),
      'oracle_month_top7',
      coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url,
            'points', p.points, 'season_points', CASE WHEN v_has_season THEN p.season_points ELSE NULL END,
            'total_matchups', p.total_matchups, 'featured_badge', p.featured_badge,
            'period_points', x.pts, 'rank', x.rk
          ) ORDER BY x.rk
        )
        FROM top_om x
        JOIN public.profiles p ON p.id = x.uid
      ), '[]'::jsonb)
    ) INTO v_out;
  ELSE
    WITH overall_q AS (
      SELECT
        p.id,
        p.nickname,
        p.avatar_url,
        p.points,
        CASE WHEN v_has_season THEN p.season_points ELSE NULL END AS season_points,
        p.total_matchups,
        p.featured_badge,
        rank() OVER (
          ORDER BY
            CASE
              WHEN p_use_season AND v_has_season THEN coalesce(p.season_points, 0)
              ELSE coalesce(p.points, 0)
            END DESC NULLS LAST
        )::bigint AS rk
      FROM public.profiles p
    )
    SELECT jsonb_build_object(
      'champion_overall_top10', '[]'::jsonb,
      'oracle_overall_top10', '[]'::jsonb,
      'overall_top10',
      coalesce((
        SELECT jsonb_agg(to_jsonb(t) ORDER BY t.rk)
        FROM (SELECT * FROM overall_q ORDER BY rk LIMIT 10) t
      ), '[]'::jsonb),
      'champion_week_top3', '[]'::jsonb,
      'oracle_week_top3', '[]'::jsonb,
      'champion_month_top7', '[]'::jsonb,
      'oracle_month_top7', '[]'::jsonb
    ) INTO v_out;
  END IF;

  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.profiles_goat_period_leaderboard(boolean) IS
  '메인 Goat: Champion/Oracle 누적·주·월 획득 P Top + (PT 없을 때) 누적/시즌 포인트 Top10.';

REVOKE ALL ON FUNCTION public.profiles_goat_period_leaderboard(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_goat_period_leaderboard(boolean) TO anon, authenticated;
