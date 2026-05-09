-- =============================================
-- 출석: 7·14·21…일째 연속 출석 시 기본 10P + 보너스 70P (총 80P)
-- 기존 DB에 한 번 실행해 check_attendance 함수를 교체하세요.
--
-- insert_point_transaction 이 있는 환경( supabase_point_expiration.sql 적용 )용입니다.
-- point_transactions 없이 v2만 쓰는 경우: supabase_points_system_v2.sql 의 동일 함수 블록을 실행하세요.
-- =============================================

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

  FOR i IN 1..365 LOOP
    IF NOT EXISTS (SELECT 1 FROM attendances WHERE user_id = v_user_id AND checked_at = v_today - i) THEN
      EXIT;
    END IF;
    v_consecutive := v_consecutive + 1;
  END LOOP;

  IF v_consecutive >= 7 AND (v_consecutive % 7) = 0 THEN
    v_bonus := 70;
  END IF;
  v_total := v_base + v_bonus;

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

  PERFORM insert_point_transaction(v_user_id, v_total, 'attendance', NULL);

  RETURN jsonb_build_object(
    'ok', true,
    'points', v_total,
    'base', v_base,
    'bonus', v_bonus,
    'consecutive', v_consecutive
  );
END;
$$;
