import { supabase } from './supabase'
import { MY_PAGE_MATCHUP_CARD_COLUMNS } from './matchupQueryColumns'
import { mapTierSnapshotRow } from './creatorRankSnapshot'

const VOTES_SELECT = `side, matchup_id, created_at, matchups(${MY_PAGE_MATCHUP_CARD_COLUMNS})`

/**
 * 마이페이지 초기 로드 — created / votes / 티어 스냅샷 병렬
 * @param {string} userId
 */
export async function fetchMyPageListsBundle(userId) {
  const [createdRes, votesRes, tierRes] = await Promise.all([
    supabase
      .from('matchups')
      .select(MY_PAGE_MATCHUP_CARD_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('votes')
      .select(VOTES_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase.rpc('profiles_tier_rank_snapshot_for_ids', { p_ids: [userId] }),
  ])

  if (createdRes.error) throw createdRes.error
  if (votesRes.error) throw votesRes.error
  if (tierRes.error) throw tierRes.error

  const tierInfo = mapTierSnapshotRow(tierRes.data?.[0])
  const rank =
    tierInfo.overallRank != null && tierInfo.overallRank > 0 ? tierInfo.overallRank : '-'

  return {
    createdMatchups: createdRes.data || [],
    votedMatchups: votesRes.data || [],
    stats: {
      rank,
      totalUsers: tierInfo.totalUsers || 0,
    },
    tierRankSnapshot: tierInfo,
  }
}
