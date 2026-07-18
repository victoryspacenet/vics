-- =============================================================================
-- VICS — 매치업 결과 포인트 정산 (투표 마감 후)
-- Supabase SQL Editor에서 실행하세요.
--
-- 문제: 기존 트리거는 right_type(도전 완료) 순간에만 정산 → 그때 total_votes=0 이면
--       Oracle/Champion 포인트가 영원히 0.
-- 해결: expires_at(투표 마감) 이후 + 투표 1건 이상일 때 1회 정산.
--       (도전자 몰수패·cron 백필 포함)
--
-- 선행: supabase_point_expiration.sql (insert_point_transaction)
--       supabase_champion_oracle_track_points.sql (champion_points 등)
-- =============================================================================

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS result_points_settled_at timestamptz;

COMMENT ON COLUMN public.matchups.result_points_settled_at IS
  '매치업 승/패/무 포인트 정산 완료 시각 (중복 지급 방지)';

CREATE INDEX IF NOT EXISTS matchups_result_settlement_due_idx
  ON public.matchups (expires_at)
  WHERE result_points_settled_at IS NULL
    AND right_type IS NOT NULL;

-- ─────────────────────────────────────────────
-- 정산 가능 여부
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.matchup_is_ready_for_result_settlement(m public.matchups)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.right_type IS NOT NULL
    AND m.result_points_settled_at IS NULL
    AND NOT COALESCE(m.is_demo, false)
    AND (
      m.challenger_forfeit_at IS NOT NULL
      OR (
        COALESCE(m.total_votes, 0) > 0
        AND m.expires_at IS NOT NULL
        AND m.expires_at <= now()
      )
    );
$$;

-- ─────────────────────────────────────────────
-- 단일 매치업 정산 (멱등)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_matchup_result_points(p_matchup_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matchups;
  v_winner text;
  v_has_votes boolean;
  v_creator_pts integer;
  v_creator_source text;
  v_has_season boolean;
  v_rec record;
  v_creator_rec record;
BEGIN
  SELECT * INTO m FROM public.matchups WHERE id = p_matchup_id FOR UPDATE;
  IF NOT FOUND OR NOT public.matchup_is_ready_for_result_settlement(m) THEN
    RETURN false;
  END IF;

  IF m.challenger_forfeit_at IS NOT NULL THEN
    v_winner := 'left';
  ELSIF m.left_votes = m.right_votes THEN
    v_winner := 'draw';
  ELSIF m.left_votes > m.right_votes THEN
    v_winner := 'left';
  ELSE
    v_winner := 'right';
  END IF;

  v_has_votes := COALESCE(m.total_votes, 0) > 0 OR m.challenger_forfeit_at IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  -- A. Creators (LEFT + RIGHT 도전자)
  IF v_has_votes THEN
    FOR v_creator_rec IN
      SELECT uid, creator_side
      FROM (
        SELECT m.user_id AS uid, 'left'::text AS creator_side
        UNION ALL
        SELECT m.right_user_id, 'right'::text
        WHERE m.right_user_id IS NOT NULL
      ) sides
      WHERE uid IS NOT NULL
    LOOP
      v_creator_pts := CASE
        WHEN v_winner = 'draw' THEN 30
        WHEN v_winner = v_creator_rec.creator_side THEN 50
        ELSE 10
      END;
      v_creator_source := CASE
        WHEN v_winner = 'draw' THEN 'creator_draw'
        WHEN v_winner = v_creator_rec.creator_side THEN 'creator_win'
        ELSE 'creator_lose'
      END;

      IF NOT EXISTS (
        SELECT 1 FROM public.point_transactions pt
        WHERE pt.user_id = v_creator_rec.uid
          AND pt.related_id = m.id
          AND pt.source IN ('creator_win', 'creator_lose', 'creator_draw')
          AND pt.reversed_at IS NULL
      ) THEN
        IF v_winner = v_creator_rec.creator_side THEN
          IF v_has_season THEN
            UPDATE public.profiles
            SET creator_wins = creator_wins + 1,
                creator_win_streak = creator_win_streak + 1,
                creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
                season_creator_wins = season_creator_wins + 1,
                champion_points = champion_points + v_creator_pts,
                season_champion_points = season_champion_points + v_creator_pts,
                points = points + v_creator_pts,
                season_points = season_points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          ELSE
            UPDATE public.profiles
            SET creator_wins = creator_wins + 1,
                creator_win_streak = creator_win_streak + 1,
                creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
                champion_points = champion_points + v_creator_pts,
                points = points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          END IF;
        ELSIF v_winner = 'draw' THEN
          IF v_has_season THEN
            UPDATE public.profiles
            SET champion_points = champion_points + v_creator_pts,
                season_champion_points = season_champion_points + v_creator_pts,
                points = points + v_creator_pts,
                season_points = season_points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          ELSE
            UPDATE public.profiles
            SET champion_points = champion_points + v_creator_pts,
                points = points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          END IF;
        ELSE
          IF v_has_season THEN
            UPDATE public.profiles
            SET creator_win_streak = 0,
                champion_points = champion_points + v_creator_pts,
                season_champion_points = season_champion_points + v_creator_pts,
                points = points + v_creator_pts,
                season_points = season_points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          ELSE
            UPDATE public.profiles
            SET creator_win_streak = 0,
                champion_points = champion_points + v_creator_pts,
                points = points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          END IF;
        END IF;
        PERFORM public.insert_point_transaction(v_creator_rec.uid, v_creator_pts, v_creator_source, m.id);
      END IF;
    END LOOP;
  END IF;

  -- B. Voters — 모든 투표(본인 생성·참여 매치업 포함), 실제 투표가 있을 때만
  IF COALESCE(m.total_votes, 0) > 0 THEN
    FOR v_rec IN
      SELECT v.user_id, v.side,
        CASE
          WHEN v_winner = 'draw' THEN 15
          WHEN v.side = v_winner THEN 25
          ELSE 5
        END AS pts,
        CASE
          WHEN v_winner = 'draw' THEN 'voter_draw'
          WHEN v.side = v_winner THEN 'voter_win'
          ELSE 'voter_lose'
        END AS src
      FROM public.votes v
      WHERE v.matchup_id = m.id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.point_transactions pt
        WHERE pt.user_id = v_rec.user_id
          AND pt.related_id = m.id
          AND pt.source IN ('voter_win', 'voter_lose', 'voter_draw')
          AND pt.reversed_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      IF v_has_season THEN
        UPDATE public.profiles
        SET vote_total = vote_total + 1,
            vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_rec.side = v_winner THEN 1 ELSE 0 END,
            oracle_points = oracle_points + v_rec.pts,
            points = points + v_rec.pts,
            season_vote_total = season_vote_total + 1,
            season_vote_hits = season_vote_hits + CASE WHEN v_winner != 'draw' AND v_rec.side = v_winner THEN 1 ELSE 0 END,
            season_oracle_points = season_oracle_points + v_rec.pts,
            season_points = season_points + v_rec.pts,
            updated_at = now()
        WHERE id = v_rec.user_id;
      ELSE
        UPDATE public.profiles
        SET vote_total = vote_total + 1,
            vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_rec.side = v_winner THEN 1 ELSE 0 END,
            oracle_points = oracle_points + v_rec.pts,
            points = points + v_rec.pts,
            updated_at = now()
        WHERE id = v_rec.user_id;
      END IF;
      PERFORM public.insert_point_transaction(v_rec.user_id, v_rec.pts, v_rec.src, m.id);
    END LOOP;
  END IF;

  UPDATE public.matchups
  SET result_points_settled_at = now(),
      updated_at = now()
  WHERE id = m.id;

  RETURN true;
END;
$$;

-- ─────────────────────────────────────────────
-- 마감 도래 매치업 일괄 정산 (cron·수동 백필)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_all_due_matchup_results()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_id IN
    SELECT m.id
    FROM public.matchups m
    WHERE public.matchup_is_ready_for_result_settlement(m)
    ORDER BY m.expires_at NULLS LAST, m.id
    LIMIT 500
  LOOP
    IF public.settle_matchup_result_points(v_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────
-- 트리거: 투표 수·마감 시각 변경 시 정산 시도
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.try_settle_matchup_result_points_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.matchup_is_ready_for_result_settlement(NEW) THEN
    PERFORM public.settle_matchup_result_points(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_matchup_complete_dual_ranking ON public.matchups;
DROP TRIGGER IF EXISTS on_matchup_try_result_settlement ON public.matchups;

CREATE TRIGGER on_matchup_try_result_settlement
  AFTER INSERT OR UPDATE OF right_type, total_votes, left_votes, right_votes, expires_at, challenger_forfeit_at
  ON public.matchups
  FOR EACH ROW
  EXECUTE FUNCTION public.try_settle_matchup_result_points_trigger();

-- 구버전 right_type 전용 함수는 no-op (혼선 방지)
CREATE OR REPLACE FUNCTION public.update_dual_ranking_on_matchup_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF public.matchup_is_ready_for_result_settlement(NEW) THEN
    PERFORM public.settle_matchup_result_points(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.settle_matchup_result_points(uuid) IS
  '매치업 1건 승/패/무 포인트 정산 — 투표 마감 후 1회, Champion 50/10/30 · Oracle 25/5/15';
COMMENT ON FUNCTION public.settle_all_due_matchup_results() IS
  '마감된 미정산 매치업 일괄 정산. pg_cron 또는 수동 실행.';

-- ─────────────────────────────────────────────
-- 백필: 참여자(본인 생성·도전) Oracle 투표 정산 누락분
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.backfill_missing_oracle_vote_settlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_winner text;
  v_pts integer;
  v_src text;
  v_has_season boolean;
  v_count integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  FOR v_row IN
    SELECT
      m.id AS matchup_id,
      m.left_votes,
      m.right_votes,
      m.challenger_forfeit_at,
      v.user_id AS voter_id,
      v.side
    FROM public.votes v
    INNER JOIN public.matchups m ON m.id = v.matchup_id
    WHERE m.right_type IS NOT NULL
      AND NOT COALESCE(m.is_demo, false)
      AND COALESCE(m.total_votes, 0) > 0
      AND (
        m.result_points_settled_at IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.point_transactions pt
          WHERE pt.related_id = m.id
            AND pt.source IN ('creator_win', 'creator_lose', 'creator_draw')
            AND pt.reversed_at IS NULL
        )
        OR (m.expires_at IS NOT NULL AND m.expires_at <= now())
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.point_transactions pt
        WHERE pt.user_id = v.user_id
          AND pt.related_id = m.id
          AND pt.source IN ('voter_win', 'voter_lose', 'voter_draw')
          AND pt.reversed_at IS NULL
      )
  LOOP
    IF v_row.challenger_forfeit_at IS NOT NULL THEN
      v_winner := 'left';
    ELSIF v_row.left_votes = v_row.right_votes THEN
      v_winner := 'draw';
    ELSIF v_row.left_votes > v_row.right_votes THEN
      v_winner := 'left';
    ELSE
      v_winner := 'right';
    END IF;

    v_pts := CASE
      WHEN v_winner = 'draw' THEN 15
      WHEN v_row.side = v_winner THEN 25
      ELSE 5
    END;
    v_src := CASE
      WHEN v_winner = 'draw' THEN 'voter_draw'
      WHEN v_row.side = v_winner THEN 'voter_win'
      ELSE 'voter_lose'
    END;

    IF v_has_season THEN
      UPDATE public.profiles
      SET vote_total = vote_total + 1,
          vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_row.side = v_winner THEN 1 ELSE 0 END,
          oracle_points = oracle_points + v_pts,
          points = points + v_pts,
          season_vote_total = season_vote_total + 1,
          season_vote_hits = season_vote_hits + CASE WHEN v_winner != 'draw' AND v_row.side = v_winner THEN 1 ELSE 0 END,
          season_oracle_points = season_oracle_points + v_pts,
          season_points = season_points + v_pts,
          updated_at = now()
      WHERE id = v_row.voter_id;
    ELSE
      UPDATE public.profiles
      SET vote_total = vote_total + 1,
          vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_row.side = v_winner THEN 1 ELSE 0 END,
          oracle_points = oracle_points + v_pts,
          points = points + v_pts,
          updated_at = now()
      WHERE id = v_row.voter_id;
    END IF;

    PERFORM public.insert_point_transaction(v_row.voter_id, v_pts, v_src, v_row.matchup_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.backfill_missing_oracle_vote_settlements() IS
  '완료·정산된 매치업 중 Oracle 투표 정산이 누락된 건(본인 생성·참여 투표 포함) 1회 백필';

REVOKE ALL ON FUNCTION public.backfill_missing_oracle_vote_settlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_missing_oracle_vote_settlements() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.settle_matchup_result_points(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_all_due_matchup_results() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_matchup_result_points(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_all_due_matchup_results() TO authenticated, service_role;

-- ─────────────────────────────────────────────
-- 기존 완료·마감 매치업 1회 백필
-- ─────────────────────────────────────────────
SELECT public.backfill_missing_oracle_vote_settlements() AS backfilled_participant_oracle_votes;
SELECT public.settle_all_due_matchup_results() AS settled_matchups;

-- 트랙 포인트·집계 재계산 (champion_oracle_track_points.sql 과 동일)
UPDATE public.profiles p
SET champion_points = COALESCE((
  SELECT SUM(pt.amount)::integer FROM public.point_transactions pt
  WHERE pt.user_id = p.id AND pt.reversed_at IS NULL
    AND pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
), 0);

UPDATE public.profiles p
SET oracle_points = COALESCE((
  SELECT SUM(pt.amount)::integer FROM public.point_transactions pt
  WHERE pt.user_id = p.id AND pt.reversed_at IS NULL
    AND pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
), 0);

UPDATE public.profiles p
SET
  vote_total = COALESCE(vt.cnt, 0),
  vote_hits = COALESCE(vh.hits, 0)
FROM public.profiles px
LEFT JOIN (
  SELECT user_id, COUNT(*)::integer AS cnt
  FROM public.point_transactions
  WHERE reversed_at IS NULL AND source IN ('voter_win', 'voter_lose', 'voter_draw')
  GROUP BY user_id
) vt ON vt.user_id = px.id
LEFT JOIN (
  SELECT user_id, COUNT(*)::integer AS hits
  FROM public.point_transactions
  WHERE reversed_at IS NULL AND source = 'voter_win'
  GROUP BY user_id
) vh ON vh.user_id = px.id
WHERE p.id = px.id;

UPDATE public.profiles p
SET points = COALESCE((
  SELECT SUM(pt.amount)::integer FROM public.point_transactions pt
  WHERE pt.user_id = p.id AND pt.reversed_at IS NULL
), 0);

DO $$
DECLARE
  v_season_start timestamptz;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_champion_points'
  ) THEN
    SELECT start_at INTO v_season_start
    FROM public.seasons
    WHERE start_at <= now() AND end_at > now()
    ORDER BY number DESC
    LIMIT 1;

    IF v_season_start IS NOT NULL THEN
      UPDATE public.profiles p
      SET season_champion_points = COALESCE((
        SELECT SUM(pt.amount)::integer
        FROM public.point_transactions pt
        WHERE pt.user_id = p.id
          AND pt.reversed_at IS NULL
          AND pt.created_at >= v_season_start
          AND pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
      ), 0);

      UPDATE public.profiles p
      SET season_oracle_points = COALESCE((
        SELECT SUM(pt.amount)::integer
        FROM public.point_transactions pt
        WHERE pt.user_id = p.id
          AND pt.reversed_at IS NULL
          AND pt.created_at >= v_season_start
          AND pt.source IN ('vote', 'voter_win', 'voter_lose', 'voter_draw')
      ), 0);

      UPDATE public.profiles p
      SET
        season_vote_total = COALESCE(svt.cnt, 0),
        season_vote_hits = COALESCE(svh.hits, 0)
      FROM public.profiles px
      LEFT JOIN (
        SELECT user_id, COUNT(*)::integer AS cnt
        FROM public.point_transactions
        WHERE reversed_at IS NULL
          AND created_at >= v_season_start
          AND source IN ('voter_win', 'voter_lose', 'voter_draw')
        GROUP BY user_id
      ) svt ON svt.user_id = px.id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::integer AS hits
        FROM public.point_transactions
        WHERE reversed_at IS NULL
          AND created_at >= v_season_start
          AND source = 'voter_win'
        GROUP BY user_id
      ) svh ON svh.user_id = px.id
      WHERE p.id = px.id;

      UPDATE public.profiles p
      SET season_points = COALESCE((
        SELECT SUM(pt.amount)::integer
        FROM public.point_transactions pt
        WHERE pt.user_id = p.id
          AND pt.reversed_at IS NULL
          AND pt.created_at >= v_season_start
      ), 0);
    END IF;
  END IF;
END $$;
