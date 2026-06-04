-- =============================================================================
-- VICS — auth.users 생성 시 profiles 1행 + 닉네임·메타 정합 (통합 트리거)
-- Supabase SQL Editor에서 실행하세요.
--
-- supabase_handle_new_user_profile_sync.sql / supabase_kakao_trigger.sql 의
-- 서로 다른 handle_new_user 정의를 이 파일 하나로 맞춥니다.
--
-- 닉네임: raw_user_meta_data.nickname(이메일 가입) 우선 → name / full_name …
--        → 이메일 @ 앞부분. 클라이언트와 동일하게 [^가-힣a-zA-Z0-9_] 제거, 최대 12자.
-- 닉네임 UNIQUE 충돌 시 짧은 접미사로 재시도(최대 30회) 후에도 실패하면 난수 접미사.
--
-- 가입 보상 포인트: src/lib/signupRewards.js 의 SIGNUP_BONUS_POINTS 와 맞출 것 (현재 100)
-- =============================================================================

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
      INSERT INTO public.profiles (id, email, nickname, avatar_url, birthdate, gender, points)
      VALUES (NEW.id, v_email, v_try, v_avatar, v_birthdate, v_gender, 100);
      RETURN NEW;
    EXCEPTION
      WHEN unique_violation THEN
        v_try := left(v_nick, 4) || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    END;
  END LOOP;

  INSERT INTO public.profiles (id, email, nickname, avatar_url, birthdate, gender, points)
  VALUES (
    NEW.id,
    v_email,
    split_part(COALESCE(v_email, 'user@vics.local'), '@', 1) || floor(random() * 900000 + 100000)::text,
    v_avatar,
    v_birthdate,
    v_gender,
    100
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'auth.users INSERT 시 profiles 생성 — 닉네임은 메타 우선, 클라이언트 sanitize 규칙과 동일.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
