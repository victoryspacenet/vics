-- =============================================
-- VICS - 알림 자동 생성 트리거
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- ─────────────────────────────────────────────
-- 1. 투표 시 알림 (내 매치업에 누군가 투표)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_vote()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id  uuid;
  v_matchup_title text;
  v_voter_nick  text;
BEGIN
  SELECT m.user_id, m.title
  INTO v_creator_id, v_matchup_title
  FROM public.matchups m
  WHERE m.id = NEW.matchup_id;

  -- 자기 자신 투표는 알림 제외
  IF v_creator_id IS NULL OR v_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_voter_nick
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, related_matchup_id)
  VALUES
    (
      v_creator_id,
      'vote',
      v_voter_nick || '님이 투표했어요',
      '"' || left(v_matchup_title, 30) || '"',
      NEW.matchup_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vote_notify ON public.votes;
CREATE TRIGGER on_vote_notify
  AFTER INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION notify_on_vote();

-- ─────────────────────────────────────────────
-- 2. 댓글 알림 — 사용 안 함 (트리거·함수 제거)
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_comment_notify ON public.comments;
DROP FUNCTION IF EXISTS notify_on_comment();

-- ─────────────────────────────────────────────
-- 3. 좋아요 시 알림 (내 매치업에 좋아요)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id  uuid;
  v_matchup_title text;
  v_liker_nick  text;
BEGIN
  SELECT m.user_id, m.title
  INTO v_creator_id, v_matchup_title
  FROM public.matchups m
  WHERE m.id = NEW.matchup_id;

  IF v_creator_id IS NULL OR v_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_liker_nick
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, related_matchup_id)
  VALUES
    (
      v_creator_id,
      'like',
      v_liker_nick || '님이 좋아요를 눌렀어요',
      '"' || left(v_matchup_title, 30) || '"',
      NEW.matchup_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_notify ON public.likes;
CREATE TRIGGER on_like_notify
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();
