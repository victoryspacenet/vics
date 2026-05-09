-- V-Card 리포트(owner)당 팬 계정 응원 1회 — 기존 DB에만 적용해도 됩니다.
-- 동일 (owner_user_id, author_user_id) 행이 이미 2건 이상이면 UNIQUE 추가 전에 정리하세요.

ALTER TABLE public.fandom_cheer_messages DROP CONSTRAINT IF EXISTS fandom_cheer_owner_author_unique;
ALTER TABLE public.fandom_cheer_messages
  ADD CONSTRAINT fandom_cheer_owner_author_unique UNIQUE (owner_user_id, author_user_id);

DROP POLICY IF EXISTS "fandom_cheer_select_own" ON public.fandom_cheer_messages;
DROP POLICY IF EXISTS "fandom_cheer_select_owner_or_author" ON public.fandom_cheer_messages;
CREATE POLICY "fandom_cheer_select_owner_or_author" ON public.fandom_cheer_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = author_user_id);
