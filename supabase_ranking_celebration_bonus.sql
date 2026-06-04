-- =============================================
-- VICS — 랭킹 TOP10 축하 보너스 (주기·탭·정렬별 1회 지급)
-- 선행: public.profiles, public.point_transactions (supabase_point_expiration.sql)
-- 금액은 src/lib/rankingCelebrationRewards.js 와 동기: 1위 2000 / 2위 1000 / 3위 500 / 4~10위 100
-- 순위는 실제 profiles 컬럼 기준 (랭킹 페이지의 목업 스탯과 다를 수 있음)
-- =============================================

-- ─────────────────────────────────────────────
-- 1. point_transactions.source 에 ranking_celebration 허용
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
-- 2. 지급 이력 (멱등)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranking_celebration_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  type_tab text NOT NULL CHECK (type_tab IN ('creator', 'voter')),
  sort_by text NOT NULL CHECK (sort_by IN ('points', 'votes', 'hitrate')),
  category text NOT NULL DEFAULT 'all',
  rank_snapshot integer NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_key, type_tab, sort_by, category)
);

CREATE INDEX IF NOT EXISTS ranking_celebration_grants_user_idx
  ON public.ranking_celebration_grants (user_id, granted_at DESC);

ALTER TABLE public.ranking_celebration_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own ranking_celebration_grants" ON public.ranking_celebration_grants;
CREATE POLICY "Users read own ranking_celebration_grants"
  ON public.ranking_celebration_grants FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.ranking_celebration_grants IS
  '랭킹 축하 보너스 1회 지급 키: user + period_key(주/월/all) + type_tab + sort_by + category';

-- ─────────────────────────────────────────────
-- 3. RPC: 현재 집계 기준 순위가 TOP10일 때만 보너스 지급
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
    SELECT 1 FROM public.matchups m WHERE coalesce(m.total_votes, 0) > 0 LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_platform_activity');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
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

COMMENT ON FUNCTION public.claim_ranking_celebration_bonus(text, text, text, text) IS
  '랭킹 TOP10 축하 보너스 멱등 지급. period: weekly|monthly|all (서울 달력 기준 period_key).';

REVOKE ALL ON FUNCTION public.claim_ranking_celebration_bonus(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ranking_celebration_bonus(text, text, text, text) TO authenticated;
