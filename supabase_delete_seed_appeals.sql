-- 이의 신청 가상 시드 삭제 (supabase_seed_appeals.sql 로 넣은 더미)
-- Supabase SQL Editor에서 1회 실행

DELETE FROM public.appeal_follow_ups
WHERE receipt_id IN (
  'VS-2026-001',
  'VS-2026-002',
  'VS-2026-003',
  'VS-2026-004',
  'VS-2026-005',
  'VS-2025-998',
  'VS-2025-997',
  'VS-2025-996'
);

DELETE FROM public.appeals
WHERE receipt_id IN (
  'VS-2026-001',
  'VS-2026-002',
  'VS-2026-003',
  'VS-2026-004',
  'VS-2026-005',
  'VS-2025-998',
  'VS-2025-997',
  'VS-2025-996'
)
OR user_id ~ '^user_[0-9]+$';

SELECT count(*) AS remaining_appeals FROM public.appeals;
