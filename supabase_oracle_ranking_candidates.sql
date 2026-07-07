-- =============================================================================
-- VICS — The Oracle 랭킹 후보 (votes 테이블 기준)
-- Supabase SQL Editor에서 실행하세요.
--
-- vote_total / oracle_points / hit_rate 는 매치업 결과 정산 시 profiles 에 반영됩니다.
-- 투표만 하고 정산 전인 유저도 Oracle 포인트 랭킹 후보에 포함하려면 votes 기준이 필요합니다.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.profiles_oracle_ranking_candidate_ids()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE public.rank_profile_eligible_for_board(p.id)
    AND EXISTS (SELECT 1 FROM public.votes v WHERE v.user_id = p.id);
$$;

COMMENT ON FUNCTION public.profiles_oracle_ranking_candidate_ids() IS
  'The Oracle 포인트 랭킹: 1회 이상 투표한 공개 후보 프로필 id';

CREATE OR REPLACE FUNCTION public.profiles_oracle_hitrate_candidate_ids()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE public.rank_profile_eligible_for_board(p.id)
    AND (
      coalesce(p.vote_total, 0) >= 1
      OR EXISTS (
        SELECT 1
        FROM public.votes v
        INNER JOIN public.matchups m ON m.id = v.matchup_id
        WHERE v.user_id = p.id
          AND m.right_type IS NOT NULL
      )
    );
$$;

COMMENT ON FUNCTION public.profiles_oracle_hitrate_candidate_ids() IS
  'The Oracle 적중률 랭킹: 정산된 투표(vote_total≥1) 또는 완료 매치업에 투표한 후보';

REVOKE ALL ON FUNCTION public.profiles_oracle_ranking_candidate_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profiles_oracle_hitrate_candidate_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profiles_oracle_ranking_candidate_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_oracle_hitrate_candidate_ids() TO anon, authenticated;
