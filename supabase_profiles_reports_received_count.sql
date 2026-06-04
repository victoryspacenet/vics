-- ============================================================
-- profiles.reports_received_count: 매치업 신고 피신고자 누적 건수
--   - matchup_reports INSERT/DELETE 시 트리거로 유지
--   - 기존 데이터는 백필
-- Supabase SQL Editor에서 실행. 선행: public.matchups, public.matchup_reports, public.profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reports_received_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.reports_received_count IS
  '매치업 측 신고(matchup_reports)로 피신고된 누적 건수. 관리자 목록 정렬·표시용.';

CREATE INDEX IF NOT EXISTS profiles_reports_received_count_idx
  ON public.profiles (reports_received_count DESC, id);

-- ── 백필: 기존 matchup_reports 기준으로 집계 ─────────────────
WITH expanded AS (
  SELECT
    CASE mr.reported_side
      WHEN 'left' THEN m.user_id
      WHEN 'right' THEN m.right_user_id
    END AS reported_user_id
  FROM public.matchup_reports mr
  JOIN public.matchups m ON m.id = mr.matchup_id
)
UPDATE public.profiles p
SET reports_received_count = COALESCE(agg.cnt, 0),
    updated_at = now()
FROM (
  SELECT reported_user_id, count(*)::integer AS cnt
  FROM expanded
  WHERE reported_user_id IS NOT NULL
  GROUP BY reported_user_id
) agg
WHERE p.id = agg.reported_user_id;

-- 신고 이력이 없는 프로필은 ADD COLUMN 시 DEFAULT 0 유지

-- ── 트리거: INSERT +1, DELETE -1 ────────────────────────────
CREATE OR REPLACE FUNCTION public.matchup_reports_maintain_profile_report_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reported uuid;
  v_delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := 1;
    SELECT CASE NEW.reported_side
      WHEN 'left' THEN m.user_id
      WHEN 'right' THEN m.right_user_id
    END
    INTO v_reported
    FROM public.matchups m
    WHERE m.id = NEW.matchup_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -1;
    SELECT CASE OLD.reported_side
      WHEN 'left' THEN m.user_id
      WHEN 'right' THEN m.right_user_id
    END
    INTO v_reported
    FROM public.matchups m
    WHERE m.id = OLD.matchup_id;
  ELSE
    RETURN NULL;
  END IF;

  IF v_reported IS NOT NULL THEN
    UPDATE public.profiles
    SET
      reports_received_count = greatest(0, coalesce(reports_received_count, 0) + v_delta),
      updated_at = now()
    WHERE id = v_reported;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.matchup_reports_maintain_profile_report_count() IS
  'matchup_reports 행 추가/삭제 시 피신고 프로필의 reports_received_count 증감.';

DROP TRIGGER IF EXISTS trg_matchup_reports_count_ins ON public.matchup_reports;
CREATE TRIGGER trg_matchup_reports_count_ins
  AFTER INSERT ON public.matchup_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.matchup_reports_maintain_profile_report_count();

DROP TRIGGER IF EXISTS trg_matchup_reports_count_del ON public.matchup_reports;
CREATE TRIGGER trg_matchup_reports_count_del
  AFTER DELETE ON public.matchup_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.matchup_reports_maintain_profile_report_count();

REVOKE ALL ON FUNCTION public.matchup_reports_maintain_profile_report_count() FROM PUBLIC;
