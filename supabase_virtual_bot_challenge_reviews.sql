-- =============================================================================
-- VICS — 관전봇 도전글 주제 검수 기록
-- 백그라운드 작업(virtual-bot-images-background)이 공개 중인 봇 도전글을 한 건씩
-- 엄격 검사하고, 주제가 안 맞으면 원글에 맞는 B글로 다시 쓴다.
-- 다시 쓸 수 없으면: 원글이 실제 유저 글이면 B 자리와 기존 표를 비우고, 봇 글이면 비공개(closed).
-- 이 테이블은 검수 결과와 원래 B글(되돌리기용)을 남긴다.
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요. 여러 번 실행해도 안전합니다.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.virtual_bot_challenge_reviews (
  matchup_id uuid PRIMARY KEY REFERENCES public.matchups(id) ON DELETE CASCADE,
  result text NOT NULL,
  fit integer,
  reason_ko text,
  prev_status text,
  prev_right_type text,
  prev_right_description text,
  prev_right_text text,
  prev_right_url text,
  prev_right_user_id uuid,
  new_right_description text,
  new_right_text text,
  new_right_url text,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_bot_challenge_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.virtual_bot_challenge_reviews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_bot_challenge_reviews TO service_role;

-- 진행 확인
-- SELECT result, count(*) FROM public.virtual_bot_challenge_reviews GROUP BY result;
