-- 서버 점검(다운) 안내 — admin_settings
-- Supabase SQL Editor에서 1회 실행

INSERT INTO public.admin_settings (key, value)
VALUES (
  'server_maintenance',
  '{
    "enabled": false,
    "mode": "off",
    "message": "경쟁이 너무 뜨거워 서버가 잠시 열을 식히는 중입니다!",
    "expectedRecoveryAt": null,
    "emergencyActivatedAt": null,
    "emergencyActivatedBy": null
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
