-- =============================================
-- VICS — 시즌 자동 전환 (pg_cron / Scheduled 호출)
-- 선행: supabase_seasons.sql (seasons 테이블, start_new_season, reset_season_stats)
-- Supabase SQL Editor에서 실행하세요.
--
-- start_new_season()은 호출 시마다 무조건 새 행을 넣고 통계를 초기화하므로,
-- 크론에는 반드시 roll_season_if_due()만 연결합니다.
-- =============================================

-- ─────────────────────────────────────────────
-- 1. 시즌 종료 시에만 start_new_season() 실행
--    (동시 실행 방지: 트랜잭션 단위 advisory lock)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.roll_season_if_due()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end timestamptz;
  v_num integer;
  v_new integer;
BEGIN
  PERFORM pg_advisory_xact_lock(8731922679123);

  SELECT s.end_at, s.number
  INTO v_end, v_num
  FROM public.seasons s
  ORDER BY s.number DESC
  LIMIT 1;

  IF v_end IS NULL THEN
    RETURN jsonb_build_object(
      'action', 'no_row',
      'detail', 'public.seasons has no rows; apply supabase_seasons.sql first'
    );
  END IF;

  IF timezone('utc', now()) < v_end THEN
    RETURN jsonb_build_object(
      'action', 'no_op',
      'current_season', v_num,
      'season_ends_at', v_end
    );
  END IF;

  SELECT public.start_new_season() INTO v_new;

  RETURN jsonb_build_object(
    'action', 'rolled',
    'previous_season', v_num,
    'previous_season_ended_at', v_end,
    'new_season_number', v_new
  );
END;
$$;

COMMENT ON FUNCTION public.roll_season_if_due() IS
  'Idempotent season rollover. Safe to run every hour via pg_cron or Edge schedule; calls start_new_season() only when UTC now >= latest seasons.end_at.';

REVOKE ALL ON FUNCTION public.roll_season_if_due() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roll_season_if_due() TO service_role;

-- ─────────────────────────────────────────────
-- 2. pg_cron (Supabase Pro 등 — Dashboard → Database → Extensions → pg_cron 활성화 후)
--    매시 정각 UTC에 검사 (시즌 종료 직후 최대 ~1시간 지연 가능)
-- ─────────────────────────────────────────────

--
-- 재배포 시 이름 충돌이 나면 먼저:
-- SELECT cron.unschedule('vics_roll_season_if_due_hourly');

-- ─────────────────────────────────────────────
-- 3. Supabase Scheduled Edge Functions (대안)
--    service_role로 REST RPC 호출:
--    POST {SUPABASE_URL}/rest/v1/rpc/roll_season_if_due
--    Headers: apikey: SERVICE_ROLE_KEY, Authorization: Bearer SERVICE_ROLE_KEY
--    Body: {}  (또는 비어 있음)
--    Dashboard → Edge Functions → Schedules 에서 위 URL을 1시간마다 호출하는
--    전용 Edge Function을 두어도 됩니다(시크릿에 SERVICE_ROLE_KEY 저장).
-- =============================================
