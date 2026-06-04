-- =============================================================================
-- profiles.nickname 을 auth 메타의 nickname 과 맞추기 (보수적 1회 수리)
-- Supabase SQL Editor — 실행 전 백업 권장.
--
-- 조건: raw_user_meta_data 에 nickname 이 있고,
--       현재 profiles.nickname 이 이메일 @ 앞부분과 같을 때만 갱신합니다.
--       (트리거가 이메일 로컬부만 넣고 메타 닉네임을 반영 못 한 케이스 추정)
-- 앱에서 닉네임을 이메일과 동일하게 쓴 사용자는 제외되지 않습니다(메타와 같으면 UPDATE 없음).
-- =============================================================================

UPDATE public.profiles p
SET
  nickname = v.meta_nick,
  updated_at = now()
FROM auth.users u,
LATERAL (
  SELECT NULLIF(trim(u.raw_user_meta_data->>'nickname'), '') AS meta_nick
) v
WHERE p.id = u.id
  AND v.meta_nick IS NOT NULL
  AND lower(p.nickname) = lower(split_part(u.email, '@', 1))
  AND p.nickname IS DISTINCT FROM v.meta_nick;
