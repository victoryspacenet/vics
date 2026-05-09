-- =============================================
-- VICS - 댓글 도배 방지
-- Supabase SQL Editor에서 실행하세요
--
-- 10초 이내 연속 댓글 작성 금지 (같은 매치업 기준)
-- =============================================

CREATE OR REPLACE FUNCTION prevent_comment_spam()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM comments
    WHERE user_id = NEW.user_id
      AND matchup_id = NEW.matchup_id
      AND created_at > now() - interval '10 seconds'
  ) INTO v_recent_exists;

  IF v_recent_exists THEN
    RAISE EXCEPTION '10초 이내에 연속으로 댓글을 작성할 수 없어요. 잠시 후 다시 시도해주세요.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_before_insert_spam_check ON public.comments;
CREATE TRIGGER on_comment_before_insert_spam_check
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION prevent_comment_spam();
