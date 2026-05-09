-- 메인 스포트라이트 — 포인트 차감 + 예약 (SECURITY DEFINER)
-- 노출: 6시간 / 전역 최대 6슬롯(1계정 1슬롯) / 동일 매치업 중복 노출 불가
-- 선행: supabase_main_spotlight_bookings.sql 실행 완료
-- Supabase SQL Editor에서 실행하세요

DROP POLICY IF EXISTS "Users can insert own main spotlight booking" ON public.main_spotlight_bookings;

CREATE OR REPLACE FUNCTION public.purchase_main_spotlight_1h(p_matchup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer := 5000;
  v_max_slots integer := 6;
  v_points integer;
  v_has_season boolean;
  v_matchup record;
  v_active_count integer;
  v_user_active integer;
  v_dup boolean;
  v_booking_id uuid;
  v_ends_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.main_spotlight_bookings b
    WHERE b.matchup_id = p_matchup_id AND b.ends_at > now()
  ) INTO v_dup;

  IF v_dup THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      '이 매치업은 이미 스포트라이트에 노출 중이에요. 종료 후 다시 구매할 수 있어요.'
    );
  END IF;

  SELECT COUNT(*)::integer
  INTO v_user_active
  FROM public.main_spotlight_bookings
  WHERE user_id = v_uid AND ends_at > now();

  IF v_user_active >= 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      '계정당 1건의 스포트라이트만 이용할 수 있어요. 종료 후 다시 구매해주세요.'
    );
  END IF;

  SELECT COUNT(*)::integer
  INTO v_active_count
  FROM public.main_spotlight_bookings
  WHERE ends_at > now();

  IF v_active_count >= v_max_slots THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      '전역 스포트라이트 슬롯 6개가 모두 사용 중이에요. 가장 빠른 종료 후 다시 시도해주세요.'
    );
  END IF;

  SELECT m.* INTO v_matchup
  FROM public.matchups m
  WHERE m.id = p_matchup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '매치업을 찾을 수 없어요');
  END IF;

  IF v_matchup.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', '내가 만든 매치업만 선택할 수 있어요');
  END IF;

  IF v_matchup.status IS DISTINCT FROM 'active' OR v_matchup.right_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '활성 상태이고 양쪽이 모두 채워진 매치업만 올릴 수 있어요');
  END IF;

  SELECT p.points INTO v_points
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '프로필을 찾을 수 없어요');
  END IF;

  IF v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', '포인트가 부족해요 (5,000 P 필요)');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE public.profiles
    SET
      points = points - v_cost,
      season_points = season_points - v_cost,
      updated_at = now()
    WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
    SET points = points - v_cost, updated_at = now()
    WHERE id = v_uid;
  END IF;

  INSERT INTO public.main_spotlight_bookings (user_id, matchup_id, starts_at, ends_at)
  VALUES (v_uid, p_matchup_id, now(), now() + interval '6 hours')
  RETURNING id, ends_at INTO v_booking_id, v_ends_at;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'ends_at', v_ends_at,
    'points_spent', v_cost
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_main_spotlight_1h(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_main_spotlight_1h(uuid) TO authenticated;

COMMENT ON FUNCTION public.purchase_main_spotlight_1h IS '메인 스포트라이트 6h 구매 — 5000P 차감 + 6시간 노출, 전역 최대 6슬롯·계정당 1슬롯';
