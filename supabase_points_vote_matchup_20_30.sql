-- 투표 20P·매치업 생성 30P — 실제 지급 (배포 DB에 함수 재적용)
--
-- point_transactions / insert_point_transaction 를 쓰는 경우( supabase_point_expiration 적용 ):
--   이 파일 전체를 Supabase SQL에서 실행하세요.
--
-- insert_point_transaction 이 없는 경우( v2 만 적용 ):
--   supabase_points_system_v2.sql 의 award_points_on_matchup_create / award_points_on_vote
--   두 함수 블록만 CREATE OR REPLACE 로 실행하세요.

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

  PERFORM insert_point_transaction(NEW.user_id, 30, 'matchup_create', NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    PERFORM insert_point_transaction(NEW.user_id, 20, 'vote', NEW.id);

  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.point_transactions
      WHERE user_id = OLD.user_id AND source = 'vote' AND related_id = OLD.id AND reversed_at IS NULL
    ) THEN
      UPDATE public.point_transactions
      SET reversed_at = now()
      WHERE user_id = OLD.user_id AND source = 'vote' AND related_id = OLD.id AND reversed_at IS NULL;

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
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
