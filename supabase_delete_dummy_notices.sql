-- 공지 더미 일괄 정리 — 「빅스 정식 버전 개봉」만 남기고 모두 삭제
-- Supabase SQL Editor(운영 프로젝트)에서 1회 실행하세요.
--
-- ※ 제목이 한 글자라도 다르면 삭제됩니다. 남길 공지 제목을 먼저 확인하세요.
-- SELECT id, title FROM public.notices ORDER BY created_at DESC;

-- 1) 삭제 예정 목록 (개봉 공지 제외)
SELECT id, title, category, author, created_at
FROM public.notices
WHERE trim(title) IS DISTINCT FROM '빅스 정식 버전 개봉'
ORDER BY created_at DESC;

-- 2) 연동 알림(공지 푸시) 정리
DELETE FROM public.notifications
WHERE related_notice_id IN (
  SELECT id FROM public.notices
  WHERE trim(title) IS DISTINCT FROM '빅스 정식 버전 개봉'
);

-- 3) 공지 삭제
DELETE FROM public.notices
WHERE trim(title) IS DISTINCT FROM '빅스 정식 버전 개봉';

-- 4) 남은 공지 확인 (1건이면 정상)
SELECT id, title, category, author, created_at
FROM public.notices
ORDER BY created_at DESC;
