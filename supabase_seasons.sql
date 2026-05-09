-- =============================================
-- VICS - 시즌제 운영 (4개월 단위)
-- Supabase SQL Editor에서 실행하세요
--
-- 적용 후: 시즌별 랭킹 초기화, 전체/시즌 탭 지원
-- =============================================

-- ─────────────────────────────────────────────
-- 1. 시즌 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  number integer NOT NULL UNIQUE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 시즌 1 기본 데이터 (4개월)
INSERT INTO public.seasons (number, start_at, end_at)
VALUES (
  1,
  date_trunc('month', now())::timestamptz,
  date_trunc('month', now())::timestamptz + interval '4 months'
)
ON CONFLICT (number) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. 프로필에 시즌별 컬럼 추가
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS season_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_total_votes_received integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_vote_hits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_vote_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_creator_wins integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_oracle_points integer DEFAULT 0;

-- 시즌 적중률 (계산 컬럼)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_hit_rate'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN season_hit_rate numeric GENERATED ALWAYS AS (
      CASE WHEN season_vote_total > 0 THEN ROUND((season_vote_hits::numeric / season_vote_total) * 100, 1) ELSE 0 END
    ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_season_points_idx ON public.profiles(season_points DESC);
CREATE INDEX IF NOT EXISTS profiles_season_total_votes_received_idx ON public.profiles(season_total_votes_received DESC);
CREATE INDEX IF NOT EXISTS profiles_season_hit_rate_idx ON public.profiles(season_hit_rate DESC NULLS LAST);

-- ─────────────────────────────────────────────
-- 3. 기존 트리거 함수 수정 - 시즌 컬럼도 함께 업데이트
-- (supabase_points_system.sql, supabase_dual_ranking.sql 적용 후 실행)
-- ─────────────────────────────────────────────

-- 3-1. 매치업 생성 시 포인트 + 시즌 포인트
CREATE OR REPLACE FUNCTION award_points_on_matchup_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    points = points + 10,
    total_matchups = total_matchups + 1,
    season_points = season_points + 10,
    updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-2. 투표 시 포인트 + 시즌 포인트
CREATE OR REPLACE FUNCTION award_points_on_vote()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET points = points + 2, season_points = season_points + 2, updated_at = now()
    WHERE id = NEW.user_id;

    SELECT user_id INTO v_creator_id FROM public.matchups WHERE id = NEW.matchup_id;
    IF v_creator_id IS NOT NULL AND v_creator_id <> NEW.user_id THEN
      UPDATE public.profiles
      SET points = points + 1, season_points = season_points + 1, updated_at = now()
      WHERE id = v_creator_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET points = GREATEST(0, points - 2), season_points = GREATEST(0, season_points - 2), updated_at = now()
    WHERE id = OLD.user_id;

    SELECT user_id INTO v_creator_id FROM public.matchups WHERE id = OLD.matchup_id;
    IF v_creator_id IS NOT NULL AND v_creator_id <> OLD.user_id THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - 1), season_points = GREATEST(0, season_points - 1), updated_at = now()
      WHERE id = v_creator_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-3. 좋아요 시 포인트 + 시즌 포인트
CREATE OR REPLACE FUNCTION award_points_on_like()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  SELECT user_id INTO v_creator_id
  FROM public.matchups WHERE id = COALESCE(NEW.matchup_id, OLD.matchup_id);

  IF TG_OP = 'INSERT' THEN
    IF v_creator_id IS NOT NULL AND v_creator_id <> NEW.user_id THEN
      UPDATE public.profiles
      SET points = points + 1, season_points = season_points + 1, updated_at = now()
      WHERE id = v_creator_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF v_creator_id IS NOT NULL AND v_creator_id <> OLD.user_id THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - 1), season_points = GREATEST(0, season_points - 1), updated_at = now()
      WHERE id = v_creator_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-4. 매치업 완료 시 Creator/Voter + 시즌 통계
CREATE OR REPLACE FUNCTION update_dual_ranking_on_matchup_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_winner text;
  v_creator_id uuid;
  v_has_votes boolean;
BEGIN
  IF NEW.right_type IS NOT NULL AND (OLD.right_type IS NULL OR OLD.right_type IS DISTINCT FROM NEW.right_type) THEN
    v_creator_id := NEW.user_id;
    v_has_votes := (COALESCE(NEW.total_votes, 0) > 0);

    IF NEW.left_votes = NEW.right_votes THEN v_winner := 'draw';
    ELSIF NEW.left_votes > NEW.right_votes THEN v_winner := 'left'; ELSE v_winner := 'right'; END IF;

    IF v_has_votes AND v_creator_id IS NOT NULL AND v_winner != 'draw' THEN
      UPDATE public.profiles
      SET
        creator_wins = creator_wins + 1,
        creator_win_streak = creator_win_streak + 1,
        creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
        season_creator_wins = season_creator_wins + 1,
        updated_at = now()
      WHERE id = v_creator_id;
    END IF;

    IF v_has_votes THEN
      UPDATE public.profiles p
      SET
        vote_total = p.vote_total + 1,
        vote_hits = p.vote_hits + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 1 ELSE 0 END,
        oracle_points = p.oracle_points + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 5 ELSE 0 END,
        season_vote_total = p.season_vote_total + 1,
        season_vote_hits = p.season_vote_hits + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 1 ELSE 0 END,
        season_oracle_points = p.season_oracle_points + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 5 ELSE 0 END,
        updated_at = now()
      FROM (SELECT user_id, side FROM public.votes WHERE matchup_id = NEW.id) v
      WHERE p.id = v.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-5. 투표 시 creator의 total_votes_received + 시즌
CREATE OR REPLACE FUNCTION update_creator_total_votes_received()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  SELECT user_id INTO v_creator_id FROM public.matchups WHERE id = COALESCE(NEW.matchup_id, OLD.matchup_id);
  IF v_creator_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET
      total_votes_received = total_votes_received + 1,
      season_total_votes_received = season_total_votes_received + 1,
      updated_at = now()
    WHERE id = v_creator_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET
      total_votes_received = GREATEST(0, total_votes_received - 1),
      season_total_votes_received = GREATEST(0, season_total_votes_received - 1),
      updated_at = now()
    WHERE id = v_creator_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 4. 시즌 초기화 함수 (시즌 종료 시 cron 등에서 실행)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_season_stats()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET
    season_points = 0,
    season_total_votes_received = 0,
    season_vote_hits = 0,
    season_vote_total = 0,
    season_creator_wins = 0,
    season_oracle_points = 0,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 새 시즌 시작: 시즌 테이블에 추가 + 통계 초기화
CREATE OR REPLACE FUNCTION start_new_season()
RETURNS integer AS $$
DECLARE
  v_next_number integer;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  SELECT COALESCE(MAX(number), 0) + 1 INTO v_next_number FROM public.seasons;
  v_start := date_trunc('month', now())::timestamptz;
  v_end := v_start + interval '4 months';

  INSERT INTO public.seasons (number, start_at, end_at)
  VALUES (v_next_number, v_start, v_end);

  PERFORM reset_season_stats();

  RETURN v_next_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons are viewable by everyone" ON public.seasons FOR SELECT USING (true);

-- 시즌 종료 시 자동 전환(pg_cron 등): supabase_season_roll_cron.sql
