-- =============================================
-- VICS — Champion / Oracle 트랙 포인트 분리
-- Supabase SQL Editor에서 실행하세요.
--
-- 문제: profiles.points(합산)만으로 Champion·Oracle 랭킹을 정렬하면 두 탭 값이 동일하게 보임.
-- 해결: champion_points(생성자 트랙) 컬럼 추가 + 정산 트리거·역정산·백필.
--
-- Creator 결과: 승 50P / 패 10P / 무 30P → champion_points + points
--   LEFT(user_id)·RIGHT(right_user_id 도전자) 각각 본인 측 기준 정산
-- Voter 결과:   적중 25P / 패 5P / 무 15P → oracle_points + points
--   본인 생성(LEFT·RIGHT 참여) 매치업 투표도 Oracle 정산에 포함
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS champion_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_champion_points integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS profiles_champion_points_idx ON public.profiles(champion_points DESC);
CREATE INDEX IF NOT EXISTS profiles_season_champion_points_idx ON public.profiles(season_champion_points DESC);

-- ─────────────────────────────────────────────
-- 매치업 완료 정산 (point_expiration.sql 기준 + champion_points)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_dual_ranking_on_matchup_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_winner text;
  v_has_votes boolean;
  v_creator_pts integer;
  v_creator_source text;
  v_has_season boolean;
  v_rec record;
  v_creator_rec record;
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.right_type IS NOT NULL AND (OLD.right_type IS NULL OR OLD.right_type IS DISTINCT FROM NEW.right_type) THEN
    v_has_votes := (COALESCE(NEW.total_votes, 0) > 0);

    IF NEW.left_votes = NEW.right_votes THEN v_winner := 'draw';
    ELSIF NEW.left_votes > NEW.right_votes THEN v_winner := 'left';
    ELSE v_winner := 'right'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
    ) INTO v_has_season;

    -- A. Creators — LEFT(user_id) + RIGHT(right_user_id 도전자), 각자 본인 측 승/패/무
    IF v_has_votes THEN
      FOR v_creator_rec IN
        SELECT uid, creator_side
        FROM (
          SELECT NEW.user_id AS uid, 'left'::text AS creator_side
          UNION ALL
          SELECT NEW.right_user_id, 'right'::text
          WHERE NEW.right_user_id IS NOT NULL
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

        IF v_winner != 'draw' THEN
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
        ELSE
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
        END IF;
        PERFORM insert_point_transaction(v_creator_rec.uid, v_creator_pts, v_creator_source, NEW.id);
      END LOOP;
    END IF;

    -- B. Voter — 모든 투표(본인 생성·참여 매치업 포함)
    IF v_has_votes THEN
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
        WHERE v.matchup_id = NEW.id
      LOOP
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
        PERFORM insert_point_transaction(v_rec.user_id, v_rec.pts, v_rec.src, NEW.id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_matchup_complete_dual_ranking ON public.matchups;
CREATE TRIGGER on_matchup_complete_dual_ranking
  AFTER UPDATE ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION public.update_dual_ranking_on_matchup_complete();

-- ─────────────────────────────────────────────
-- 매치업 삭제 시 champion_points 역정산
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invalidate_points_on_matchup_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_rec record;
  v_has_season boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  FOR v_rec IN
    SELECT id, user_id, amount FROM public.point_transactions
    WHERE source = 'matchup_create' AND related_id = OLD.id AND reversed_at IS NULL
  LOOP
    UPDATE public.point_transactions SET reversed_at = now() WHERE id = v_rec.id;
    IF v_has_season THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - v_rec.amount),
          season_points = GREATEST(0, season_points - v_rec.amount),
          champion_points = GREATEST(0, champion_points - v_rec.amount),
          season_champion_points = GREATEST(0, season_champion_points - v_rec.amount),
          total_matchups = GREATEST(0, total_matchups - 1),
          updated_at = now()
      WHERE id = v_rec.user_id;
    ELSE
      UPDATE public.profiles
      SET points = GREATEST(0, points - v_rec.amount),
          champion_points = GREATEST(0, champion_points - v_rec.amount),
          total_matchups = GREATEST(0, total_matchups - 1),
          updated_at = now()
      WHERE id = v_rec.user_id;
    END IF;
  END LOOP;

  FOR v_rec IN
    SELECT id, user_id, amount, source FROM public.point_transactions
    WHERE source IN ('creator_win', 'creator_lose', 'creator_draw')
      AND related_id = OLD.id AND reversed_at IS NULL
  LOOP
    UPDATE public.point_transactions SET reversed_at = now() WHERE id = v_rec.id;
    IF v_has_season THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - v_rec.amount),
          season_points = GREATEST(0, season_points - v_rec.amount),
          champion_points = GREATEST(0, champion_points - v_rec.amount),
          season_champion_points = GREATEST(0, season_champion_points - v_rec.amount),
          creator_wins = GREATEST(0, creator_wins - CASE WHEN v_rec.source = 'creator_win' THEN 1 ELSE 0 END),
          season_creator_wins = GREATEST(0, season_creator_wins - CASE WHEN v_rec.source = 'creator_win' THEN 1 ELSE 0 END),
          updated_at = now()
      WHERE id = v_rec.user_id;
    ELSE
      UPDATE public.profiles
      SET points = GREATEST(0, points - v_rec.amount),
          champion_points = GREATEST(0, champion_points - v_rec.amount),
          creator_wins = GREATEST(0, creator_wins - CASE WHEN v_rec.source = 'creator_win' THEN 1 ELSE 0 END),
          updated_at = now()
      WHERE id = v_rec.user_id;
    END IF;
  END LOOP;

  FOR v_rec IN
    SELECT id, user_id, amount FROM public.point_transactions
    WHERE source IN ('voter_win', 'voter_lose', 'voter_draw')
      AND related_id = OLD.id AND reversed_at IS NULL
  LOOP
    UPDATE public.point_transactions SET reversed_at = now() WHERE id = v_rec.id;
    IF v_has_season THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - v_rec.amount),
          season_points = GREATEST(0, season_points - v_rec.amount),
          vote_total = GREATEST(0, vote_total - 1),
          season_vote_total = GREATEST(0, season_vote_total - 1),
          vote_hits = GREATEST(0, vote_hits - CASE WHEN v_rec.source = 'voter_win' THEN 1 ELSE 0 END),
          season_vote_hits = GREATEST(0, season_vote_hits - CASE WHEN v_rec.source = 'voter_win' THEN 1 ELSE 0 END),
          oracle_points = GREATEST(0, oracle_points - v_rec.amount),
          season_oracle_points = GREATEST(0, season_oracle_points - v_rec.amount),
          updated_at = now()
      WHERE id = v_rec.user_id;
    ELSE
      UPDATE public.profiles
      SET points = GREATEST(0, points - v_rec.amount),
          vote_total = GREATEST(0, vote_total - 1),
          vote_hits = GREATEST(0, vote_hits - CASE WHEN v_rec.source = 'voter_win' THEN 1 ELSE 0 END),
          oracle_points = GREATEST(0, oracle_points - v_rec.amount),
          updated_at = now()
      WHERE id = v_rec.user_id;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────
-- 백필: 과거 데이터 보정
-- 1) RIGHT(도전자) 생성자 정산 누락분 보충
-- 2) 참여자 Oracle 투표 정산 누락분 — backfill_missing_oracle_vote_settlements()
-- 3) 트랙 포인트·프로필 집계 재계산
--    (1·2는 supabase_matchup_result_settlement.sql 실행 시 함께 적용 가능)
-- ─────────────────────────────────────────────
DO $$
DECLARE
  v_has_season boolean;
  v_m record;
  v_winner text;
  v_pts integer;
  v_source text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  -- 1) RIGHT 도전자 생성자 정산 누락 보충
  FOR v_m IN
    SELECT id, right_user_id, left_votes, right_votes
    FROM public.matchups
    WHERE right_type IS NOT NULL
      AND COALESCE(is_demo, false) = false
      AND right_user_id IS NOT NULL
      AND COALESCE(total_votes, 0) > 0
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

    IF v_m.left_votes = v_m.right_votes THEN v_winner := 'draw';
    ELSIF v_m.left_votes > v_m.right_votes THEN v_winner := 'left';
    ELSE v_winner := 'right'; END IF;

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

    IF v_winner != 'draw' THEN
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
    ELSE
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
    END IF;

    PERFORM insert_point_transaction(v_m.right_user_id, v_pts, v_source, v_m.id);
  END LOOP;
END $$;

-- 3) 거래 내역 기준 트랙 포인트·투표 집계 재계산
UPDATE public.profiles p
SET champion_points = COALESCE((
  SELECT SUM(pt.amount)::integer
  FROM public.point_transactions pt
  WHERE pt.user_id = p.id
    AND pt.reversed_at IS NULL
    AND pt.source IN ('matchup_create', 'creator_win', 'creator_lose', 'creator_draw')
), 0);

UPDATE public.profiles p
SET oracle_points = COALESCE((
  SELECT SUM(pt.amount)::integer
  FROM public.point_transactions pt
  WHERE pt.user_id = p.id
    AND pt.reversed_at IS NULL
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
  SELECT SUM(pt.amount)::integer
  FROM public.point_transactions pt
  WHERE pt.user_id = p.id AND pt.reversed_at IS NULL
), 0);

-- 시즌 컬럼이 있으면 현재 시즌 구간만 재계산
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
    END IF;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.champion_points IS 'The Champion 트랙 누적 P (생성·결과 정산)';
COMMENT ON COLUMN public.profiles.season_champion_points IS '현재 시즌 Champion 트랙 P';

-- 시즌 초기화 함수에 season_champion_points 포함
CREATE OR REPLACE FUNCTION public.reset_season_stats()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET
    season_points = 0,
    season_total_votes_received = 0,
    season_vote_hits = 0,
    season_vote_total = 0,
    season_creator_wins = 0,
    season_champion_points = 0,
    season_oracle_points = 0,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
