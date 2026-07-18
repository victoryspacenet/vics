import { supabase } from './supabase'
import { MY_PAGE_MATCHUP_CARD_COLUMNS } from './matchupQueryColumns'
import { getMatchupRegisteredAtIso } from './matchupRegisteredAt'
import { mapTierSnapshotRow } from './creatorRankSnapshot'
import { requestDueMatchupSettlement } from './matchupResultSettlement'

const VOTES_SELECT = `side, matchup_id, created_at, matchups(${MY_PAGE_MATCHUP_CARD_COLUMNS})`

/**
 * 마이페이지 초기 로드 — created / votes / 티어 스냅샷 병렬
 * @param {string} userId
 */
export async function fetchMyPageListsBundle(userId) {
  await requestDueMatchupSettlement()

  const [createdRes, challengedRes, votesRes, tierRes] = await Promise.all([
    supabase
      .from('matchups')
      .select(MY_PAGE_MATCHUP_CARD_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('matchups')
      .select(MY_PAGE_MATCHUP_CARD_COLUMNS)
      .eq('right_user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('votes')
      .select(VOTES_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase.rpc('profiles_tier_rank_snapshot_for_ids', { p_ids: [userId] }),
  ])

  if (createdRes.error) throw createdRes.error
  if (challengedRes.error) throw challengedRes.error
  if (votesRes.error) throw votesRes.error
  if (tierRes.error) throw tierRes.error

  const tierInfo = mapTierSnapshotRow(tierRes.data?.[0])
  const rank =
    tierInfo.overallRank != null && tierInfo.overallRank > 0 ? tierInfo.overallRank : '-'

  return {
    createdMatchups: createdRes.data || [],
    challengedMatchups: challengedRes.data || [],
    votedMatchups: votesRes.data || [],
    stats: {
      rank,
      totalUsers: tierInfo.totalUsers || 0,
    },
    tierRankSnapshot: tierInfo,
  }
}

/**
 * 생성(A) + 도전 참여(B) 매치업을 마이페이지 「내가 만든 매치업」 탭용으로 합칩니다.
 * @param {object[]} created
 * @param {object[]} challenged
 * @param {string} [userId]
 */
export function mergeMyLedMatchups(created = [], challenged = [], userId) {
  const result = []
  const seen = new Set()

  for (const m of created) {
    if (!m?.id || seen.has(m.id)) continue
    seen.add(m.id)
    result.push({ ...m, _myRole: 'creator', _sortAt: getMatchupRegisteredAtIso(m) || m.created_at })
  }

  for (const m of challenged) {
    if (!m?.id || seen.has(m.id)) continue
    if (userId && m.user_id === userId) continue
    seen.add(m.id)
    result.push({
      ...m,
      _myRole: 'challenger',
      _sortAt: getMatchupRegisteredAtIso(m) || m.created_at,
    })
  }

  return result
}
