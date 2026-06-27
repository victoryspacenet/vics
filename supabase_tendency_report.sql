-- =============================================
-- VICS — 성향 리포트 (가입 후 10회 투표 이벤트)
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_tendency_report_ack (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  vote_count_at_unlock integer NOT NULL CHECK (vote_count_at_unlock >= 10),
  tendency_type text NOT NULL CHECK (tendency_type IN ('trendsetter', 'mainstream', 'unique')),
  report_snapshot jsonb NOT NULL,
  CONSTRAINT user_tendency_report_ack_snapshot_obj CHECK (jsonb_typeof(report_snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS user_tendency_report_ack_unlocked_idx
  ON public.user_tendency_report_ack (unlocked_at DESC);

ALTER TABLE public.user_tendency_report_ack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_tendency_report_ack_select_own" ON public.user_tendency_report_ack;
CREATE POLICY "user_tendency_report_ack_select_own" ON public.user_tendency_report_ack
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_tendency_report_ack IS 'Vics 성향 리포트 확인 기록 — INSERT는 RPC만';

-- ── 투표 수·확인 여부 ────────────────────────────────────────────────────────
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT count(*)::bigint INTO n FROM public.votes WHERE user_id = v_uid;

  SELECT * INTO ack_row FROM public.user_tendency_report_ack WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'vote_count', n,
    'eligible', n >= 10,
    'acknowledged', ack_row.user_id IS NOT NULL,
    'tendency_type', ack_row.tendency_type,
    'unlocked_at', ack_row.unlocked_at,
    'report_snapshot', ack_row.report_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_tendency_report_status () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tendency_report_status () TO authenticated;

-- ── 리포트 확인 저장 ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ack_user_tendency_report (
  p_tendency_type text,
  p_snapshot jsonb
)
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

  IF p_tendency_type NOT IN ('trendsetter', 'mainstream', 'unique') THEN
    RETURN jsonb_build_object('ok', false, 'error', '유효하지 않은 성향 유형이에요');
  END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', '리포트 데이터가 올바르지 않아요');
  END IF;

  SELECT count(*)::bigint INTO n FROM public.votes WHERE user_id = v_uid;

  IF n < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', '아직 10회 투표에 도달하지 않았어요');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_tendency_report_ack WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  INSERT INTO public.user_tendency_report_ack (
    user_id,
    vote_count_at_unlock,
    tendency_type,
    report_snapshot
  )
  VALUES (
    v_uid,
    n::integer,
    p_tendency_type,
    p_snapshot
  );

  RETURN jsonb_build_object('ok', true, 'vote_count', n);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ack_user_tendency_report (text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ack_user_tendency_report (text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.get_user_tendency_report_status IS '성향 리포트 잠금 해제·확인 상태';
COMMENT ON FUNCTION public.ack_user_tendency_report IS '성향 리포트 확인 기록 (10회 투표 달성 후 1회)';
