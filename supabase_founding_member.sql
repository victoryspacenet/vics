-- =============================================
-- VICS — 창립 멤버 (Founding Member) 1~1,000번 가입자
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_member_number integer DEFAULT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_founding_member_number_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_founding_member_number_check
  CHECK (
    founding_member_number IS NULL
    OR (founding_member_number >= 1 AND founding_member_number <= 1000)
  );

CREATE UNIQUE INDEX IF NOT EXISTS profiles_founding_member_number_unique_idx
  ON public.profiles (founding_member_number)
  WHERE founding_member_number IS NOT NULL;

COMMENT ON COLUMN public.profiles.founding_member_number IS
  '창립 멤버(Founding Member) 가입 순번 1~1000. NULL=해당 없음. 클라이언트 수정 불가.';

-- ── 기존 유저 백필 (created_at → id tie-break) ───────────────────────────────
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.profiles
)
UPDATE public.profiles p
SET founding_member_number = r.rn
FROM ranked r
WHERE p.id = r.id
  AND r.rn <= 1000
  AND p.founding_member_number IS NULL;

-- ── 신규 profiles INSERT 시 순번 부여 (최대 1,000명) ───────────────────────
CREATE OR REPLACE FUNCTION public.assign_founding_member_on_profile_insert ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  IF NEW.founding_member_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(90421001);

  SELECT coalesce(max(founding_member_number), 0) + 1
  INTO v_next
  FROM public.profiles;

  IF v_next <= 1000 THEN
    NEW.founding_member_number := v_next;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_assign_founding_member ON public.profiles;
CREATE TRIGGER trg_profiles_assign_founding_member
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_founding_member_on_profile_insert ();

-- ── 클라이언트 UPDATE 로 순번 변경 방지 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_founding_member_guard ()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.founding_member_number IS DISTINCT FROM OLD.founding_member_number THEN
      NEW.founding_member_number := OLD.founding_member_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_founding_member_guard ON public.profiles;
CREATE TRIGGER trg_profiles_founding_member_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_founding_member_guard ();

COMMENT ON FUNCTION public.assign_founding_member_on_profile_insert IS
  'profiles INSERT 시 창립 멤버 순번 1~1000 자동 부여';
