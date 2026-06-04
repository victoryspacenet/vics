-- ============================================================
-- 매치업 결과 이의 제거 (예전 supabase_appeals_matchup_result.sql 적용 DB용)
-- 한 번만 실행하면 됩니다. 이후 매치업 결과 이의는 사용하지 않습니다.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appeals' AND column_name = 'appeal_kind'
  ) THEN
    UPDATE public.appeals
    SET appeal_kind = 'sanction'
    WHERE appeal_kind = 'matchup_result';
  END IF;
END $$;

DROP TRIGGER IF EXISTS appeals_validate_matchup_result ON public.appeals;

DROP FUNCTION IF EXISTS public.appeals_validate_matchup_result();

DROP INDEX IF EXISTS public.appeals_one_matchup_result_per_user;

ALTER TABLE public.appeals DROP CONSTRAINT IF EXISTS appeals_matchup_kind_consistency;
ALTER TABLE public.appeals DROP CONSTRAINT IF EXISTS appeals_appeal_kind_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appeals' AND column_name = 'appeal_kind'
  ) THEN
    ALTER TABLE public.appeals
      ADD CONSTRAINT appeals_appeal_kind_check CHECK (appeal_kind = 'sanction');
  END IF;
END $$;

ALTER TABLE public.appeals DROP COLUMN IF EXISTS matchup_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appeals' AND column_name = 'appeal_kind'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.appeals.appeal_kind IS ''이의 종류: 제재 이의만 사용 (sanction)''';
  END IF;
END $$;
