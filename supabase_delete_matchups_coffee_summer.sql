-- =============================================
-- 메인 피드 정리: 베스트 후보「커피 vs 차」·추천 풀 후보「여름 vs 겨울」삭제
-- Supabase SQL Editor에서 실행하세요.
--
-- 제목이 같은 활성 매치업은 동일 시드를 재실행했거나 테스트 계정 외에도 만들었다면
-- 모두 삭제됩니다. 같은 제목을 실유저가 쓴 게 없어야 안전합니다.
-- 같은 작성자(seed 사용자 한 명)만 지우려면 아래 주석 블록을 사용하세요.
-- =============================================

DELETE FROM public.matchups
WHERE title IN ('커피 vs 차', '여름 vs 겨울');

-- /* 작성자 한정 삭제 예시 (가장 오래된 프로필 1명 = 시드 계정 가정 시)
-- DELETE FROM public.matchups m
-- USING (
--   SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1
-- ) p
-- WHERE m.user_id = p.id
--   AND m.title IN ('커피 vs 차', '여름 vs 겨울');
-- */
