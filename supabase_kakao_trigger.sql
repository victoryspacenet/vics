-- =============================================
-- VICS - 카카오/구글 소셜 로그인 트리거 업데이트
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 기존 트리거 교체: 소셜 로그인 메타데이터 처리 강화
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _nickname text;
  _avatar   text;
  _email    text;
  _suffix   text;
  _count    int := 0;
BEGIN
  -- 이메일
  _email := new.email;

  -- 닉네임 우선순위: nickname > name > full_name > user_name > email 앞부분
  _nickname := COALESCE(
    new.raw_user_meta_data->>'nickname',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    split_part(COALESCE(new.email, 'user@vics'), '@', 1)
  );

  -- 특수문자 제거, 최대 20자
  _nickname := regexp_replace(_nickname, '[^가-힣a-zA-Z0-9_]', '', 'g');
  _nickname := left(COALESCE(NULLIF(_nickname, ''), 'user'), 20);

  -- 아바타 URL
  _avatar := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  -- 닉네임 중복 처리: 최대 5회 시도
  LOOP
    EXIT WHEN _count >= 5;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE nickname = _nickname) THEN
      EXIT;
    END IF;
    _suffix := floor(random() * 9000 + 1000)::text;
    _nickname := left(split_part(COALESCE(new.email, 'user'), '@', 1), 16) || _suffix;
    _count := _count + 1;
  END LOOP;

  INSERT INTO public.profiles (id, email, nickname, avatar_url)
  VALUES (new.id, _email, _nickname, _avatar)
  ON CONFLICT (id) DO UPDATE
    SET
      email      = EXCLUDED.email,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
