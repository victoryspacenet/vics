-- =============================================================================
-- VICS — auth 메타데이터의 닉네임 vs profiles.nickname 점검 (읽기 전용)
-- Supabase SQL Editor에서 실행. Table Editor와 숫자가 안 맞을 때 원인 파악용.
--
-- 정합 맞추기: 신규 가입은 supabase_handle_new_user_unified.sql 트리거 + 앱의
-- auth.updateUser / profiles-bootstrap-signup 메타 동기화를 적용하세요.
-- 이미 꼬인 행은 supabase_repair_profiles_nickname_from_meta_conservative.sql (보수적) 참고.
--
-- 왜 어긋날 수 있나요? (과거)
-- 1) auth.users INSERT 직후 DB 트리거(handle_new_user)가 먼저 profiles 행을 만들 때
--    닉네임 UNIQUE 충돌이 나면, 일부 트리거는 이메일앞자리+난수 등으로 넣습니다.
-- 2) 이메일 가입 + 인증만 켜진 경우: 클라이언트 upsert / profiles-bootstrap-signup 이
--    실패하면(네트워크, 5173만 켜서 /api 없음 등) 메타에는 닉네임이 있는데 profiles 는 비었거나
--    트리거가 넣은 값만 남을 수 있습니다.
-- 3) 카카오용 트리거(supabase_kakao_trigger.sql)의 ON CONFLICT DO UPDATE 는
--    nickname 컬럼을 갱신하지 않을 수 있어, 이후 메타와 불일치가 남을 수 있습니다.
-- 4) 소셜/별칭 필드(name, full_name 등)만 채워지고 raw_user_meta_data->>'nickname' 이
--    비어 있으면, 트리거는 이메일 앞부분·가공 문자열을 넣습니다.
-- =============================================================================

-- 메타에 nickname 이 있는데 profiles 와 문자열이 다른 계정
SELECT
  u.id,
  u.email,
  NULLIF(TRIM(u.raw_user_meta_data->>'nickname'), '') AS meta_nickname,
  p.nickname AS profile_nickname,
  u.created_at AS auth_created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE NULLIF(TRIM(u.raw_user_meta_data->>'nickname'), '') IS NOT NULL
  AND (
    p.id IS NULL
    OR p.nickname IS DISTINCT FROM NULLIF(TRIM(u.raw_user_meta_data->>'nickname'), '')
  )
ORDER BY u.created_at DESC
LIMIT 200;
