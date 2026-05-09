-- ============================================================
-- 금칙어 필터링 트리거
-- 적용 대상: profiles, matchups, comments, inquiries,
--            appeals, appeal_follow_ups
-- ============================================================

-- ① 핵심 검사 함수 -----------------------------------------
-- 입력 텍스트 배열 중 하나라도 금칙어가 포함되면 예외 발생
-- 에러코드 P0001 / 메시지: "금칙어가 포함되어 있습니다: <단어>"
CREATE OR REPLACE FUNCTION public.fn_check_banned_words(VARIADIC texts text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t        text;
  banned   text;
BEGIN
  FOREACH t IN ARRAY texts LOOP
    CONTINUE WHEN t IS NULL OR t = '';
    SELECT word INTO banned
    FROM   public.admin_banned_words
    WHERE  active = true
      AND  position(lower(word) IN lower(t)) > 0
    LIMIT  1;
    IF banned IS NOT NULL THEN
      RAISE EXCEPTION '금칙어가 포함되어 있습니다: %', banned
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END;
$$;

-- ② profiles 트리거 (nickname, bio) -------------------------
CREATE OR REPLACE FUNCTION public.trg_profiles_banned_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.fn_check_banned_words(NEW.nickname, NEW.bio);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_banned_words_profiles ON public.profiles;
CREATE TRIGGER check_banned_words_profiles
  BEFORE INSERT OR UPDATE OF nickname, bio
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profiles_banned_words();

-- ③ matchups 트리거 (title, description, left_text, right_text, left_label, right_label) ---
CREATE OR REPLACE FUNCTION public.trg_matchups_banned_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.fn_check_banned_words(
    NEW.title,
    NEW.description,
    NEW.left_text,
    NEW.right_text,
    NEW.left_label,
    NEW.right_label
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_banned_words_matchups ON public.matchups;
CREATE TRIGGER check_banned_words_matchups
  BEFORE INSERT OR UPDATE OF title, description, left_text, right_text, left_label, right_label
  ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION public.trg_matchups_banned_words();

-- ④ comments 트리거 (content) --------------------------------
CREATE OR REPLACE FUNCTION public.trg_comments_banned_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.fn_check_banned_words(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_banned_words_comments ON public.comments;
CREATE TRIGGER check_banned_words_comments
  BEFORE INSERT OR UPDATE OF content
  ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_comments_banned_words();

-- ⑤ inquiries 트리거 (title, content) -----------------------
CREATE OR REPLACE FUNCTION public.trg_inquiries_banned_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.fn_check_banned_words(NEW.title, NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_banned_words_inquiries ON public.inquiries;
CREATE TRIGGER check_banned_words_inquiries
  BEFORE INSERT OR UPDATE OF title, content
  ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.trg_inquiries_banned_words();

-- ⑥ appeals 트리거 (appeal_title, appeal_content) -----------
CREATE OR REPLACE FUNCTION public.trg_appeals_banned_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.fn_check_banned_words(NEW.appeal_title, NEW.appeal_content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_banned_words_appeals ON public.appeals;
CREATE TRIGGER check_banned_words_appeals
  BEFORE INSERT OR UPDATE OF appeal_title, appeal_content
  ON public.appeals
  FOR EACH ROW EXECUTE FUNCTION public.trg_appeals_banned_words();

-- ⑦ appeal_follow_ups 트리거 (content) ----------------------
CREATE OR REPLACE FUNCTION public.trg_appeal_follow_ups_banned_words()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.fn_check_banned_words(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_banned_words_appeal_follow_ups ON public.appeal_follow_ups;
CREATE TRIGGER check_banned_words_appeal_follow_ups
  BEFORE INSERT OR UPDATE OF content
  ON public.appeal_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.trg_appeal_follow_ups_banned_words();
