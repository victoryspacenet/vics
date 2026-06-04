-- ============================================================
-- 매치업 신고 + 챌린저(B) 측 신고 5건 이상 + AI 부적절 판정 시
--   즉시: winner=left, status=closed, 챌린저에게 300P 차감, 알림
-- Supabase SQL Editor에서 실행하세요.
-- 선행: public.matchups, public.profiles, (선택) notifications_type_check 확장본
-- ============================================================

-- ── 1) notifications.type 에 moderation_forfeit 추가 (기존 허용 값 유지) ─
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'vote', 'comment', 'like', 'match_complete', 'ranking',
  'notice', 'content_deletion', 'restriction_lift', 'appeal_result',
  'inquiry_reply',
  'moderation_forfeit'
));

-- ── 2) matchups: 몰수패 메타 ────────────────────────────────
ALTER TABLE public.matchups ADD COLUMN IF NOT EXISTS challenger_forfeit_at timestamptz;
ALTER TABLE public.matchups ADD COLUMN IF NOT EXISTS challenger_forfeit_reason text;

-- ── 3) matchup_reports ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matchup_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id uuid NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_side text NOT NULL CHECK (reported_side IN ('left', 'right')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, matchup_id, reported_side)
);

CREATE INDEX IF NOT EXISTS idx_matchup_reports_matchup_side
  ON public.matchup_reports (matchup_id, reported_side);

ALTER TABLE public.matchup_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matchup_reports_select_own" ON public.matchup_reports;
CREATE POLICY "matchup_reports_select_own"
  ON public.matchup_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "matchup_reports_insert_rules" ON public.matchup_reports;
CREATE POLICY "matchup_reports_insert_rules"
  ON public.matchup_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matchups m
      WHERE m.id = matchup_id
        AND coalesce(m.is_complete, false) = true
        AND m.challenger_forfeit_at IS NULL
        AND (
          (reported_side = 'left' AND auth.uid() IS DISTINCT FROM m.user_id)
          OR (reported_side = 'right' AND auth.uid() IS DISTINCT FROM m.right_user_id)
        )
    )
  );

COMMENT ON TABLE public.matchup_reports IS '매치업 측(left/right)별 신고. 동일 유저는 측당 1회.';

-- ── 4) RPC: AI·신고 조건 충족 후 몰수패 확정 (서비스 롤 전용) ─
CREATE OR REPLACE FUNCTION public.finalize_challenger_forfeit_moderation(
  p_matchup_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m record;
  v_has_season boolean;
  v_right uuid;
  v_body text;
BEGIN
  SELECT
    m.id,
    m.user_id,
    m.right_user_id,
    m.is_complete,
    m.status,
    m.challenger_forfeit_at,
    m.title
  INTO v_m
  FROM public.matchups m
  WHERE m.id = p_matchup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'matchup_not_found');
  END IF;

  IF v_m.challenger_forfeit_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_forfeited');
  END IF;

  IF coalesce(v_m.is_complete, false) IS NOT TRUE OR v_m.right_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'incomplete_or_no_challenger');
  END IF;

  v_right := v_m.right_user_id;

  UPDATE public.matchups
  SET
    winner = 'left',
    status = 'closed',
    challenger_forfeit_at = now(),
    challenger_forfeit_reason = coalesce(nullif(trim(p_reason), ''), '신고 누적 및 AI 부적절 판정(챌린저 몰수패)'),
    updated_at = now()
  WHERE id = p_matchup_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE public.profiles
    SET
      points = GREATEST(0, points - 300),
      season_points = GREATEST(0, season_points - 300),
      updated_at = now()
    WHERE id = v_right;
  ELSE
    UPDATE public.profiles
    SET
      points = GREATEST(0, points - 300),
      updated_at = now()
    WHERE id = v_right;
  END IF;

  v_body := format(
    '회원님이 참여한 매치업「%s」에서 챌린저 콘텐츠가 가이드에 맞지 않다고 판정되어 몰수패 처리되었어요. 300P가 차감되었습니다.',
    left(coalesce(v_m.title, '매치업'), 80)
  );

  INSERT INTO public.notifications (user_id, type, title, body, related_matchup_id, is_read, payload)
  VALUES (
    v_right,
    'moderation_forfeit',
    '챌린저 몰수패 · 300P 차감',
    v_body,
    p_matchup_id,
    false,
    jsonb_build_object('penalty_points', 300)
  );

  RETURN jsonb_build_object('ok', true, 'penalized', true, 'right_user_id', v_right);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_challenger_forfeit_moderation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_challenger_forfeit_moderation(uuid, text) TO service_role;

COMMENT ON FUNCTION public.finalize_challenger_forfeit_moderation IS
  '챌린저(B) 신고 5건+ 및 AI 부적절 확정 시 Netlify(서비스 롤)에서만 호출. 몰수패+300P.';
