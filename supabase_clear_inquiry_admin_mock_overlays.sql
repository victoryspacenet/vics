-- 관리자 문의 목(오버레이) 데모 데이터 제거
-- Supabase SQL Editor에서 1회 실행

-- admin_ui_config 에 저장된 데모 오버레이(ADM-* id) 초기화
UPDATE public.admin_ui_config
SET
  value = '[]'::jsonb,
  updated_at = now()
WHERE key = 'inquiry_admin_overrides_v1';

-- 행이 없으면 무시됨
INSERT INTO public.admin_ui_config (key, value, updated_at)
VALUES ('inquiry_admin_overrides_v1', '[]'::jsonb, now())
ON CONFLICT (key) DO UPDATE
SET value = '[]'::jsonb, updated_at = now();

SELECT key, value FROM public.admin_ui_config WHERE key = 'inquiry_admin_overrides_v1';
