-- ============================================================
-- VICS — 유저 주요 활동 유형 (관리자 유저 상세)
-- 투표 · 업로드(매치업 생성·도전) · 공유 집계
-- 전제: public.is_active_admin_operator() (supabase_inquiries_admin_rls.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  share_kind text NOT NULL CHECK (share_kind IN ('matchup', 'ranking', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_share_events_user_created_idx
  ON public.user_share_events (user_id, created_at DESC);

ALTER TABLE public.user_share_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_share_events_insert_own ON public.user_share_events;
CREATE POLICY user_share_events_insert_own ON public.user_share_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_share_events_select_own ON public.user_share_events;
CREATE POLICY user_share_events_select_own ON public.user_share_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_share_events IS
  '유저 SNS·링크 공유 이벤트 (매치업·랭킹 등) — 관리자 활동 유형 집계용';

-- 로그인 유저 공유 1건 기록
CREATE OR REPLACE FUNCTION public.log_user_share_event(p_share_kind text DEFAULT 'matchup')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_kind text := COALESCE(NULLIF(trim(p_share_kind), ''), 'matchup');
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  IF v_kind NOT IN ('matchup', 'ranking', 'other') THEN
    v_kind := 'matchup';
  END IF;

  INSERT INTO public.user_share_events (user_id, share_kind)
  VALUES (v_uid, v_kind);
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_share_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_user_share_event(text) TO authenticated;

COMMENT ON FUNCTION public.log_user_share_event(text) IS
  '로그인 유저 공유 1건 기록 (매치업·랭킹·기타)';

-- 관리자: 유저별 활동 건수 + 주요 유형
CREATE OR REPLACE FUNCTION public.get_admin_user_primary_activity(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vote int := 0;
  v_upload int := 0;
  v_share int := 0;
  v_primary text := NULL;
  v_max int := 0;
BEGIN
  IF NOT public.is_active_admin_operator() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'vote_count', 0,
      'upload_count', 0,
      'share_count', 0,
      'primary_type', NULL
    );
  END IF;

  SELECT COALESCE(p.vote_total, 0)::int INTO v_vote
  FROM public.profiles p
  WHERE p.id = p_user_id;

  SELECT
    COALESCE((
      SELECT count(*)::int FROM public.matchups m WHERE m.user_id = p_user_id
    ), 0)
    + COALESCE((
      SELECT count(*)::int
      FROM public.matchups m
      WHERE m.right_user_id = p_user_id
        AND m.right_type IS NOT NULL
    ), 0)
  INTO v_upload;

  SELECT
    COALESCE((
      SELECT count(*)::int FROM public.tendency_report_shares t WHERE t.user_id = p_user_id
    ), 0)
    + COALESCE((
      SELECT count(*)::int FROM public.user_share_events e WHERE e.user_id = p_user_id
    ), 0)
  INTO v_share;

  v_max := GREATEST(v_vote, v_upload, v_share);
  IF v_max > 0 THEN
    IF v_vote = v_max THEN
      v_primary := 'voter';
    ELSIF v_upload = v_max THEN
      v_primary := 'creator';
    ELSE
      v_primary := 'sharer';
    END IF;
  END IF;

  RETURN json_build_object(
    'vote_count', v_vote,
    'upload_count', v_upload,
    'share_count', v_share,
    'primary_type', v_primary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_primary_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_primary_activity(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_admin_user_primary_activity(uuid) IS
  '관리자 유저 상세: 투표·업로드·공유 건수 및 주요 활동 유형(voter|creator|sharer)';
