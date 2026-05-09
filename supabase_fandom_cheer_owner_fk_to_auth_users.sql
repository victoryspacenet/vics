-- 응원 한마디: owner_user_id FK를 profiles → auth.users 로 변경
-- 증상: insert ... violates foreign key constraint "fandom_cheer_messages_owner_user_id_fkey"
-- 원인: V-Card 주인 UUID는 auth에는 있으나 profiles 행이 없을 때(가입 직후·트리거 실패·수동 삭제 등)
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.fandom_cheer_messages
  DROP CONSTRAINT IF EXISTS fandom_cheer_messages_owner_user_id_fkey;

ALTER TABLE public.fandom_cheer_messages
  ADD CONSTRAINT fandom_cheer_messages_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fandom_cheer_messages_owner_user_id_fkey ON public.fandom_cheer_messages IS
  'V-Card 주인 = 로그인 계정 id. profiles 존재 여부와 무관하게 응원 INSERT 허용';
