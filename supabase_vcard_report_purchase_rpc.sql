-- =============================================
-- VICS — V-Report / V-Card 제작 포인트 차감 (RPC)
-- =============================================
-- 1,500P 차감 후 제작 연출 진행 (클라이언트). 감사 영수증 테이블 없음 — profiles.points만 갱신
-- 선행: profiles.points, (선택) season_points — supabase_points_system_v2.sql 등
-- Supabase SQL Editor에서 실행하세요.

CREATE OR REPLACE FUNCTION public.purchase_vcard_report ()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer := 1500;
  v_points integer;
  v_has_season boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT p.points INTO v_points
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '프로필을 찾을 수 없어요');
  END IF;

  IF v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', '포인트가 부족해요 (1,500 P 필요)');
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

  RETURN jsonb_build_object('ok', true, 'points_spent', v_cost);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_vcard_report () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_vcard_report () TO authenticated;

COMMENT ON FUNCTION public.purchase_vcard_report IS
  'V-Report V-Card 제작 — 1,500P/회 차감 (리워드 페이지 동일 가격)';
