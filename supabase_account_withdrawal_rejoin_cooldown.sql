-- =============================================
-- VICS - 탈퇴(프로필 삭제) 후 동일 이메일 재가입 7일 쿨다운
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

CREATE TABLE IF NOT EXISTS public.account_withdrawal_cooldowns (
  email_lower   text PRIMARY KEY,
  withdrawn_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.account_withdrawal_cooldowns IS
  '프로필 삭제 시점 기준 동일 이메일(lower) 재가입 7일 제한';

CREATE INDEX IF NOT EXISTS idx_account_withdrawal_cooldowns_withdrawn_at
  ON public.account_withdrawal_cooldowns (withdrawn_at DESC);

ALTER TABLE public.account_withdrawal_cooldowns ENABLE ROW LEVEL SECURITY;

-- 트리거(SECURITY DEFINER)만 접근; 클라이언트 직접 조회·수정 불가

-- 탈퇴: 본인이 자신의 profiles 행을 삭제할 때만 이메일 기록
CREATE OR REPLACE FUNCTION public.record_profile_withdrawal_for_rejoin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  em text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM OLD.id THEN
    RETURN OLD;
  END IF;
  em := NULLIF(lower(trim(COALESCE(OLD.email, ''))), '');
  IF em IS NULL THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.account_withdrawal_cooldowns (email_lower, withdrawn_at)
  VALUES (em, now())
  ON CONFLICT (email_lower) DO UPDATE SET withdrawn_at = EXCLUDED.withdrawn_at;
  RETURN OLD;
END;
$$;

-- 재가입: 쿨다운 중이면 profiles INSERT 차단 (handle_new_user / 클라이언트 insert 공통)
CREATE OR REPLACE FUNCTION public.enforce_profile_rejoin_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w  timestamptz;
  em text;
BEGIN
  em := NULLIF(lower(trim(COALESCE(NEW.email, ''))), '');
  IF em IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT c.withdrawn_at INTO w
  FROM public.account_withdrawal_cooldowns c
  WHERE c.email_lower = em;
  IF w IS NULL THEN
    RETURN NEW;
  END IF;
  IF w > now() - interval '7 days' THEN
    RAISE EXCEPTION 'REJOIN_COOLDOWN_7D';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_record_withdrawal_rejoin ON public.profiles;
CREATE TRIGGER trg_profiles_record_withdrawal_rejoin
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.record_profile_withdrawal_for_rejoin();

DROP TRIGGER IF EXISTS trg_profiles_enforce_rejoin_cooldown ON public.profiles;
CREATE TRIGGER trg_profiles_enforce_rejoin_cooldown
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_rejoin_cooldown();
