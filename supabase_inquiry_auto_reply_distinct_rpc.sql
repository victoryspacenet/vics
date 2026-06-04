-- 자동응답이 붙은 문의 id DISTINCT 조회 (관리자 목록·통계 제외용)
-- 적용 후 클라이언트는 `supabase.rpc('inquiry_auto_reply_excluded_inquiry_ids')` 사용 가능.

CREATE INDEX IF NOT EXISTS inquiry_replies_auto_inquiry_id_idx
  ON public.inquiry_replies (inquiry_id)
  WHERE reply_type = 'auto' AND inquiry_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.inquiry_auto_reply_excluded_inquiry_ids()
RETURNS TABLE (inquiry_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT r.inquiry_id
  FROM public.inquiry_replies r
  WHERE r.reply_type = 'auto'
    AND r.inquiry_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.inquiry_auto_reply_excluded_inquiry_ids() IS
  '문의 관리: 자동응답 reply가 있는 inquiry_id 목록 (중복 없음).';

REVOKE ALL ON FUNCTION public.inquiry_auto_reply_excluded_inquiry_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inquiry_auto_reply_excluded_inquiry_ids() TO authenticated;
