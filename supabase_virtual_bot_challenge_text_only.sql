-- =============================================================================
-- 관전봇 도전: 회원 미디어 재사용 함수 제거
-- 도전 형식은 A측을 따름(텍스트/이미지). 이 파일은 이미지 도전을 텍스트로 바꾸지 않습니다.
-- 선행: 업데이트된 `supabase_virtual_bot_matchups.sql`
-- =============================================================================

DROP FUNCTION IF EXISTS public.bot_pick_random_media(text, text, text);
DROP FUNCTION IF EXISTS public.bot_resolve_content_side(text, text, text, text);
