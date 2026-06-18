-- Netlify /api/vote — auth.uid() + INSERT 단일 RPC (getUser + insert 왕복 1회로 축소)
-- Supabase SQL Editor에서 1회 실행

CREATE OR REPLACE FUNCTION public.cast_vote(
  p_matchup_id uuid,
  p_side text,
  p_ip_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요해요' USING ERRCODE = '42501';
  END IF;
  IF p_matchup_id IS NULL THEN
    RAISE EXCEPTION 'matchup_id가 필요해요' USING ERRCODE = '22023';
  END IF;
  IF p_side IS NULL OR p_side NOT IN ('left', 'right') THEN
    RAISE EXCEPTION 'side(left/right)가 필요해요' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.votes (user_id, matchup_id, side, ip_address)
  VALUES (v_uid, p_matchup_id, p_side, NULLIF(trim(p_ip_address), ''));
END;
$$;

COMMENT ON FUNCTION public.cast_vote(uuid, text, text) IS
  'Netlify vote API — JWT로 auth.uid() 검증 후 votes INSERT (IP 한도·집계 트리거 동일 적용)';

REVOKE ALL ON FUNCTION public.cast_vote(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, text, text) TO authenticated;
