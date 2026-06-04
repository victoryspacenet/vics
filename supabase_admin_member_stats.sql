-- ============================================================
-- VICS — 관리자 대시보드 회원 집계 RPC
-- 전제: public.is_active_admin_operator() (supabase_inquiries_admin_rls.sql)
--       public.account_withdrawal_cooldowns (supabase_account_withdrawal_rejoin_cooldown.sql)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_member_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_members int;
  withdrawn_members int;
BEGIN
  IF NOT public.is_active_admin_operator() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT count(*)::int INTO total_members
  FROM public.profiles p
  WHERE p.nickname NOT IN ('수부타이', '랜디', '레젭', '빅스');

  SELECT count(*)::int INTO withdrawn_members
  FROM public.account_withdrawal_cooldowns;

  RETURN json_build_object(
    'total_members', COALESCE(total_members, 0),
    'withdrawn_members', COALESCE(withdrawn_members, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_member_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_member_stats() TO anon, authenticated;

COMMENT ON FUNCTION public.get_admin_member_stats() IS
  '관리자 대시보드: 전체 회원(profiles, 가상계정 제외) · 탈퇴 회원(account_withdrawal_cooldowns)';
