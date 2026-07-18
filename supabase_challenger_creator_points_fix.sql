-- =============================================================================
-- VICS — 도전자(RIGHT) Creator 포인트 정산 보정
-- Supabase SQL Editor에서 실행하세요.
--
-- 문제:
--   1) 구버전 정산은 LEFT(user_id)만 Creator 포인트 지급 → RIGHT(도전자) 누락
--   2) creator_wins가 패배 시에도 +1 되는 버그
--
-- 해결:
--   - settle_matchup_result_points: 승리 시에만 creator_wins 증가, 패배 시 streak 리셋
--   - backfill_missing_challenger_creator_settlements(): 누락분 1회 보충
--   - creator_wins·champion_points 재계산
--
-- 선행: supabase_matchup_result_settlement.sql (result_points_settled_at·정산 트리거)
-- =============================================================================

-- ─────────────────────────────────────────────
-- 정산 함수 — creator_wins 버그 수정 + LEFT/RIGHT 동일 규정
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

  -- A. Creators (LEFT + RIGHT 도전자) — 각자 본인 측 승 50 / 패 10 / 무 30
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

  -- B. Voters — 모든 투표(본인 생성·참여 매치업 포함)
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
-- RIGHT(도전자) Creator 정산 누락분 백필
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.backfill_missing_challenger_creator_settlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_season boolean;
  v_m record;
  v_winner text;
  v_pts integer;
  v_source text;
  v_count integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  FOR v_m IN
    SELECT id, right_user_id, left_votes, right_votes, challenger_forfeit_at
    FROM public.matchups
    WHERE right_type IS NOT NULL
      AND COALESCE(is_demo, false) = false
      AND right_user_id IS NOT NULL
      AND (
        COALESCE(total_votes, 0) > 0
        OR challenger_forfeit_at IS NOT NULL
      )
      AND (
        result_points_settled_at IS NOT NULL
        OR (expires_at IS NOT NULL AND expires_at <= now())
        OR challenger_forfeit_at IS NOT NULL
      )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.point_transactions
      WHERE user_id = v_m.right_user_id
        AND related_id = v_m.id
        AND source IN ('creator_win', 'creator_lose', 'creator_draw')
        AND reversed_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    IF v_m.challenger_forfeit_at IS NOT NULL THEN
      v_winner := 'left';
    ELSIF v_m.left_votes = v_m.right_votes THEN
      v_winner := 'draw';
    ELSIF v_m.left_votes > v_m.right_votes THEN
      v_winner := 'left';
    ELSE
      v_winner := 'right';
    END IF;

    v_pts := CASE
      WHEN v_winner = 'draw' THEN 30
      WHEN v_winner = 'right' THEN 50
      ELSE 10
    END;
    v_source := CASE
      WHEN v_winner = 'draw' THEN 'creator_draw'
      WHEN v_winner = 'right' THEN 'creator_win'
      ELSE 'creator_lose'
    END;

    IF v_winner = 'right' THEN
      IF v_has_season THEN
        UPDATE public.profiles
        SET creator_wins = creator_wins + 1,
            creator_win_streak = creator_win_streak + 1,
            creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
            season_creator_wins = season_creator_wins + 1,
            champion_points = champion_points + v_pts,
            season_champion_points = season_champion_points + v_pts,
            points = points + v_pts,
            season_points = season_points + v_pts,
            updated_at = now()
        WHERE id = v_m.right_user_id;
      ELSE
        UPDATE public.profiles
        SET creator_wins = creator_wins + 1,
            creator_win_streak = creator_win_streak + 1,
            creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
            champion_points = champion_points + v_pts,
            points = points + v_pts,
            updated_at = now()
        WHERE id = v_m.right_user_id;
      END IF;
    ELSIF v_winner = 'draw' THEN
      IF v_has_season THEN
        UPDATE public.profiles
        SET champion_points = champion_points + v_pts,
            season_champion_points = season_champion_points + v_pts,
            points = points + v_pts,
            season_points = season_points + v_pts,
            updated_at = now()
        WHERE id = v_m.right_user_id;
      ELSE
        UPDATE public.profiles
        SET champion_points = champion_points + v_pts,
            points = points + v_pts,
            updated_at = now()
        WHERE id = v_m.right_user_id;
      END IF;
    ELSE
      IF v_has_season THEN
        UPDATE public.profiles
        SET creator_win_streak = 0,
            champion_points = champion_points + v_pts,
            season_champion_points = season_champion_points + v_pts,
            points = points + v_pts,
            season_points = season_points + v_pts,
            updated_at = now()
        WHERE id = v_m.right_user_id;
      ELSE
        UPDATE public.profiles
        SET creator_win_streak = 0,
            champion_points = champion_points + v_pts,
            points = points + v_pts,
            updated_at = now()
        WHERE id = v_m.right_user_id;
      END IF;
    END IF;

    PERFORM public.insert_point_transaction(v_m.right_user_id, v_pts, v_source, v_m.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.backfill_missing_challenger_creator_settlements() IS
  'RIGHT(도전자) Creator 승/패/무 포인트 정산 누락분 1회 보충';

REVOKE ALL ON FUNCTION public.backfill_missing_challenger_creator_settlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_missing_challenger_creator_settlements() TO authenticated, service_role;

-- ─────────────────────────────────────────────
-- 1회 백필 + 집계 재계산
-- ─────────────────────────────────────────────
SELECT public.backfill_missing_challenger_creator_settlements() AS backfilled_challenger_creator;
SELECT public.settle_all_due_matchup_results() AS settled_due_matchups;

UPDATE public.profiles p
SET champion_points = COALESCE((
  SELECT SUM(pt.amount)::integer FROM public.point_transactions pt
  WHERE pt.user_id = p.id AND pt.reversed_at IS NULL
    AND pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
), 0);

UPDATE public.profiles p
SET creator_wins = COALESCE((
  SELECT COUNT(*)::integer FROM public.point_transactions pt
  WHERE pt.user_id = p.id AND pt.reversed_at IS NULL AND pt.source = 'creator_win'
), 0);

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
      SET season_creator_wins = COALESCE((
        SELECT COUNT(*)::integer
        FROM public.point_transactions pt
        WHERE pt.user_id = p.id
          AND pt.reversed_at IS NULL
          AND pt.created_at >= v_season_start
          AND pt.source = 'creator_win'
      ), 0);

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
