-- =============================================
-- VICS Platform — admin_notifications 가상 데이터
-- Supabase SQL Editor에서 실행하세요
-- (supabase_sla_cron.sql 실행 후 사용)
-- =============================================

-- 기존 가상 데이터 초기화 (중복 방지)
delete from public.admin_notifications where related_id in ('ADM-001','ADM-002','ADM-003','ADM-004');

insert into public.admin_notifications (type, title, body, is_read, related_id, created_at)
values
  -- SLA 6h 초과 미처리 문의 (미읽음) — ADM-001: 26시간 전 접수
  (
    'sla',
    'SLA 초과 미처리 문의',
    '"포인트 충전이 안돼요.." — 26시간 미처리 (미답변)',
    false,
    'ADM-001',
    now() - interval '26 hours'
  ),
  -- SLA 6h 초과 미처리 문의 (미읽음) — ADM-002: 14시간 전 접수
  (
    'sla',
    'SLA 초과 미처리 문의',
    '"탈퇴했는데 재가입은.." — 14시간 미처리 (미답변)',
    false,
    'ADM-002',
    now() - interval '14 hours'
  ),
  -- SLA 6h 초과 미처리 문의 (미읽음) — ADM-003: 8시간 전 접수
  (
    'sla',
    'SLA 초과 미처리 문의',
    '"매치업 이미지가 깨져요" — 8시간 미처리 (미답변)',
    false,
    'ADM-003',
    now() - interval '8 hours'
  ),
  -- 시스템 알림 (미읽음)
  (
    'system',
    '시스템 알림',
    '서버 트래픽이 평소보다 높습니다. 모니터링을 권장합니다.',
    false,
    null,
    now() - interval '3 hours'
  ),
  -- SLA 알림 (이미 읽음 처리됨) — ADM-004: 완료된 문의
  (
    'sla',
    'SLA 초과 미처리 문의',
    '"투표 결과가 이상해요" — 답변 완료',
    true,
    'ADM-004',
    now() - interval '2 days'
  ),
  -- 시스템 알림 (이미 읽음 처리됨)
  (
    'system',
    '시스템 알림',
    '어드민 권한 그룹이 수정됐습니다.',
    true,
    null,
    now() - interval '3 days'
  );
