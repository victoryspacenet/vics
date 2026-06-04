-- ============================================================
-- 제재(경고) 결과 이의: 해당 경고 발부 시각 기준 24시간 이내, 경고당 1회
-- 선행: supabase_appeals.sql, user_moderation_warnings / user_moderation_restrictions
-- ============================================================

ALTER TABLE public.appeals
  ADD COLUMN IF NOT EXISTS appeal_kind text NOT NULL DEFAULT 'sanction';

-- ── 1) 제한 행 ↔ 경고 행 연결 (sendWarning에서 채움) ───────────
ALTER TABLE public.user_moderation_restrictions
  ADD COLUMN IF NOT EXISTS source_warning_id uuid REFERENCES public.user_moderation_warnings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_moderation_restrictions.source_warning_id IS '경고 발부와 짝이 되는 제한 행 식별 (이의 신청 시 경고 id 전달용)';

-- ── 2) 이의 행에 대상 경고 id ─────────────────────────────────
ALTER TABLE public.appeals
  ADD COLUMN IF NOT EXISTS sanction_warning_id uuid REFERENCES public.user_moderation_warnings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appeals.sanction_warning_id IS '제재 이의일 때 대상 경고(user_moderation_warnings.id). 24h·1회 규칙의 기준.';

-- ── 3) 동일 유저·동일 경고에 대한 제재 이의 1건만 ───────────────
CREATE UNIQUE INDEX IF NOT EXISTS appeals_one_sanction_per_warning
  ON public.appeals (user_id, sanction_warning_id)
  WHERE appeal_kind = 'sanction' AND sanction_warning_id IS NOT NULL;

-- ── 4) INSERT 검증 (제재 이의만) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.appeals_validate_sanction_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
BEGIN
  IF NEW.appeal_kind IS DISTINCT FROM 'sanction' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM (auth.uid())::text THEN
    RAISE EXCEPTION 'APPEAL_FORBIDDEN_USER' USING ERRCODE = '42501';
  END IF;

  IF NEW.sanction_warning_id IS NULL THEN
    RAISE EXCEPTION 'SANCTION_WARNING_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, subject_user_id, created_at INTO w
  FROM public.user_moderation_warnings
  WHERE id = NEW.sanction_warning_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SANCTION_WARNING_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF w.subject_user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'SANCTION_WARNING_WRONG_USER' USING ERRCODE = 'P0001';
  END IF;

  IF timezone('utc', now()) > (w.created_at + interval '24 hours') THEN
    RAISE EXCEPTION 'APPEAL_WINDOW_CLOSED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appeals_validate_sanction_result ON public.appeals;
CREATE TRIGGER appeals_validate_sanction_result
  BEFORE INSERT ON public.appeals
  FOR EACH ROW
  EXECUTE FUNCTION public.appeals_validate_sanction_result();
