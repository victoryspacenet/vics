-- =============================================
-- VICS - 포인트/레벨 시스템
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- ─────────────────────────────────────────────
-- 1. 매치업 생성 시 포인트 (+10pt) 및 total_matchups 카운트
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_points_on_matchup_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    points = points + 10,
    total_matchups = total_matchups + 1,
    updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_matchup_created_award_points ON public.matchups;
CREATE TRIGGER on_matchup_created_award_points
  AFTER INSERT ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION award_points_on_matchup_create();

-- ─────────────────────────────────────────────
-- 2. 투표 시 포인트
--    · 투표자 +2pt
--    · 매치업 작성자 +1pt (단, 자기 매치업에 투표한 경우 제외)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_points_on_vote()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 투표자에게 +2pt
    UPDATE public.profiles
    SET points = points + 2, updated_at = now()
    WHERE id = NEW.user_id;

    -- 매치업 작성자 조회
    SELECT user_id INTO v_creator_id
    FROM public.matchups WHERE id = NEW.matchup_id;

    -- 작성자가 자신이 아닐 때만 +1pt
    IF v_creator_id IS NOT NULL AND v_creator_id <> NEW.user_id THEN
      UPDATE public.profiles
      SET points = points + 1, updated_at = now()
      WHERE id = v_creator_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- 투표 취소 시 차감 (-2pt, 0 미만으로 내려가지 않게)
    UPDATE public.profiles
    SET points = GREATEST(0, points - 2), updated_at = now()
    WHERE id = OLD.user_id;

    SELECT user_id INTO v_creator_id
    FROM public.matchups WHERE id = OLD.matchup_id;

    IF v_creator_id IS NOT NULL AND v_creator_id <> OLD.user_id THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - 1), updated_at = now()
      WHERE id = v_creator_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vote_award_points ON public.votes;
CREATE TRIGGER on_vote_award_points
  AFTER INSERT OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION award_points_on_vote();

-- ─────────────────────────────────────────────
-- 3. 좋아요 시 포인트
--    · 매치업 작성자 +1pt (자기 좋아요 제외)
-- ─────────────────────────────────────────────
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
      SET points = points + 1, updated_at = now()
      WHERE id = v_creator_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_creator_id IS NOT NULL AND v_creator_id <> OLD.user_id THEN
      UPDATE public.profiles
      SET points = GREATEST(0, points - 1), updated_at = now()
      WHERE id = v_creator_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_award_points ON public.likes;
CREATE TRIGGER on_like_award_points
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION award_points_on_like();
