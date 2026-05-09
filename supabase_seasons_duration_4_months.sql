-- =============================================
-- 기존 배포용: 시즌 길이를 4개월로 통일
-- (이미 supabase_seasons.sql을 적용한 DB에서 한 번 실행)
-- 새 프로젝트는 supabase_seasons.sql만 적용하면 됩니다.
-- =============================================

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
