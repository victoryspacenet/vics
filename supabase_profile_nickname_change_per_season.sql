-- =============================================
-- VICS — 닉네임 변경: 시즌당 1회 (public.seasons 기준)
-- 선행: supabase_seasons.sql (seasons 테이블)
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname_changed_season_number integer NULL;

COMMENT ON COLUMN public.profiles.nickname_changed_season_number IS
  '마지막으로 닉네임을 변경한 시즌 번호(public.seasons.number). 동일 시즌 내 재변경 시 BEFORE 트리거에서 거부.';

-- ─────────────────────────────────────────────
-- 닉네임 변경 시 시즌 1회 제한 (일반 사용자 JWT 경로)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_profile_nickname_once_per_season()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season integer;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.nickname IS NOT DISTINCT FROM OLD.nickname THEN
    RETURN NEW;
  END IF;

  -- 서비스 롤·마이그레이션 등 auth.uid() 없는 경로는 제한하지 않음
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.id THEN
    RETURN NEW;
  END IF;

  SELECT s.number INTO v_season
  FROM public.seasons s
  ORDER BY s.number DESC
  LIMIT 1;

  IF v_season IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.nickname_changed_season_number IS NOT NULL
     AND OLD.nickname_changed_season_number = v_season THEN
    RAISE EXCEPTION 'NICKNAME_CHANGE_SEASON_LIMIT'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.nickname_changed_season_number := v_season;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_profile_nickname_once_per_season() IS
  'profiles.nickname 변경 시 public.seasons 최신 number 기준 시즌당 1회만 허용.';

DROP TRIGGER IF EXISTS trg_profiles_nickname_season ON public.profiles;

CREATE TRIGGER trg_profiles_nickname_season
  BEFORE UPDATE OF nickname ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_nickname_once_per_season();
