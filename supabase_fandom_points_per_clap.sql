-- =============================================
-- VICS — F-Point 규정: V-Card Clap 1회당 5 FP
-- 기존에 supabase_fandom.sql 을 적용한 DB에만 실행하면 됩니다.
-- (신규는 갱신된 supabase_fandom.sql 한 번이면 충분)
-- =============================================

COMMENT ON COLUMN public.profiles.fandom_points IS '팬덤 포인트 (F-Point) — V-Card Clap 1회당 5점 자동 적립 (누적 Clap×5)';

CREATE OR REPLACE FUNCTION public.trg_vcard_claps_refresh_fandom_tier_fn ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    fandom_points = fandom_points + 5,
    updated_at = now()
  WHERE id = NEW.owner_user_id;

  PERFORM public.refresh_fandom_tier_for_owner (NEW.owner_user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_fandom_milestone (p_milestone integer)
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

  IF p_milestone NOT IN (100, 500, 1000, 5000) THEN
    RETURN jsonb_build_object('ok', false, 'error', '유효하지 않은 마일스톤이에요');
  END IF;

  SELECT count(*)::bigint INTO n FROM public.vcard_story_claps WHERE owner_user_id = v_uid;

  IF n < p_milestone::bigint THEN
    RETURN jsonb_build_object('ok', false, 'error', '아직 달성하지 않은 마일스톤이에요');
  END IF;

  IF EXISTS (SELECT 1 FROM public.fandom_milestone_ack a WHERE a.user_id = v_uid AND a.milestone = p_milestone) THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 수령한 보상이에요');
  END IF;

  INSERT INTO public.fandom_milestone_ack (user_id, milestone)
  VALUES (v_uid, p_milestone);

  PERFORM public.refresh_fandom_tier_for_owner (v_uid);

  RETURN jsonb_build_object(
    'ok', true,
    'milestone', p_milestone,
    'fandom_points_granted', 0
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 수령한 보상이에요');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.claim_fandom_milestone IS 'Clap 마일스톤 축하 확인 — ack만 (F-Point는 Clap당 5점 트리거로 적립)';

UPDATE public.profiles p
SET
  fandom_points = (SELECT count(*)::integer FROM public.vcard_story_claps c WHERE c.owner_user_id = p.id) * 5,
  updated_at = now();
