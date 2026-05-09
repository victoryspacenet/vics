-- =============================================
-- VICS — 프로필 공개 권한 구매·연장 (RPC)
-- =============================================
-- 매 결제 2,000P 차감. 만료일 = GREATEST(기존 만료, now()) + 1개월 (연장 시 이어짐)
-- 선행: supabase_profile_public_unlock.sql, supabase_profile_public_expires.sql
-- Supabase SQL Editor에서 실행하세요.

CREATE OR REPLACE FUNCTION public.purchase_profile_public_unlock ()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer := 2000;
  v_points integer;
  v_expires timestamptz;
  v_base timestamptz;
  v_new_exp timestamptz;
  v_has_season boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT p.points, p.profile_public_expires_at
  INTO v_points, v_expires
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '프로필을 찾을 수 없어요');
  END IF;

  IF v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', '포인트가 부족해요 (2,000 P 필요)');
  END IF;

  -- 만료 연장: 아직 유효하면 그 시점부터, 아니면 지금부터 1개월
  IF v_expires IS NOT NULL AND v_expires > now() THEN
    v_base := v_expires;
  ELSE
    v_base := now();
  END IF;
  v_new_exp := v_base + interval '1 month';

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE public.profiles
    SET
      points = points - v_cost,
      season_points = season_points - v_cost,
      profile_public_unlocked_at = now(),
      profile_public_expires_at = v_new_exp,
      updated_at = now()
    WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
    SET
      points = points - v_cost,
      profile_public_unlocked_at = now(),
      profile_public_expires_at = v_new_exp,
      updated_at = now()
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'points_spent', v_cost,
    'expires_at', v_new_exp
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_profile_public_unlock () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_profile_public_unlock () TO authenticated;

COMMENT ON FUNCTION public.purchase_profile_public_unlock IS
  '프로필 공개 권한 — 2,000P/회, 만료 GREATEST(기존, now())+1M, V-Card CTA는 expires_at > now()';
