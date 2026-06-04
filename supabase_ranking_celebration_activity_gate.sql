-- 랭킹 축하 보너스: 가입 포인트만으로 TOP10 되는 경우 차단
-- Supabase SQL Editor에서 supabase_ranking_celebration_bonus.sql 반영 후 실행

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
  v_uid         uuid := auth.uid();
  v_now_local   date;
  v_period_key  text;
  v_rank        bigint;
  v_amt         integer;
  v_grant_id    uuid;
  v_prev_amt    integer;
  v_prev_rank   bigint;
  v_has_season  boolean;
  v_has_pt      boolean;
  v_new_pts     integer;
  v_new_season  integer;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.matchups m
    WHERE coalesce(m.total_votes, 0) > 0
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_platform_activity');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND (
        coalesce(p.total_votes_received, 0) > 0
        OR coalesce(p.vote_total, 0) > 0
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_ranking_activity');
  END IF;

  v_now_local := (timezone('Asia/Seoul', now()))::date;

  IF coalesce(p_period, 'weekly') = 'weekly' THEN
    v_period_key := 'w-' || to_char(v_now_local, 'IYYY-IW');
  ELSIF p_period = 'monthly' THEN
    v_period_key := 'm-' || to_char(v_now_local, 'YYYY-MM');
  ELSE
    v_period_key := 'all';
  END IF;

  SELECT z.rk INTO v_rank
  FROM (
    SELECT
      p.id,
      RANK() OVER (
        ORDER BY
          CASE
            WHEN p_type_tab = 'creator' AND p_sort_by = 'votes' THEN coalesce(p.total_votes_received, 0)::numeric
            WHEN p_type_tab = 'creator' AND p_sort_by = 'points' THEN coalesce(p.points, 0)::numeric
            WHEN p_type_tab = 'voter' AND p_sort_by = 'points' THEN coalesce(p.points, 0)::numeric
            WHEN p_type_tab = 'voter' AND p_sort_by = 'hitrate' THEN coalesce(p.hit_rate, 0)::numeric
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

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'rank', v_rank,
    'amount', v_amt,
    'period_key', v_period_key,
    'points', v_new_pts,
    'season_points', CASE WHEN v_has_season THEN v_new_season ELSE NULL END
  );
END;
$$;
