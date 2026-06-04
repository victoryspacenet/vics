-- =============================================================================
-- VICS — 가입 축하 100P (1회 지급, 누락 보정)
-- Supabase SQL Editor에서 실행하세요.
-- 앱 상수: src/lib/signupRewards.js SIGNUP_BONUS_POINTS (= 100)
-- 선행: public.profiles, auth.users 트리거(선택) supabase_handle_new_user_unified.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_bonus_granted_at timestamptz;

COMMENT ON COLUMN public.profiles.signup_bonus_granted_at IS
  '가입 축하 포인트(100P) 지급 시각. NULL이면 미지급 — grant_signup_bonus RPC로 1회만 지급.';

-- ── 1회 지급 RPC (본인 또는 service_role) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_signup_bonus(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus integer := 100;
  v_updated integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.profiles
  SET
    points = GREATEST(coalesce(points, 0), v_bonus),
    signup_bonus_granted_at = now(),
    updated_at = now()
  WHERE id = p_user_id
    AND signup_bonus_granted_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION public.grant_signup_bonus(uuid) IS
  '가입 축하 100P — signup_bonus_granted_at 이 없을 때만 지급.';

REVOKE ALL ON FUNCTION public.grant_signup_bonus(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_signup_bonus(uuid) TO service_role;

-- ── auth.users INSERT 트리거 — 가입 시 100P + 지급 시각 ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nick text;
  v_email text;
  v_avatar text;
  v_bd text;
  v_gender text;
  v_birthdate date;
  v_try text;
  v_bonus integer := 100;
  i int := 0;
BEGIN
  v_email := NEW.email;

  v_avatar := NULLIF(
    trim(COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')),
    ''
  );

  v_nick := NULLIF(trim(NEW.raw_user_meta_data->>'nickname'), '');
  IF v_nick IS NULL OR v_nick = '' THEN
    v_nick := NULLIF(trim(NEW.raw_user_meta_data->>'name'), '');
  END IF;
  IF v_nick IS NULL OR v_nick = '' THEN
    v_nick := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');
  END IF;
  IF v_nick IS NULL OR v_nick = '' THEN
    v_nick := NULLIF(trim(NEW.raw_user_meta_data->>'user_name'), '');
  END IF;
  IF v_nick IS NULL OR v_nick = '' THEN
    v_nick := NULLIF(trim(NEW.raw_user_meta_data->>'preferred_username'), '');
  END IF;

  v_nick := regexp_replace(
    COALESCE(v_nick, split_part(COALESCE(v_email, 'user@vics.local'), '@', 1)),
    '[^가-힣a-zA-Z0-9_]',
    '',
    'g'
  );
  v_nick := left(NULLIF(v_nick, ''), 12);
  IF v_nick IS NULL OR v_nick = '' THEN
    v_nick := 'user';
  END IF;

  v_bd := NULLIF(trim(NEW.raw_user_meta_data->>'birthdate'), '');
  IF v_bd IS NOT NULL AND v_bd ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_birthdate := v_bd::date;
  ELSE
    v_birthdate := NULL;
  END IF;

  v_gender := CASE
    WHEN NEW.raw_user_meta_data->>'gender' IN ('male', 'female', 'other')
    THEN NEW.raw_user_meta_data->>'gender'
    ELSE NULL
  END;

  v_try := v_nick;
  LOOP
    i := i + 1;
    EXIT WHEN i > 30;
    BEGIN
      INSERT INTO public.profiles (
        id, email, nickname, avatar_url, birthdate, gender, points, signup_bonus_granted_at
      )
      VALUES (NEW.id, v_email, v_try, v_avatar, v_birthdate, v_gender, v_bonus, now());
      RETURN NEW;
    EXCEPTION
      WHEN unique_violation THEN
        v_try := left(v_nick, 4) || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    END;
  END LOOP;

  INSERT INTO public.profiles (
    id, email, nickname, avatar_url, birthdate, gender, points, signup_bonus_granted_at
  )
  VALUES (
    NEW.id,
    v_email,
    split_part(COALESCE(v_email, 'user@vics.local'), '@', 1) || floor(random() * 900000 + 100000)::text,
    v_avatar,
    v_birthdate,
    v_gender,
    v_bonus,
    now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 누락 보정: 미지급이면 100P (테스트 가상 닉네임 제외) ─────────────────────
UPDATE public.profiles
SET
  points = GREATEST(coalesce(points, 0), 100),
  signup_bonus_granted_at = coalesce(signup_bonus_granted_at, created_at, now()),
  updated_at = now()
WHERE signup_bonus_granted_at IS NULL
  AND coalesce(points, 0) < 100
  AND trim(nickname) NOT IN ('수부타이', '랜디', '레젭', '빅스');

-- 이미 100P 이상인데 지급 시각만 없는 경우 (중복 지급 없음)
UPDATE public.profiles
SET signup_bonus_granted_at = coalesce(signup_bonus_granted_at, created_at, now())
WHERE signup_bonus_granted_at IS NULL
  AND coalesce(points, 0) >= 100
  AND trim(nickname) NOT IN ('수부타이', '랜디', '레젭', '빅스');

SELECT nickname, points, signup_bonus_granted_at
FROM public.profiles
WHERE trim(nickname) NOT IN ('수부타이', '랜디', '레젭', '빅스')
ORDER BY created_at DESC
LIMIT 20;
