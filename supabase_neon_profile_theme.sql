-- 네온 프로필 테마 (Point Reward · Style) — 3,500P / 구매일 기준 4개월 + 마이페이지 테마 선택
-- 선행: profiles.points 등 기존 스키마
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS neon_profile_theme_unlocked_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS neon_profile_theme_expires_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS neon_profile_theme_id text NOT NULL DEFAULT 'classic';

COMMENT ON COLUMN public.profiles.neon_profile_theme_unlocked_at IS
  '네온 프로필 테마 마지막 구매(또는 연장) 시각';
COMMENT ON COLUMN public.profiles.neon_profile_theme_expires_at IS
  '네온 테마 이용 만료 시각(구매·연장 시각 + 4개월) — 이후 클래식으로 표시·재구매 가능';
COMMENT ON COLUMN public.profiles.neon_profile_theme_id IS
  '마이페이지 테마: classic | magenta_pulse | violet_drift | sunset_arc | cyber_mint';

-- 기존 구매자: 구매 시각 + 4개월로 만료 보정 (컬럼 신설 직후 1회)
UPDATE public.profiles
SET neon_profile_theme_expires_at = neon_profile_theme_unlocked_at + interval '4 months'
WHERE neon_profile_theme_unlocked_at IS NOT NULL
  AND neon_profile_theme_expires_at IS NULL;

-- ── 클라이언트 직접 UPDATE로 잠금/테마/만료 위조 방지 (RPC만 허용) ─────────

CREATE OR REPLACE FUNCTION public.profiles_neon_theme_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.neon_profile_theme_unlocked_at IS NOT DISTINCT FROM OLD.neon_profile_theme_unlocked_at
     AND NEW.neon_profile_theme_expires_at IS NOT DISTINCT FROM OLD.neon_profile_theme_expires_at
     AND NEW.neon_profile_theme_id IS NOT DISTINCT FROM OLD.neon_profile_theme_id THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.allow_neon_theme_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  NEW.neon_profile_theme_unlocked_at := OLD.neon_profile_theme_unlocked_at;
  NEW.neon_profile_theme_expires_at := OLD.neon_profile_theme_expires_at;
  NEW.neon_profile_theme_id := OLD.neon_profile_theme_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_neon_theme_guard ON public.profiles;
CREATE TRIGGER profiles_neon_theme_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_neon_theme_guard();

-- ── 구매 RPC (유효 이용권이 있으면 거절 — 만료 후 재구매, 매번 결제일 + 4개월) ───

CREATE OR REPLACE FUNCTION public.purchase_neon_profile_theme_unlock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer := 3500;
  v_points integer;
  v_has_season boolean;
  v_unlocked timestamptz;
  v_expires timestamptz;
  v_new_exp timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT p.points, p.neon_profile_theme_unlocked_at, p.neon_profile_theme_expires_at
  INTO v_points, v_unlocked, v_expires
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '프로필을 찾을 수 없어요');
  END IF;

  IF v_expires IS NOT NULL AND v_expires > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      '아직 이용 기간이 남아 있어요. 만료 후 다시 구매할 수 있어요 (구매일마다 4개월)'
    );
  END IF;

  IF v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', '포인트가 부족해요 (3,500 P 필요)');
  END IF;

  v_new_exp := now() + interval '4 months';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  PERFORM set_config('app.allow_neon_theme_write', '1', true);

  IF v_has_season THEN
    UPDATE public.profiles
    SET
      points = points - v_cost,
      season_points = season_points - v_cost,
      neon_profile_theme_unlocked_at = now(),
      neon_profile_theme_expires_at = v_new_exp,
      neon_profile_theme_id = 'magenta_pulse',
      updated_at = now()
    WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
    SET
      points = points - v_cost,
      neon_profile_theme_unlocked_at = now(),
      neon_profile_theme_expires_at = v_new_exp,
      neon_profile_theme_id = 'magenta_pulse',
      updated_at = now()
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'points_spent', v_cost,
    'theme_id', 'magenta_pulse',
    'expires_at', v_new_exp
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_neon_profile_theme_unlock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_neon_profile_theme_unlock() TO authenticated;

COMMENT ON FUNCTION public.purchase_neon_profile_theme_unlock IS
  '네온 프로필 테마 — 3,500P / 구매일 + 4개월, 만료 후 재구매, 기본 테마 magenta_pulse';

-- ── 테마 변경 RPC (만료 전·유효 이용권 동안 무료 전환) ─────────────────────

CREATE OR REPLACE FUNCTION public.set_neon_profile_theme(p_theme_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_unlocked timestamptz;
  v_expires timestamptz;
  v_clean text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  v_clean := lower(trim(coalesce(p_theme_id, '')));

  IF v_clean NOT IN ('classic', 'magenta_pulse', 'violet_drift', 'sunset_arc', 'cyber_mint') THEN
    RETURN jsonb_build_object('ok', false, 'error', '지원하지 않는 테마예요');
  END IF;

  SELECT p.neon_profile_theme_unlocked_at, p.neon_profile_theme_expires_at
  INTO v_unlocked, v_expires
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '프로필을 찾을 수 없어요');
  END IF;

  IF v_unlocked IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '먼저 네온 프로필 테마를 구매해 주세요');
  END IF;

  IF v_expires IS NULL OR v_expires <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', '이용 기간이 만료됐어요. 다시 구매해 주세요');
  END IF;

  PERFORM set_config('app.allow_neon_theme_write', '1', true);

  UPDATE public.profiles
  SET
    neon_profile_theme_id = v_clean,
    updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'theme_id', v_clean);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.set_neon_profile_theme(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_neon_profile_theme(text) TO authenticated;

COMMENT ON FUNCTION public.set_neon_profile_theme IS
  '마이페이지 네온 테마 변경 — 만료 전(유효 이용권)에만 classic·4종 네온 선택';
