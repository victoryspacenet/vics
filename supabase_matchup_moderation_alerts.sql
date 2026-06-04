-- ============================================================
-- 관리자 대시보드 — 긴급 모니터링 (AI 부적절·저유사도·신고 누적)
-- Supabase SQL Editor에서 실행
-- 선행: public.matchups, public.profiles, public.admin_operators (없으면 로그인 유저 전원 허용)
-- ============================================================

-- 운영자 판별 (기존 정의가 있으면 덮어씀 — 로컬 dev: active 운영자 0명이면 로그인만으로 허용)
CREATE OR REPLACE FUNCTION public.is_staff_moderation_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT exists (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND coalesce(trim(p.email), '') <> ''
          AND lower(trim(p.email)) IN (
            SELECT lower(trim(ao.email))
            FROM public.admin_operators ao
            WHERE ao.status = 'active'
              AND coalesce(trim(ao.email), '') <> ''
          )
      )
    ),
    (
      SELECT count(*) = 0 FROM public.admin_operators ao WHERE ao.status = 'active'
    )
    AND auth.uid() IS NOT NULL,
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_moderation_operator() TO authenticated;

CREATE TABLE IF NOT EXISTS public.matchup_moderation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id uuid NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
  alert_kind text NOT NULL CHECK (alert_kind IN (
    'inappropriate_ai',
    'low_similarity',
    'reports_threshold'
  )),
  similarity_score smallint,
  ai_confidence smallint,
  ai_reason_ko text,
  right_report_count integer NOT NULL DEFAULT 0,
  auto_actioned boolean NOT NULL DEFAULT false,
  resolution text CHECK (resolution IS NULL OR resolution IN ('kept', 'blocked', 'deleted', 'superseded')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mma_pending_created
  ON public.matchup_moderation_alerts (created_at DESC)
  WHERE resolution IS NULL;

CREATE INDEX IF NOT EXISTS idx_mma_matchup
  ON public.matchup_moderation_alerts (matchup_id);

COMMENT ON TABLE public.matchup_moderation_alerts IS
  '관리자 대시보드 긴급 모니터링 큐. Netlify(service_role) 적재, 운영자가 유지/차단/삭제 처리.';

ALTER TABLE public.matchup_moderation_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mma_staff_select" ON public.matchup_moderation_alerts;
CREATE POLICY "mma_staff_select"
  ON public.matchup_moderation_alerts FOR SELECT TO authenticated
  USING (public.is_staff_moderation_operator());

DROP POLICY IF EXISTS "mma_staff_update" ON public.matchup_moderation_alerts;
CREATE POLICY "mma_staff_update"
  ON public.matchup_moderation_alerts FOR UPDATE TO authenticated
  USING (public.is_staff_moderation_operator())
  WITH CHECK (public.is_staff_moderation_operator());

-- ── 적재 (Netlify service_role) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_matchup_moderation_alert(
  p_matchup_id uuid,
  p_alert_kind text,
  p_similarity_score smallint DEFAULT NULL,
  p_ai_confidence smallint DEFAULT NULL,
  p_ai_reason_ko text DEFAULT NULL,
  p_right_report_count integer DEFAULT 0,
  p_auto_actioned boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_kind text := lower(trim(coalesce(p_alert_kind, '')));
BEGIN
  IF p_matchup_id IS NULL THEN
    RAISE EXCEPTION 'matchup_id required';
  END IF;
  IF v_kind NOT IN ('inappropriate_ai', 'low_similarity', 'reports_threshold') THEN
    RAISE EXCEPTION 'invalid alert_kind';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.matchups m WHERE m.id = p_matchup_id) THEN
    RAISE EXCEPTION 'matchup_not_found';
  END IF;

  UPDATE public.matchup_moderation_alerts
  SET
    resolution = 'superseded',
    resolved_at = now(),
    updated_at = now()
  WHERE matchup_id = p_matchup_id
    AND resolution IS NULL;

  INSERT INTO public.matchup_moderation_alerts (
    matchup_id,
    alert_kind,
    similarity_score,
    ai_confidence,
    ai_reason_ko,
    right_report_count,
    auto_actioned
  )
  VALUES (
    p_matchup_id,
    v_kind,
    p_similarity_score,
    p_ai_confidence,
    nullif(trim(coalesce(p_ai_reason_ko, '')), ''),
    GREATEST(0, coalesce(p_right_report_count, 0)),
    coalesce(p_auto_actioned, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_matchup_moderation_alert(uuid, text, smallint, smallint, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_matchup_moderation_alert(uuid, text, smallint, smallint, text, integer, boolean) TO service_role;

-- ── 운영자 처리 (대시보드) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_matchup_moderation_alert(
  p_alert_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.matchup_moderation_alerts%ROWTYPE;
  v_action text := lower(trim(coalesce(p_action, '')));
BEGIN
  IF NOT public.is_staff_moderation_operator() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_action NOT IN ('keep', 'block', 'delete') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;

  SELECT * INTO v_row
  FROM public.matchup_moderation_alerts
  WHERE id = p_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.resolution IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_resolved');
  END IF;

  IF v_action = 'delete' THEN
    DELETE FROM public.matchups WHERE id = v_row.matchup_id;
    UPDATE public.matchup_moderation_alerts
    SET
      resolution = 'deleted',
      resolved_at = now(),
      resolved_by = auth.uid(),
      updated_at = now()
    WHERE id = p_alert_id;
    RETURN jsonb_build_object('ok', true, 'action', 'delete', 'matchup_id', v_row.matchup_id);
  END IF;

  IF v_action = 'block' THEN
    UPDATE public.matchups
    SET status = 'closed', updated_at = now()
    WHERE id = v_row.matchup_id;
    UPDATE public.matchup_moderation_alerts
    SET
      resolution = 'blocked',
      resolved_at = now(),
      resolved_by = auth.uid(),
      auto_actioned = true,
      updated_at = now()
    WHERE id = p_alert_id;
    RETURN jsonb_build_object('ok', true, 'action', 'block', 'matchup_id', v_row.matchup_id);
  END IF;

  -- keep (유지 / 목록에서 제거)
  UPDATE public.matchup_moderation_alerts
  SET
    resolution = 'kept',
    resolved_at = now(),
    resolved_by = auth.uid(),
    updated_at = now()
  WHERE id = p_alert_id;

  RETURN jsonb_build_object('ok', true, 'action', 'keep', 'matchup_id', v_row.matchup_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_matchup_moderation_alert(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_matchup_moderation_alert(uuid, text) TO authenticated;
