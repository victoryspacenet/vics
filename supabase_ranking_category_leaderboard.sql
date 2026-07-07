-- =============================================================================
-- VICS — 랭킹 페이지 RPC (카테고리 × 주/월/전체)
-- Supabase SQL Editor에서 실행하세요.
--
-- p_period: all | weekly | monthly  (Asia/Seoul 달력, point_transactions·votes 기준)
-- p_category_values: NULL/빈 배열 = 전체 카테고리, 아니면 storedCategoryValuesForFilter() 값
-- =============================================================================

DROP FUNCTION IF EXISTS public.profiles_category_ranking_page(text[], text, text, integer, integer, uuid);

CREATE OR REPLACE FUNCTION public.profiles_category_ranking_page(
  p_category_values text[],
  p_type_tab text,
  p_sort_by text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cats text[];
  v_result jsonb;
  v_period text := coalesce(nullif(trim(p_period), ''), 'all');
BEGIN
  IF v_period NOT IN ('all', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'invalid period' USING ERRCODE = '22023';
  END IF;

  IF p_type_tab NOT IN ('creator', 'voter') THEN
    RAISE EXCEPTION 'invalid type_tab' USING ERRCODE = '22023';
  END IF;
  IF p_sort_by NOT IN ('points', 'votes', 'hitrate') THEN
    RAISE EXCEPTION 'invalid sort_by' USING ERRCODE = '22023';
  END IF;
  IF p_type_tab = 'creator' AND p_sort_by = 'hitrate' THEN
    RAISE EXCEPTION 'invalid sort for creator' USING ERRCODE = '22023';
  END IF;

  IF p_category_values IS NULL OR array_length(p_category_values, 1) IS NULL THEN
    v_cats := NULL;
  ELSE
    v_cats := ARRAY(
      SELECT DISTINCT trim(both FROM x)
      FROM unnest(p_category_values) AS t(x)
      WHERE trim(both FROM x) <> ''
    );
    IF array_length(v_cats, 1) IS NULL THEN
      v_cats := NULL;
    END IF;
  END IF;

  -- 전체+전체는 클라이언트 profiles 쿼리 사용
  IF v_cats IS NULL AND v_period = 'all' THEN
    RETURN jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'my_rank', null);
  END IF;

  IF p_type_tab = 'creator' AND p_sort_by = 'points' THEN
    SELECT jsonb_build_object(
      'total', agg.total,
      'rows', COALESCE(agg.rows, '[]'::jsonb),
      'my_rank', agg.my_rank
    )
    INTO v_result
    FROM (
      WITH bounds AS (
        SELECT
          CASE
            WHEN v_period = 'weekly' THEN
              ((date_trunc('week', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
            WHEN v_period = 'monthly' THEN
              ((date_trunc('month', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
            ELSE NULL::timestamptz
          END AS pstart
      ),
      stats AS (
        SELECT pt.user_id, SUM(pt.amount)::numeric AS sort_value
        FROM public.point_transactions pt
        INNER JOIN public.matchups m ON m.id = pt.related_id
        CROSS JOIN bounds b
        WHERE pt.reversed_at IS NULL
          AND pt.expired_at IS NULL
          AND pt.source IN ('creator_win', 'creator_lose', 'creator_draw')
          AND (b.pstart IS NULL OR pt.earned_at >= b.pstart)
          AND (v_cats IS NULL OR m.category = ANY(v_cats))
        GROUP BY pt.user_id
      ),
      base AS (
        SELECT
          p.id, p.nickname, p.avatar_url, p.points, p.champion_points, p.oracle_points,
          p.total_matchups, p.total_votes_received, p.creator_wins, p.creator_win_streak,
          p.vote_hits, p.vote_total, p.hit_rate, p.featured_badge, p.founding_member_number,
          COALESCE(s.sort_value, 0) AS sort_value
        FROM public.profiles p
        INNER JOIN stats s ON s.user_id = p.id
        WHERE public.rank_profile_eligible_for_board(p.id)
      ),
      ranked AS (
        SELECT b.*, RANK() OVER (ORDER BY b.sort_value DESC, b.id) AS display_rank
        FROM base b
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM ranked) AS total,
        (
          SELECT COALESCE(jsonb_agg(
            to_jsonb(r) - 'display_rank' - 'sort_value'
            || jsonb_build_object('display_rank', r.display_rank, 'sort_value', r.sort_value)
            ORDER BY r.sort_value DESC, r.id
          ), '[]'::jsonb)
          FROM (
            SELECT * FROM ranked ORDER BY sort_value DESC, id
            OFFSET GREATEST(p_offset, 0) LIMIT GREATEST(p_limit, 0)
          ) r
        ) AS rows,
        (
          SELECT CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
            'rank', r.display_rank, 'sort_value', r.sort_value,
            'data', to_jsonb(r) - 'display_rank' - 'sort_value'
          ) END
          FROM ranked r WHERE r.id = p_user_id LIMIT 1
        ) AS my_rank
    ) agg;

  ELSIF p_type_tab = 'creator' AND p_sort_by = 'votes' AND v_period != 'all' THEN
    SELECT jsonb_build_object(
      'total', agg.total,
      'rows', COALESCE(agg.rows, '[]'::jsonb),
      'my_rank', agg.my_rank
    )
    INTO v_result
    FROM (
      WITH bounds AS (
        SELECT
          CASE
            WHEN v_period = 'weekly' THEN
              ((date_trunc('week', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
            ELSE
              ((date_trunc('month', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
          END AS pstart
      ),
      stats AS (
        SELECT m.user_id, COUNT(v.id)::numeric AS sort_value
        FROM public.votes v
        INNER JOIN public.matchups m ON m.id = v.matchup_id
        CROSS JOIN bounds b
        WHERE v.created_at >= b.pstart
          AND (v_cats IS NULL OR m.category = ANY(v_cats))
        GROUP BY m.user_id
      ),
      base AS (
        SELECT
          p.id, p.nickname, p.avatar_url, p.points, p.champion_points, p.oracle_points,
          p.total_matchups, p.total_votes_received, p.creator_wins, p.creator_win_streak,
          p.vote_hits, p.vote_total, p.hit_rate, p.featured_badge, p.founding_member_number,
          COALESCE(s.sort_value, 0) AS sort_value
        FROM public.profiles p
        INNER JOIN stats s ON s.user_id = p.id
        WHERE public.rank_profile_eligible_for_board(p.id)
      ),
      ranked AS (
        SELECT b.*, RANK() OVER (ORDER BY b.sort_value DESC, b.id) AS display_rank
        FROM base b
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM ranked) AS total,
        (
          SELECT COALESCE(jsonb_agg(
            to_jsonb(r) - 'display_rank' - 'sort_value'
            || jsonb_build_object('display_rank', r.display_rank, 'sort_value', r.sort_value)
            ORDER BY r.sort_value DESC, r.id
          ), '[]'::jsonb)
          FROM (
            SELECT * FROM ranked ORDER BY sort_value DESC, id
            OFFSET GREATEST(p_offset, 0) LIMIT GREATEST(p_limit, 0)
          ) r
        ) AS rows,
        (
          SELECT CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
            'rank', r.display_rank, 'sort_value', r.sort_value,
            'data', to_jsonb(r) - 'display_rank' - 'sort_value'
          ) END
          FROM ranked r WHERE r.id = p_user_id LIMIT 1
        ) AS my_rank
    ) agg;

  ELSIF p_type_tab = 'creator' AND p_sort_by = 'votes' THEN
    SELECT jsonb_build_object(
      'total', agg.total,
      'rows', COALESCE(agg.rows, '[]'::jsonb),
      'my_rank', agg.my_rank
    )
    INTO v_result
    FROM (
      WITH stats AS (
        SELECT m.user_id, SUM(COALESCE(m.total_votes, 0))::numeric AS sort_value
        FROM public.matchups m
        WHERE v_cats IS NOT NULL AND m.category = ANY(v_cats)
        GROUP BY m.user_id
      ),
      base AS (
        SELECT
          p.id, p.nickname, p.avatar_url, p.points, p.champion_points, p.oracle_points,
          p.total_matchups, p.total_votes_received, p.creator_wins, p.creator_win_streak,
          p.vote_hits, p.vote_total, p.hit_rate, p.featured_badge, p.founding_member_number,
          COALESCE(s.sort_value, 0) AS sort_value
        FROM public.profiles p
        INNER JOIN stats s ON s.user_id = p.id
        WHERE public.rank_profile_eligible_for_board(p.id)
      ),
      ranked AS (
        SELECT b.*, RANK() OVER (ORDER BY b.sort_value DESC, b.id) AS display_rank
        FROM base b
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM ranked) AS total,
        (
          SELECT COALESCE(jsonb_agg(
            to_jsonb(r) - 'display_rank' - 'sort_value'
            || jsonb_build_object('display_rank', r.display_rank, 'sort_value', r.sort_value)
            ORDER BY r.sort_value DESC, r.id
          ), '[]'::jsonb)
          FROM (
            SELECT * FROM ranked ORDER BY sort_value DESC, id
            OFFSET GREATEST(p_offset, 0) LIMIT GREATEST(p_limit, 0)
          ) r
        ) AS rows,
        (
          SELECT CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
            'rank', r.display_rank, 'sort_value', r.sort_value,
            'data', to_jsonb(r) - 'display_rank' - 'sort_value'
          ) END
          FROM ranked r WHERE r.id = p_user_id LIMIT 1
        ) AS my_rank
    ) agg;

  ELSIF p_type_tab = 'voter' AND p_sort_by = 'points' THEN
    SELECT jsonb_build_object(
      'total', agg.total,
      'rows', COALESCE(agg.rows, '[]'::jsonb),
      'my_rank', agg.my_rank
    )
    INTO v_result
    FROM (
      WITH bounds AS (
        SELECT
          CASE
            WHEN v_period = 'weekly' THEN
              ((date_trunc('week', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
            WHEN v_period = 'monthly' THEN
              ((date_trunc('month', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
            ELSE NULL::timestamptz
          END AS pstart
      ),
      stats AS (
        SELECT pt.user_id, SUM(pt.amount)::numeric AS sort_value
        FROM public.point_transactions pt
        INNER JOIN public.matchups m ON m.id = pt.related_id
        CROSS JOIN bounds b
        WHERE pt.reversed_at IS NULL
          AND pt.expired_at IS NULL
          AND pt.source IN ('voter_win', 'voter_lose', 'voter_draw')
          AND (b.pstart IS NULL OR pt.earned_at >= b.pstart)
          AND (v_cats IS NULL OR m.category = ANY(v_cats))
        GROUP BY pt.user_id
      ),
      participated AS (
        SELECT DISTINCT v.user_id
        FROM public.votes v
        INNER JOIN public.matchups m ON m.id = v.matchup_id
        CROSS JOIN bounds b
        WHERE (v_cats IS NULL OR m.category = ANY(v_cats))
          AND (b.pstart IS NULL OR v.created_at >= b.pstart)
      ),
      base AS (
        SELECT
          p.id, p.nickname, p.avatar_url, p.points, p.champion_points, p.oracle_points,
          p.total_matchups, p.total_votes_received, p.creator_wins, p.creator_win_streak,
          p.vote_hits, p.vote_total, p.hit_rate, p.featured_badge, p.founding_member_number,
          COALESCE(s.sort_value, 0) AS sort_value
        FROM public.profiles p
        INNER JOIN participated part ON part.user_id = p.id
        LEFT JOIN stats s ON s.user_id = p.id
        WHERE public.rank_profile_eligible_for_board(p.id)
      ),
      ranked AS (
        SELECT b.*, RANK() OVER (ORDER BY b.sort_value DESC, b.id) AS display_rank
        FROM base b
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM ranked) AS total,
        (
          SELECT COALESCE(jsonb_agg(
            to_jsonb(r) - 'display_rank' - 'sort_value'
            || jsonb_build_object('display_rank', r.display_rank, 'sort_value', r.sort_value)
            ORDER BY r.sort_value DESC, r.id
          ), '[]'::jsonb)
          FROM (
            SELECT * FROM ranked ORDER BY sort_value DESC, id
            OFFSET GREATEST(p_offset, 0) LIMIT GREATEST(p_limit, 0)
          ) r
        ) AS rows,
        (
          SELECT CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
            'rank', r.display_rank, 'sort_value', r.sort_value,
            'data', to_jsonb(r) - 'display_rank' - 'sort_value'
          ) END
          FROM ranked r WHERE r.id = p_user_id LIMIT 1
        ) AS my_rank
    ) agg;

  ELSE
    -- voter + hitrate
    SELECT jsonb_build_object(
      'total', agg.total,
      'rows', COALESCE(agg.rows, '[]'::jsonb),
      'my_rank', agg.my_rank
    )
    INTO v_result
    FROM (
      WITH bounds AS (
        SELECT
          CASE
            WHEN v_period = 'weekly' THEN
              ((date_trunc('week', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
            WHEN v_period = 'monthly' THEN
              ((date_trunc('month', timezone('Asia/Seoul', now()))) AT TIME ZONE 'Asia/Seoul')
            ELSE NULL::timestamptz
          END AS pstart
      ),
      stats AS (
        SELECT
          pt.user_id,
          CASE
            WHEN COUNT(*) > 0 THEN ROUND(
              (COUNT(*) FILTER (WHERE pt.source = 'voter_win')::numeric / COUNT(*)::numeric) * 100, 1
            )
            ELSE 0
          END AS sort_value
        FROM public.point_transactions pt
        INNER JOIN public.matchups m ON m.id = pt.related_id
        CROSS JOIN bounds b
        WHERE pt.reversed_at IS NULL
          AND pt.expired_at IS NULL
          AND pt.source IN ('voter_win', 'voter_lose', 'voter_draw')
          AND (b.pstart IS NULL OR pt.earned_at >= b.pstart)
          AND (v_cats IS NULL OR m.category = ANY(v_cats))
        GROUP BY pt.user_id
        HAVING COUNT(*) >= 1
      ),
      base AS (
        SELECT
          p.id, p.nickname, p.avatar_url, p.points, p.champion_points, p.oracle_points,
          p.total_matchups, p.total_votes_received, p.creator_wins, p.creator_win_streak,
          p.vote_hits, p.vote_total, p.hit_rate, p.featured_badge, p.founding_member_number,
          s.sort_value
        FROM public.profiles p
        INNER JOIN stats s ON s.user_id = p.id
        WHERE public.rank_profile_eligible_for_board(p.id)
      ),
      ranked AS (
        SELECT b.*, RANK() OVER (ORDER BY b.sort_value DESC, b.id) AS display_rank
        FROM base b
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM ranked) AS total,
        (
          SELECT COALESCE(jsonb_agg(
            to_jsonb(r) - 'display_rank' - 'sort_value'
            || jsonb_build_object('display_rank', r.display_rank, 'sort_value', r.sort_value)
            ORDER BY r.sort_value DESC, r.id
          ), '[]'::jsonb)
          FROM (
            SELECT * FROM ranked ORDER BY sort_value DESC, id
            OFFSET GREATEST(p_offset, 0) LIMIT GREATEST(p_limit, 0)
          ) r
        ) AS rows,
        (
          SELECT CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
            'rank', r.display_rank, 'sort_value', r.sort_value,
            'data', to_jsonb(r) - 'display_rank' - 'sort_value'
          ) END
          FROM ranked r WHERE r.id = p_user_id LIMIT 1
        ) AS my_rank
    ) agg;
  END IF;

  RETURN COALESCE(v_result, jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'my_rank', null));
END;
$$;

COMMENT ON FUNCTION public.profiles_category_ranking_page(text[], text, text, integer, integer, uuid, text) IS
  '랭킹 페이지 — period: all|weekly|monthly (Asia/Seoul), category: storedCategoryValuesForFilter() 또는 NULL(전체)';

REVOKE ALL ON FUNCTION public.profiles_category_ranking_page(text[], text, text, integer, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_category_ranking_page(text[], text, text, integer, integer, uuid, text) TO anon, authenticated;
