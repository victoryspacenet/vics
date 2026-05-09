-- =============================================
-- VICS — 팬덤 리워드 (F-Point, 마일스톤, 등급, 응원 메시지)
-- 선행: supabase_vcard_story_claps.sql
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

-- 1) 프로필: 팬덤 포인트 + 캐시 등급 (Clap 수 기준 트리거로 동기화)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fandom_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fandom_tier text NOT NULL DEFAULT 'none';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_fandom_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_fandom_tier_check
  CHECK (fandom_tier IN ('none', 'bronze', 'silver', 'gold', 'diamond'));

COMMENT ON COLUMN public.profiles.fandom_points IS '팬덤 포인트 (F-Point) — V-Card Clap 1회당 5점 자동 적립 (누적 Clap×5)';
COMMENT ON COLUMN public.profiles.fandom_tier IS 'V-Card 누적 Claps 기준 등급 캐시';

-- 2) 마일스톤 확인 기록 (팝업 Confirm 시 1회 적립)
CREATE TABLE IF NOT EXISTS public.fandom_milestone_ack (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  milestone integer NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone),
  CONSTRAINT fandom_milestone_ack_value CHECK (milestone IN (100, 500, 1000, 5000))
);

CREATE INDEX IF NOT EXISTS fandom_milestone_ack_user_idx ON public.fandom_milestone_ack (user_id);

ALTER TABLE public.fandom_milestone_ack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fandom_milestone_ack_select_own" ON public.fandom_milestone_ack;
CREATE POLICY "fandom_milestone_ack_select_own" ON public.fandom_milestone_ack
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.fandom_milestone_ack IS 'Clap 마일스톤 축하 팝업 확인(보상 수령) 기록 — INSERT는 RPC만';

-- 3) 응원 한마디 (대시보드)
CREATE TABLE IF NOT EXISTS public.fandom_cheer_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fandom_cheer_body_len CHECK (char_length(body) BETWEEN 1 AND 50)
);

CREATE INDEX IF NOT EXISTS fandom_cheer_owner_created_idx
  ON public.fandom_cheer_messages (owner_user_id, created_at DESC);

-- 동일 V-Card 리포트(owner)당 팬 계정 1회 응원
ALTER TABLE public.fandom_cheer_messages DROP CONSTRAINT IF EXISTS fandom_cheer_owner_author_unique;
ALTER TABLE public.fandom_cheer_messages
  ADD CONSTRAINT fandom_cheer_owner_author_unique UNIQUE (owner_user_id, author_user_id);

ALTER TABLE public.fandom_cheer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fandom_cheer_select_own" ON public.fandom_cheer_messages;
DROP POLICY IF EXISTS "fandom_cheer_select_owner_or_author" ON public.fandom_cheer_messages;
CREATE POLICY "fandom_cheer_select_owner_or_author" ON public.fandom_cheer_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = author_user_id);

DROP POLICY IF EXISTS "fandom_cheer_insert_as_fan" ON public.fandom_cheer_messages;
CREATE POLICY "fandom_cheer_insert_as_fan" ON public.fandom_cheer_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_user_id
    AND auth.uid() IS DISTINCT FROM owner_user_id
  );

GRANT SELECT, INSERT ON public.fandom_cheer_messages TO authenticated;

-- 4) Clap 수 → 등급 캐시 갱신
CREATE OR REPLACE FUNCTION public.refresh_fandom_tier_for_owner (p_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
  t text;
BEGIN
  IF p_owner IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::bigint INTO n FROM public.vcard_story_claps WHERE owner_user_id = p_owner;

  t := CASE
    WHEN n >= 5000 THEN 'diamond'
    WHEN n >= 1000 THEN 'gold'
    WHEN n >= 500 THEN 'silver'
    WHEN n >= 100 THEN 'bronze'
    ELSE 'none'
  END;

  UPDATE public.profiles
  SET
    fandom_tier = t,
    updated_at = now()
  WHERE id = p_owner;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_fandom_tier_for_owner (uuid) FROM PUBLIC;

-- 트리거: 행 단위로 owner 등급 갱신
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

DROP TRIGGER IF EXISTS trg_vcard_claps_refresh_fandom_tier ON public.vcard_story_claps;
CREATE TRIGGER trg_vcard_claps_refresh_fandom_tier
AFTER INSERT ON public.vcard_story_claps
FOR EACH ROW
EXECUTE FUNCTION public.trg_vcard_claps_refresh_fandom_tier_fn ();

-- PostgreSQL 13 이하에서는 위 한 줄을 다음으로 바꾸세요:
-- EXECUTE PROCEDURE public.trg_vcard_claps_refresh_fandom_tier_fn();

-- 5) 마일스톤 확인 (ack + 등급 재계산) — F-Point 추가 지급 없음, Clap당 5점은 위 트리거로만 적립
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

REVOKE ALL ON FUNCTION public.claim_fandom_milestone (integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_fandom_milestone (integer) TO authenticated;

COMMENT ON FUNCTION public.claim_fandom_milestone IS 'Clap 마일스톤 축하 확인 — ack만 (F-Point는 Clap당 5점 트리거로 적립)';

-- 6) 기존 사용자 등급 백필 (선택)
UPDATE public.profiles p
SET fandom_tier = sub.t
FROM (
  SELECT
    c.owner_user_id AS uid,
    CASE
      WHEN count(*) >= 5000 THEN 'diamond'
      WHEN count(*) >= 1000 THEN 'gold'
      WHEN count(*) >= 500 THEN 'silver'
      WHEN count(*) >= 100 THEN 'bronze'
      ELSE 'none'
    END AS t
  FROM public.vcard_story_claps c
  GROUP BY c.owner_user_id
) sub
WHERE p.id = sub.uid
  AND p.fandom_tier IS DISTINCT FROM sub.t;

-- 7) F-Point를 누적 Clap×5로 재계산 (규정 전환·백필)
UPDATE public.profiles p
SET
  fandom_points = (SELECT count(*)::integer FROM public.vcard_story_claps c WHERE c.owner_user_id = p.id) * 5,
  updated_at = now();
