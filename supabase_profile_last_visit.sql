-- ============================================================
-- VICS — 유저 최종 방문 시각 (profiles.last_visit_at)
-- 관리자 유저 상세 · 활동 추적용
-- 전제: public.is_active_admin_operator() (supabase_inquiries_admin_rls.sql)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_visit_at timestamptz;

COMMENT ON COLUMN public.profiles.last_visit_at IS
  '앱 마지막 방문 시각 (세션·화면 이동·탭 포커스·포그라운드 하트비트 시 touch_profile_last_visit RPC로 갱신)';

-- 로그인 유저 본인 profiles.last_visit_at 갱신 (5분 단위 클라이언트 스로틀과 병행)
CREATE OR REPLACE FUNCTION public.touch_profile_last_visit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET last_visit_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.touch_profile_last_visit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_profile_last_visit() TO authenticated;

COMMENT ON FUNCTION public.touch_profile_last_visit() IS
  '현재 로그인 유저의 last_visit_at을 now()로 갱신';

-- 관리자: 유저 상세 — 최종 방문(프로필) · 최종 로그인(auth) 조회
CREATE OR REPLACE FUNCTION public.get_admin_user_visit_activity(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_visit timestamptz;
  v_last_sign_in timestamptz;
BEGIN
  IF NOT public.is_active_admin_operator() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN json_build_object('last_visit_at', NULL, 'last_sign_in_at', NULL);
  END IF;

  SELECT p.last_visit_at, au.last_sign_in_at
  INTO v_last_visit, v_last_sign_in
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.id = p_user_id;

  RETURN json_build_object(
    'last_visit_at', v_last_visit,
    'last_sign_in_at', v_last_sign_in
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_visit_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_visit_activity(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_admin_user_visit_activity(uuid) IS
  '관리자 유저 상세: last_visit_at · auth.last_sign_in_at';
