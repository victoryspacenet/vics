-- 팝업 공지: isActive=false 행 제외 목록 (클라이언트 전체 스캔·I/O 절감)
-- Supabase SQL Editor에서 실행

CREATE OR REPLACE FUNCTION public.list_popup_notices_active_candidates()
RETURNS TABLE (
  id text,
  doc jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.doc,
    p.created_at,
    p.updated_at
  FROM public.popup_notices p
  WHERE COALESCE((p.doc->>'isActive')::boolean, true) = true
  ORDER BY p.updated_at DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.list_popup_notices_active_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_popup_notices_active_candidates() TO anon, authenticated;

COMMENT ON FUNCTION public.list_popup_notices_active_candidates() IS
  '노출 후보 팝업만 반환 (isActive=false 제외). 기간·타겟 필터는 클라이언트.';
