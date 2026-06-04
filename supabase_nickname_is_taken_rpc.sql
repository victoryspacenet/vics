-- =============================================
-- VICS — 닉네임 중복 여부 RPC (가입·프로필 수정 공통)
-- Supabase SQL Editor에서 실행하세요.
--
-- (선택) 배포·`npm run dev:netlify`에서는 `POST /api/nickname-check` 함수가
--       서비스 롤로 동일 조회를 하므로 RPC 없이도 중복 확인이 동작할 수 있습니다.
--       `npm run dev`(Vite 5173만)에서는 /api 가 없어 이 RPC가 필요합니다.
--
-- 배경: 클라이언트에서 profiles 를 직접 SELECT 하면,
--       RLS 가 "본인 프로필만 읽기" 등으로 바뀐 경우 익명 가입 단계에서
--       다른 사용자 닉네임 행이 보이지 않아 항상 "사용 가능"으로 나올 수 있음.
--       이 함수는 존재 여부(boolean)만 반환하며 RLS 를 우회합니다.
-- =============================================

CREATE OR REPLACE FUNCTION public.nickname_is_taken(p_nickname text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE nickname = trim(both from p_nickname::text)
  );
$$;

COMMENT ON FUNCTION public.nickname_is_taken(text) IS
  '닉네임이 이미 profiles 에 있는지 (가입/닉네임 변경 전 중복 확인).';

REVOKE ALL ON FUNCTION public.nickname_is_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nickname_is_taken(text) TO anon, authenticated;
