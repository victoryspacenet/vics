-- 메인·/matchups 피드·투표·참여(engagement) 배치 조회 성능 인덱스
-- Supabase SQL Editor에서 1회 실행 (IF NOT EXISTS — 재실행 안전)

-- 완료(active) 매치업: 투표수·최신순 (베스트·HOT 후보)
CREATE INDEX IF NOT EXISTS matchups_active_complete_votes_idx
  ON public.matchups (total_votes DESC NULLS LAST, created_at DESC)
  WHERE status = 'active' AND right_type IS NOT NULL;

-- NEW(미완료) 매치업: 최신순
CREATE INDEX IF NOT EXISTS matchups_active_new_created_idx
  ON public.matchups (created_at DESC)
  WHERE status = 'active' AND right_type IS NULL;

-- /matchups 활성 목록: 만료 필터 + 최신/인기 정렬
CREATE INDEX IF NOT EXISTS matchups_active_complete_created_idx
  ON public.matchups (created_at DESC)
  WHERE status = 'active' AND right_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS matchups_active_category_created_idx
  ON public.matchups (category, created_at DESC)
  WHERE status = 'active' AND right_type IS NOT NULL;

-- 로그인 피드: 유저별 투표·좋아요 배치 (user_id + matchup_id IN (...))
CREATE INDEX IF NOT EXISTS votes_user_matchup_idx
  ON public.votes (user_id, matchup_id);

CREATE INDEX IF NOT EXISTS likes_user_matchup_idx
  ON public.likes (user_id, matchup_id);
