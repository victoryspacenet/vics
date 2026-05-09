-- 시스템 푸시 설정 기본값 (설정 센터 UI와 동일 구조)
-- 이미 행이 있으면 건너뜀
insert into public.admin_settings (key, value)
values (
  'system_push_settings',
  '{
    "enabled": true,
    "channels": { "inapp": true, "email": true, "messenger": false },
    "events": {
      "server_error_5xx": true,
      "db_connection_fail": true,
      "storage_full": true,
      "traffic_spike": true,
      "rate_limit_breach": true,
      "concurrent_users": false,
      "login_fail_burst": true,
      "suspicious_query": true,
      "new_admin_login": false,
      "sla_exceeded": true,
      "appeal_submitted": false,
      "abuse_detected": true
    }
  }'::jsonb
)
on conflict (key) do nothing;
