-- =============================================
-- VICS - 이원화 랭킹 시스템 (The Champion / The Oracle)
-- Supabase SQL Editor에서 실행하세요
--
-- 적용 후: Creator 랭킹(참여인원·승수·연승), Oracle 랭킹(적중률·적중P) 사용 가능
-- =============================================

-- ─────────────────────────────────────────────
-- 1. 프로필에 랭킹 트랙별 컬럼 추가
-- ─────────────────────────────────────────────

-- A. 매치업 생성자 (The Champion)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_wins integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_win_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_best_streak integer DEFAULT 0;

-- total_votes_received 는 이미 존재 (매치업에 받은 총 투표 수)

-- B. 매치업 투표자 (The Oracle)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vote_hits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vote_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oracle_points integer DEFAULT 0;

-- 적중률 (계산 컬럼, 0~100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hit_rate'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN hit_rate numeric GENERATED ALWAYS AS (
      CASE WHEN vote_total > 0 THEN ROUND((vote_hits::numeric / vote_total) * 100, 1) ELSE 0 END
    ) STORED;
  END IF;
END $$;

-- 인덱스 (랭킹 쿼리 최적화)
CREATE INDEX IF NOT EXISTS profiles_creator_wins_idx ON public.profiles(creator_wins DESC);
CREATE INDEX IF NOT EXISTS profiles_total_votes_received_idx ON public.profiles(total_votes_received DESC);
CREATE INDEX IF NOT EXISTS profiles_vote_hits_idx ON public.profiles(vote_hits DESC);
CREATE INDEX IF NOT EXISTS profiles_vote_total_idx ON public.profiles(vote_total DESC);
CREATE INDEX IF NOT EXISTS profiles_hit_rate_idx ON public.profiles(hit_rate DESC NULLS LAST);

-- ─────────────────────────────────────────────
-- 2. 매치업 완료 시 Creator/Voter 통계 업데이트
--    (right_type 이 null → not null 로 변경될 때)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_dual_ranking_on_matchup_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_winner text;
  v_creator_id uuid;
  v_has_votes boolean;
BEGIN
  -- right_type 이 새로 설정된 경우에만 (매치업 완료)
  IF NEW.right_type IS NOT NULL AND (OLD.right_type IS NULL OR OLD.right_type IS DISTINCT FROM NEW.right_type) THEN

    v_creator_id := NEW.user_id;
    v_has_votes := (COALESCE(NEW.total_votes, 0) > 0);

    -- 승자 결정 (50:50 무승부 시 creator_wins, vote_hits 미적용)
    IF NEW.left_votes = NEW.right_votes THEN
      v_winner := 'draw';
    ELSIF NEW.left_votes > NEW.right_votes THEN
      v_winner := 'left';
    ELSE
      v_winner := 'right';
    END IF;

    -- A. Creator: 완료된 매치업 + 투표 있음 + 무승부 아님 = creator_wins +1
    IF v_has_votes AND v_creator_id IS NOT NULL AND v_winner != 'draw' THEN
      UPDATE public.profiles
      SET
        creator_wins = creator_wins + 1,
        creator_win_streak = creator_win_streak + 1,
        creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
        updated_at = now()
      WHERE id = v_creator_id;
    END IF;

    -- B. Voter: 각 투표자에게 vote_total +1, 무승부가 아닐 때만 적중 시 vote_hits +1, oracle_points +보너스
    IF v_has_votes THEN
      UPDATE public.profiles p
      SET
        vote_total = p.vote_total + 1,
        vote_hits = p.vote_hits + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 1 ELSE 0 END,
        oracle_points = p.oracle_points + CASE WHEN v_winner != 'draw' AND v.side = v_winner THEN 5 ELSE 0 END,
        updated_at = now()
      FROM (SELECT user_id, side FROM public.votes WHERE matchup_id = NEW.id) v
      WHERE p.id = v.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_matchup_complete_dual_ranking ON public.matchups;
CREATE TRIGGER on_matchup_complete_dual_ranking
  AFTER UPDATE ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION update_dual_ranking_on_matchup_complete();

-- ─────────────────────────────────────────────
-- 2-2. 투표 시 creator의 total_votes_received 업데이트
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_creator_total_votes_received()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  SELECT user_id INTO v_creator_id FROM public.matchups WHERE id = COALESCE(NEW.matchup_id, OLD.matchup_id);
  IF v_creator_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET total_votes_received = total_votes_received + 1, updated_at = now() WHERE id = v_creator_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET total_votes_received = GREATEST(0, total_votes_received - 1), updated_at = now() WHERE id = v_creator_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vote_update_creator_votes_received ON public.votes;
CREATE TRIGGER on_vote_update_creator_votes_received
  AFTER INSERT OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION update_creator_total_votes_received();

-- ─────────────────────────────────────────────
-- 3. 기존 데이터 백필 (이미 완료된 매치업 기준)
-- ─────────────────────────────────────────────

-- total_votes_received 백필
UPDATE public.profiles p
SET total_votes_received = COALESCE(vr.cnt, 0)
FROM (
  SELECT m.user_id, SUM(m.total_votes)::int cnt
  FROM public.matchups m
  GROUP BY m.user_id
) vr
WHERE p.id = vr.user_id;

-- Creator 통계 백필
UPDATE public.profiles p
SET
  creator_wins = COALESCE(c.cnt, 0),
  creator_win_streak = COALESCE(c.cnt, 0),
  creator_best_streak = COALESCE(c.cnt, 0)
FROM (
  SELECT user_id, COUNT(*)::int cnt
  FROM public.matchups
  WHERE right_type IS NOT NULL AND total_votes > 0
  GROUP BY user_id
) c
WHERE p.id = c.user_id;

-- Voter 통계 백필
UPDATE public.profiles p
SET
  vote_total = COALESCE(vt.total, 0),
  vote_hits = COALESCE(vh.hits, 0),
  oracle_points = COALESCE(vh.hits, 0) * 5
FROM (
  SELECT v.user_id, COUNT(*)::int total
  FROM public.votes v
  JOIN public.matchups m ON m.id = v.matchup_id
  WHERE m.right_type IS NOT NULL AND m.total_votes > 0
  GROUP BY v.user_id
) vt
LEFT JOIN (
  SELECT v.user_id, COUNT(*)::int hits
  FROM public.votes v
  JOIN public.matchups m ON m.id = v.matchup_id
  WHERE m.right_type IS NOT NULL AND m.total_votes > 0
    AND v.side = CASE WHEN m.left_votes >= m.right_votes THEN 'left' ELSE 'right' END
  GROUP BY v.user_id
) vh ON vh.user_id = vt.user_id
WHERE p.id = vt.user_id;
