-- =============================================
-- VICS - 포인트 제도 v2
-- Supabase SQL Editor에서 실행하세요
--
-- 적용 순서: supabase_points_system.sql, supabase_dual_ranking.sql, supabase_seasons.sql 이후
-- =============================================
--
-- 활동 항목          | 획득량 | 일일 제한 | 비고
-- ------------------|-------|----------|------
-- 출석 체크          | 10 P  | 1회      | 7일 연속 출석 시(매 7일마다) 보너스 70P
-- 투표 참여          | 20 P  | -        |
-- 매치업 생성        | 30 P  | -        |
-- Creator 결과       | 승 50P, 패 10P, 무 30P |
-- Voter 결과         | 적중 25P, 패 5P, 무 15P |
-- =============================================

-- ─────────────────────────────────────────────
-- 1. 출석 체크 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendances (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  checked_at date NOT NULL DEFAULT (current_date),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, checked_at)
);

CREATE INDEX IF NOT EXISTS attendances_user_date_idx ON public.attendances(user_id, checked_at DESC);

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attendances" ON public.attendances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attendance" ON public.attendances FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 출석 체크 RPC (일 1회 기본 10P, 7일째·14일째… 연속 시 +70P)
CREATE OR REPLACE FUNCTION public.check_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_exists boolean;
  v_consecutive integer := 1;
  v_base integer := 10;
  v_bonus integer := 0;
  v_total integer;
  v_has_season boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM attendances WHERE user_id = v_user_id AND checked_at = v_today
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', '오늘 이미 출석했어요', 'points', 0);
  END IF;

  INSERT INTO attendances (user_id, checked_at)
  VALUES (v_user_id, v_today);

  -- 연속 출석 일수 계산 (오늘 포함, 어제부터 역순으로)
  FOR i IN 1..365 LOOP
    IF NOT EXISTS (SELECT 1 FROM attendances WHERE user_id = v_user_id AND checked_at = v_today - i) THEN
      EXIT;
    END IF;
    v_consecutive := v_consecutive + 1;
  END LOOP;

  -- 7일·14일·… 연속 출석 당일: 보너스 70P (기본 10P와 별도 합산)
  IF v_consecutive >= 7 AND (v_consecutive % 7) = 0 THEN
    v_bonus := 70;
  END IF;
  v_total := v_base + v_bonus;

  -- season_points 컬럼 존재 여부
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE profiles
    SET points = points + v_total, season_points = season_points + v_total, updated_at = now()
    WHERE id = v_user_id;
  ELSE
    UPDATE profiles
    SET points = points + v_total, updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'points', v_total,
    'base', v_base,
    'bonus', v_bonus,
    'consecutive', v_consecutive
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 2. 매치업 생성 시 포인트 30P
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_points_on_matchup_create()
RETURNS TRIGGER AS $$
DECLARE
  v_has_season boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE public.profiles
    SET points = points + 30, total_matchups = total_matchups + 1,
        season_points = season_points + 30, updated_at = now()
    WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles
    SET points = points + 30, total_matchups = total_matchups + 1, updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 3. 투표 시 포인트 20P (투표자만, 작성자 지급 제거)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_points_on_vote()
RETURNS TRIGGER AS $$
DECLARE
  v_has_season boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF TG_OP = 'INSERT' THEN
    IF v_has_season THEN
      UPDATE public.profiles
      SET points = points + 20, season_points = season_points + 20, updated_at = now()
      WHERE id = NEW.user_id;
    ELSE
      UPDATE public.profiles
      SET points = points + 20, updated_at = now()
      WHERE id = NEW.user_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_has_season THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - 20), season_points = GREATEST(0, season_points - 20), updated_at = now()
      WHERE id = OLD.user_id;
    ELSE
      UPDATE public.profiles
      SET points = GREATEST(0, points - 20), updated_at = now()
      WHERE id = OLD.user_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 4. 좋아요 시 포인트 제거 (트리거 비활성화)
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_like_award_points ON public.likes;

-- ─────────────────────────────────────────────
-- 5. 매치업 완료 시 Creator/Voter 포인트 지급
--    Creator: 승 50P, 패 10P, 무 30P
--    Voter:   적중 25P, 패 5P, 무 15P
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_dual_ranking_on_matchup_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_winner text;
  v_creator_id uuid;
  v_has_votes boolean;
  v_creator_pts integer;
  v_has_season boolean;
BEGIN
  IF NEW.right_type IS NOT NULL AND (OLD.right_type IS NULL OR OLD.right_type IS DISTINCT FROM NEW.right_type) THEN
    v_creator_id := NEW.user_id;
    v_has_votes := (COALESCE(NEW.total_votes, 0) > 0);

    IF NEW.left_votes = NEW.right_votes THEN v_winner := 'draw';
    ELSIF NEW.left_votes > NEW.right_votes THEN v_winner := 'left';
    ELSE v_winner := 'right'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
    ) INTO v_has_season;

    -- A. Creator: creator_wins + 포인트 (승 50, 패 10, 무 30)
    IF v_has_votes AND v_creator_id IS NOT NULL THEN
      v_creator_pts := CASE
        WHEN v_winner = 'draw' THEN 30
        WHEN v_winner = 'left' THEN 50
        ELSE 10
      END;

      IF v_winner != 'draw' THEN
        IF v_has_season THEN
          UPDATE public.profiles
          SET creator_wins = creator_wins + 1,
              creator_win_streak = creator_win_streak + 1,
              creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
              season_creator_wins = season_creator_wins + 1,
              points = points + v_creator_pts,
              season_points = season_points + v_creator_pts,
              updated_at = now()
          WHERE id = v_creator_id;
        ELSE
          UPDATE public.profiles
          SET creator_wins = creator_wins + 1,
              creator_win_streak = creator_win_streak + 1,
              creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
              points = points + v_creator_pts,
              updated_at = now()
          WHERE id = v_creator_id;
        END IF;
      ELSE
        IF v_has_season THEN
          UPDATE public.profiles
          SET points = points + v_creator_pts, season_points = season_points + v_creator_pts, updated_at = now()
          WHERE id = v_creator_id;
        ELSE
          UPDATE public.profiles
          SET points = points + v_creator_pts, updated_at = now()
          WHERE id = v_creator_id;
        END IF;
      END IF;
    END IF;

    -- B. Voter: vote_total, vote_hits, oracle_points + 포인트 (적중 25, 패 5, 무 15)
    IF v_has_votes THEN
      UPDATE public.profiles p
      SET
        vote_total = p.vote_total + 1,
        vote_hits = p.vote_hits + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 1 ELSE 0 END,
        oracle_points = p.oracle_points + CASE
          WHEN v_winner = 'draw' THEN 15
          WHEN v.side = v_winner THEN 25
          ELSE 5
        END,
        points = p.points + CASE
          WHEN v_winner = 'draw' THEN 15
          WHEN v.side = v_winner THEN 25
          ELSE 5
        END,
        updated_at = now()
      FROM (SELECT user_id, side FROM public.votes WHERE matchup_id = NEW.id) v
      WHERE p.id = v.user_id;

      IF v_has_season THEN
        UPDATE public.profiles p
        SET
          season_vote_total = p.season_vote_total + 1,
          season_vote_hits = p.season_vote_hits + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 1 ELSE 0 END,
          season_oracle_points = p.season_oracle_points + CASE
            WHEN v_winner = 'draw' THEN 15
            WHEN v.side = v_winner THEN 25
            ELSE 5
          END,
          season_points = p.season_points + CASE
            WHEN v_winner = 'draw' THEN 15
            WHEN v.side = v_winner THEN 25
            ELSE 5
          END,
          updated_at = now()
        FROM (SELECT user_id, side FROM public.votes WHERE matchup_id = NEW.id) v
        WHERE p.id = v.user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
