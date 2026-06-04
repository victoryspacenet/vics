-- =============================================================================
-- VICS — 공개 랭킹 노출 가능 프로필 (실제 회원 계정 위주)
-- Supabase SQL Editor에서 실행 후 `profiles_goat_period_leaderboard` 재배포 파일과 함께 반영하세요.
--
-- * profiles.id = auth.users.id 인 행만 후보로 본다 (SQL로만 존재하던 phantom 프로필 제거).
-- * auth.users 의 example.com / example.org / test.com 메일 패턴 계정 제외 (로컬 테스트용).
-- * 카카오 등 이메일이 비어 있는 실제 회원은 그대로 노출된다.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rank_profile_eligible_for_board(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.id
    WHERE p.id = p_id
      AND (
        NULLIF(trim(COALESCE(u.email, '')), '') IS NULL
        OR (
          lower(trim(u.email)) NOT LIKE '%@example.com'
          AND lower(trim(u.email)) NOT LIKE '%@example.org'
          AND lower(trim(u.email)) NOT LIKE '%@test.com'
        )
      )
  );
$$;

COMMENT ON FUNCTION public.rank_profile_eligible_for_board(uuid) IS
  '랭킹/Goat 노출 가능 프로필: auth 연동 + 예시·테스트 이메일 도메인 제외.';

REVOKE ALL ON FUNCTION public.rank_profile_eligible_for_board(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.profiles_public_rank_candidate_ids()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE public.rank_profile_eligible_for_board(p.id);
$$;

COMMENT ON FUNCTION public.profiles_public_rank_candidate_ids() IS
  '공개 랭킹 UI용 후보 프로필 id 목록 (.in 필터).';

REVOKE ALL ON FUNCTION public.profiles_public_rank_candidate_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_public_rank_candidate_ids() TO anon, authenticated;
