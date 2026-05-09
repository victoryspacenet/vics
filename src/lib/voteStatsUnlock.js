import { supabase } from './supabase'

export const VOTE_STATS_UNLOCK_COST = 800

/** 작성자·활성·양쪽 완성·투표 마감(expires_at 지남) 매치업 — 통계 열람권 구매 후보 */
export async function fetchVoteStatsEligibleMatchups(userId) {
  if (!userId) return []
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('matchups')
    .select(
      'id, title, left_label, right_label, left_thumbnail_url, right_thumbnail_url, total_votes, created_at, expires_at'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('right_type', 'is', null)
    .not('expires_at', 'is', null)
    .lte('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (import.meta.env.DEV) console.warn('[fetchVoteStatsEligibleMatchups]', error.message)
    return []
  }
  return data || []
}

/** 이미 열람권을 산 매치업 id 집합 (RLS: 내가 만든 매치업만) */
export async function fetchVoteStatsUnlockedMatchupIds(userId) {
  if (!userId) return new Set()
  const { data: rows, error } = await supabase.from('matchup_vote_stats_unlocks').select('matchup_id')

  if (error) {
    if (import.meta.env.DEV) console.warn('[fetchVoteStatsUnlockedMatchupIds]', error.message)
    return new Set()
  }
  return new Set((rows || []).map((r) => r.matchup_id).filter(Boolean))
}

/**
 * 열람권 구매 (RPC `purchase_matchup_vote_stats_unlock`)
 * @returns {Promise<{ ok: true, pointsSpent: number } | { ok: false, error: string }>}
 */
export async function purchaseVoteStatsUnlockRpc(matchupId) {
  const { data: raw, error } = await supabase.rpc('purchase_matchup_vote_stats_unlock', {
    p_matchup_id: matchupId,
  })

  if (error) {
    return { ok: false, error: error.message || '구매 요청에 실패했어요' }
  }

  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, error: '응답이 올바르지 않아요' }
  }

  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '구매에 실패했어요' }
  }

  return {
    ok: true,
    pointsSpent: data.points_spent ?? VOTE_STATS_UNLOCK_COST,
  }
}

/**
 * 투표 통계 JSON (RPC `get_matchup_vote_stats`)
 * @returns {Promise<{ ok: true, stats: object } | { ok: false, error: string }>}
 */
export async function fetchMatchupVoteStatsRpc(matchupId) {
  const { data: raw, error } = await supabase.rpc('get_matchup_vote_stats', {
    p_matchup_id: matchupId,
  })

  if (error) {
    return { ok: false, error: error.message || '통계를 불러오지 못했어요' }
  }

  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, error: '응답이 올바르지 않아요' }
  }

  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '통계를 불러올 수 없어요' }
  }

  const { ok, error: _e, ...stats } = data
  return { ok: true, stats }
}
