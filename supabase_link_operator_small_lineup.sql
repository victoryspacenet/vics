-- 스몰 라인업(운영 QA) — admin_operators 와 profiles 이메일 연결
-- Supabase SQL Editor에서 1회 실행 (프로덕션·스테이징 각각)

-- 1) 현재 프로필·운영자 행 확인
SELECT p.id, p.nickname, p.email AS profile_email, ao.id AS operator_id, ao.email AS operator_email, ao.status, ao.is_seed
FROM public.profiles p
LEFT JOIN public.admin_operators ao
  ON lower(trim(ao.email)) = lower(trim(coalesce(nullif(trim(p.email), ''), '')))
  OR trim(ao.name) = trim(p.nickname)
WHERE trim(p.nickname) IN ('스몰 라인업', '멋쟁이해병');

-- 2) 운영자 행 없으면 생성 / 있으면 이메일·상태 동기화
INSERT INTO public.admin_operators (
  id, name, department, email, status, permission, granular, is_seed
)
SELECT
  'ops_small_lineup',
  trim(p.nickname),
  '운영팀',
  lower(trim(coalesce(nullif(trim(p.email), ''), 'ops.small.lineup@vics.app'))),
  'active',
  'Master',
  '{"dashboard":{"r":true,"w":true,"d":true,"e":true},"matchups":{"r":true,"w":true,"d":true,"e":true},"users":{"r":true,"w":true,"d":true,"e":true},"settings":{"r":true,"w":true,"d":true,"e":true}}'::jsonb,
  false
FROM public.profiles p
WHERE trim(p.nickname) = '스몰 라인업'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  status = 'active',
  permission = 'Master',
  is_seed = false,
  granular = EXCLUDED.granular;

-- 3) profiles.email 이 비어 있으면 운영자 이메일과 맞춤 (is_active_admin_operator RLS용)
UPDATE public.profiles p
SET email = ao.email
FROM public.admin_operators ao
WHERE ao.id = 'ops_small_lineup'
  AND trim(p.nickname) = '스몰 라인업'
  AND (p.email IS NULL OR trim(p.email) = '');
