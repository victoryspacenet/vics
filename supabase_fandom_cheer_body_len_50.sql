-- 응원 한마디 최대 길이 200 → 50자 (이미 배포된 DB용)
-- 50자 초과 행이 있으면 ADD CONSTRAINT 전에 정리하거나 잘라 주세요.
ALTER TABLE public.fandom_cheer_messages
  DROP CONSTRAINT IF EXISTS fandom_cheer_body_len;

ALTER TABLE public.fandom_cheer_messages
  ADD CONSTRAINT fandom_cheer_body_len CHECK (char_length(body) BETWEEN 1 AND 50);
