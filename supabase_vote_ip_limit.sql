-- =============================================
-- VICS - 동일 IP/기기 무한 투표 방지
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. votes 테이블에 ip_address 컬럼 추가
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS ip_address text;

-- 2. IP당 매치업별 최대 투표 수 (같은 공유기/가정 내 3명까지 허용)
-- 매치업당 동일 IP에서 최대 3표까지만 허용
CREATE OR REPLACE FUNCTION check_vote_ip_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count int;
  v_max_per_ip int := 3;
BEGIN
  -- ip_address가 없으면 기존 동작 유지 (마이그레이션 호환)
  IF NEW.ip_address IS NULL OR NEW.ip_address = '' THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.votes
  WHERE matchup_id = NEW.matchup_id
    AND ip_address = NEW.ip_address
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_count >= v_max_per_ip THEN
    RAISE EXCEPTION 'VOTE_IP_LIMIT: 이 기기/네트워크에서 해당 매치업에 대한 투표 한도를 초과했어요 (최대 %s표)', v_max_per_ip
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_vote_insert_ip_check ON public.votes;
CREATE TRIGGER before_vote_insert_ip_check
  BEFORE INSERT ON public.votes
  FOR EACH ROW EXECUTE FUNCTION check_vote_ip_limit();

-- 3. 인덱스 (IP 기반 조회 최적화)
CREATE INDEX IF NOT EXISTS votes_matchup_ip_idx ON public.votes(matchup_id, ip_address)
  WHERE ip_address IS NOT NULL;
