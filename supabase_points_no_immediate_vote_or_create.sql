-- 즉시 지급 제거: 투표 직후·매치업 생성 직후 포인트 없음
-- 승/패/무 정산은 기존 `update_dual_ranking_on_matchup_complete` 등 결과 확정 시 로직을 따름.
-- Supabase SQL Editor에서 실행하세요. (이미 배포된 `award_points_on_*` 정의를 덮어씁니다.)

CREATE OR REPLACE FUNCTION public.award_points_on_matchup_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    total_matchups = total_matchups + 1,
    updated_at = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_points_on_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_season boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 즉시 포인트·거래 내역 없음 (투표자 정산은 매치업 결과 반영 시)
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
    ) INTO v_has_season;

    IF EXISTS (
      SELECT 1 FROM public.point_transactions
      WHERE user_id = OLD.user_id AND source = 'vote' AND related_id = OLD.id AND reversed_at IS NULL
    ) THEN
      UPDATE public.point_transactions
      SET reversed_at = now()
      WHERE user_id = OLD.user_id AND source = 'vote' AND related_id = OLD.id AND reversed_at IS NULL;

      IF v_has_season THEN
        UPDATE public.profiles
        SET
          points = GREATEST(0, points - 20),
          season_points = GREATEST(0, season_points - 20),
          updated_at = now()
        WHERE id = OLD.user_id;
      ELSE
        UPDATE public.profiles
        SET points = GREATEST(0, points - 20), updated_at = now()
        WHERE id = OLD.user_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.award_points_on_matchup_create() IS '매치업 INSERT 시 total_matchups만 증가. 포인트는 결과 정산 시.';
COMMENT ON FUNCTION public.award_points_on_vote() IS '투표 INSERT 시 즉시 포인트 없음. DELETE 시 구버전 vote 거래가 있으면 20P 역정산.';
