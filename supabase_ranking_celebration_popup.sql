-- =============================================
-- VICS — 랭킹 TOP10 축하 카드 팝업 (로그인 세션당 1회)
-- supabase_ranking_celebration_bonus.sql 적용 후 실행
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_ranking_celebration_popup_seen (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  login_at timestamptz NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, login_at)
);

CREATE INDEX IF NOT EXISTS user_ranking_celebration_popup_seen_user_idx
  ON public.user_ranking_celebration_popup_seen (user_id, seen_at DESC);

ALTER TABLE public.user_ranking_celebration_popup_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_ranking_celebration_popup_seen_select_own"
  ON public.user_ranking_celebration_popup_seen;
CREATE POLICY "user_ranking_celebration_popup_seen_select_own"
  ON public.user_ranking_celebration_popup_seen FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_ranking_celebration_popup_seen IS
  '랭킹 축하 카드 자동 팝업 — 로그인 세션(last_sign_in_at)당 1회';

-- ── 자동 팝업 표시 여부 ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.should_show_ranking_celebration_popup (
  p_login_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  IF p_login_at IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'should_show', true);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'should_show', NOT EXISTS (
      SELECT 1
      FROM public.user_ranking_celebration_popup_seen s
      WHERE s.user_id = v_uid
        AND s.login_at = p_login_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.should_show_ranking_celebration_popup (timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.should_show_ranking_celebration_popup (timestamptz) TO authenticated;

COMMENT ON FUNCTION public.should_show_ranking_celebration_popup IS
  '랭킹 축하 카드 자동 팝업 — 현재 로그인 세션에서 아직 안 봤으면 should_show=true';

-- ── 자동 팝업 본 기록 ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_ranking_celebration_popup_seen (
  p_login_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  IF p_login_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  INSERT INTO public.user_ranking_celebration_popup_seen (user_id, login_at)
  VALUES (v_uid, p_login_at)
  ON CONFLICT (user_id, login_at) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_ranking_celebration_popup_seen (timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_ranking_celebration_popup_seen (timestamptz) TO authenticated;

COMMENT ON FUNCTION public.mark_ranking_celebration_popup_seen IS
  '랭킹 축하 카드 자동 팝업 — 현재 로그인 세션에 표시 완료 기록';
