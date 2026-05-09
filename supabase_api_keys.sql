-- ============================================================
-- API 키 관리 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_api_keys (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  key_prefix  text NOT NULL,           -- 앞 8자리만 저장 (예: vics_abc1)
  key_hash    text NOT NULL UNIQUE,    -- SHA-256 해시 (보안 검증용)
  scopes      text[] DEFAULT '{}',     -- 허용된 권한 범위
  status      text DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used_at timestamptz,
  expires_at  timestamptz,             -- NULL = 만료 없음
  created_by  text,
  created_at  timestamptz DEFAULT now(),
  revoked_at  timestamptz
);

ALTER TABLE public.admin_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_all" ON public.admin_api_keys FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 샘플 데이터
-- ============================================================

INSERT INTO public.admin_api_keys (name, key_prefix, key_hash, scopes, status, last_used_at, created_by)
VALUES
  (
    'Analytics 대시보드',
    'vics_a1b2',
    'sample_hash_analytics',
    ARRAY['read:matchups', 'read:users', 'read:stats'],
    'active',
    now() - interval '2 hours',
    '운영자'
  ),
  (
    'Slack 알림 봇',
    'vics_c3d4',
    'sample_hash_slack',
    ARRAY['read:notifications', 'write:notifications'],
    'active',
    now() - interval '1 day',
    '운영자'
  ),
  (
    '구버전 외부 연동',
    'vics_e5f6',
    'sample_hash_legacy',
    ARRAY['read:matchups'],
    'revoked',
    now() - interval '30 days',
    '운영자'
  )
ON CONFLICT DO NOTHING;
