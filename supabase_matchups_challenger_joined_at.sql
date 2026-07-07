-- ============================================================
-- VICS — 도전자(B) 최종 매치업 등록 시각
-- 관리자 매치업 목록 「최종매치업등록일」 표시용
-- ============================================================

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS challenger_joined_at timestamptz;

COMMENT ON COLUMN public.matchups.challenger_joined_at IS
  '도전자(B)가 right_type·right_user_id를 최초 등록한 시각 (최종 매치업 등록일)';

CREATE INDEX IF NOT EXISTS matchups_challenger_joined_at_idx
  ON public.matchups (challenger_joined_at DESC NULLS LAST)
  WHERE right_type IS NOT NULL;

-- 기존 데이터: B측 완성 시각은 updated_at으로 추정
UPDATE public.matchups
SET challenger_joined_at = updated_at
WHERE right_type IS NOT NULL
  AND challenger_joined_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_matchup_challenger_joined_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.right_type IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.right_type IS NULL) THEN
    IF NEW.challenger_joined_at IS NULL THEN
      NEW.challenger_joined_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matchups_challenger_joined_at ON public.matchups;
CREATE TRIGGER trg_matchups_challenger_joined_at
  BEFORE INSERT OR UPDATE OF right_type ON public.matchups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_matchup_challenger_joined_at();
