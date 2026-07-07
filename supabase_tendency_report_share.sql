-- =============================================
-- VICS — 성향 리포트 공개 공유 (카카오·SNS 링크)
-- supabase_tendency_report.sql 적용 후 실행
-- =============================================

CREATE TABLE IF NOT EXISTS public.tendency_report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tendency_type text NOT NULL CHECK (tendency_type IN ('trendsetter', 'mainstream', 'unique')),
  report_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tendency_report_shares_snapshot_obj CHECK (jsonb_typeof(report_snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS tendency_report_shares_user_created_idx
  ON public.tendency_report_shares (user_id, created_at DESC);

ALTER TABLE public.tendency_report_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tendency_report_shares_insert_own" ON public.tendency_report_shares;
CREATE POLICY "tendency_report_shares_insert_own" ON public.tendency_report_shares
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tendency_report_shares_select_public" ON public.tendency_report_shares;
CREATE POLICY "tendency_report_shares_select_public" ON public.tendency_report_shares
  FOR SELECT TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.tendency_report_shares IS '성향 리포트 SNS 공유 스냅샷 — UUID로 공개 조회(RPC·직접 SELECT)';

-- ── 공유 링크 발행 (본인 리포트) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_tendency_report_share (p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  n bigint;
  v_type text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', '리포트 데이터가 올바르지 않아요');
  END IF;

  v_type := p_snapshot ->> 'tendencyType';
  IF v_type IS NULL OR v_type NOT IN ('trendsetter', 'mainstream', 'unique') THEN
    RETURN jsonb_build_object('ok', false, 'error', '유효하지 않은 성향 유형이에요');
  END IF;

  SELECT count(*)::bigint INTO n FROM public.votes WHERE user_id = v_uid;
  IF n < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', '아직 10회 투표에 도달하지 않았어요');
  END IF;

  INSERT INTO public.tendency_report_shares (user_id, tendency_type, report_snapshot)
  VALUES (v_uid, v_type, p_snapshot)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'share_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_tendency_report_share (jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_tendency_report_share (jsonb) TO authenticated;

-- ── 공개 조회 (로그인·투표 조건 없음) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_tendency_report_share (p_share_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  row public.tendency_report_shares%ROWTYPE;
BEGIN
  IF p_share_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '공유 링크가 올바르지 않아요');
  END IF;

  SELECT * INTO row FROM public.tendency_report_shares WHERE id = p_share_id;

  IF row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '공유된 리포트를 찾을 수 없어요');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'share_id', row.id,
    'tendency_type', row.tendency_type,
    'report_snapshot', row.report_snapshot,
    'shared_at', row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tendency_report_share (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tendency_report_share (uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.publish_tendency_report_share IS '성향 리포트 공유 링크 생성';
COMMENT ON FUNCTION public.get_tendency_report_share IS '공유 링크로 리포트 조회 (비로그인 가능)';
