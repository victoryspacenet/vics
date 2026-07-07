-- =============================================
-- VICS — 성향 리포트 잠금 해제 팝업 (최초 1회)
-- supabase_tendency_report.sql 적용 후 실행
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_tendency_report_popup_seen (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_tendency_report_popup_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_tendency_report_popup_seen_select_own" ON public.user_tendency_report_popup_seen;
CREATE POLICY "user_tendency_report_popup_seen_select_own" ON public.user_tendency_report_popup_seen
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_tendency_report_popup_seen IS '성향 리포트 잠금 해제 팝업 — 사용자당 1회만 표시';

-- ── 상태 조회 (popup_seen 필드 추가) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_tendency_report_status ()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  n bigint;
  ack_row public.user_tendency_report_ack%ROWTYPE;
  v_popup_seen boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT count(*)::bigint INTO n FROM public.votes WHERE user_id = v_uid;

  SELECT * INTO ack_row FROM public.user_tendency_report_ack WHERE user_id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM public.user_tendency_report_popup_seen WHERE user_id = v_uid
  ) INTO v_popup_seen;

  RETURN jsonb_build_object(
    'ok', true,
    'vote_count', n,
    'eligible', n >= 10,
    'acknowledged', ack_row.user_id IS NOT NULL,
    'popup_seen', v_popup_seen OR ack_row.user_id IS NOT NULL,
    'tendency_type', ack_row.tendency_type,
    'unlocked_at', ack_row.unlocked_at,
    'report_snapshot', ack_row.report_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_tendency_report_status () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tendency_report_status () TO authenticated;

-- ── 팝업 본 기록 (1회) ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_tendency_report_popup_seen ()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  n bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT count(*)::bigint INTO n FROM public.votes WHERE user_id = v_uid;
  IF n < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', '아직 10회 투표에 도달하지 않았어요');
  END IF;

  INSERT INTO public.user_tendency_report_popup_seen (user_id)
  VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_tendency_report_popup_seen () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_tendency_report_popup_seen () TO authenticated;

COMMENT ON FUNCTION public.mark_tendency_report_popup_seen IS '성향 리포트 잠금 해제 팝업 표시 완료 기록';

-- 기존 리포트 확인 사용자 — 팝업 다시 안 뜨게 백필
INSERT INTO public.user_tendency_report_popup_seen (user_id, seen_at)
SELECT user_id, unlocked_at
FROM public.user_tendency_report_ack
ON CONFLICT (user_id) DO NOTHING;
