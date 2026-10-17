-- 관전봇 댓글 조회용 인덱스.
-- 댓글 본문은 기존 public.comments 에 들어간다.
-- 봇 한 명당 48시간에 하나, 본인 매치업에는 쓰지 않는 규칙은 Netlify virtual-bot-comments 가 지킨다.
-- Supabase SQL Editor에서 이 파일만 실행하면 됩니다. 여러 번 실행해도 안전합니다.

CREATE INDEX IF NOT EXISTS comments_user_created_idx
  ON public.comments (user_id, created_at DESC);
