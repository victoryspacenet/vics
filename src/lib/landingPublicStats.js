import { supabase } from './supabase'

/**
 * 랜딩 히어로 통계 (Supabase 실데이터).
 * `get_landing_public_stats` RPC가 있으면 투표 참여자 수(distinct)까지 정확히 반환하고,
 * 없으면 matchups / votes / profiles head count로 대체합니다.
 */
export async function fetchLandingPublicStats() {
  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_landing_public_stats')
  const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
  if (!rpcError && rpcRow && rpcRow.matchup_count != null) {
    return {
      matchupCount: Number(rpcRow.matchup_count) || 0,
      voteCount: Number(rpcRow.vote_count) || 0,
      activeUserCount: Number(rpcRow.voter_count) || 0,
    }
  }

  const [m, v, p] = await Promise.all([
    supabase
      .from('matchups')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'closed']),
    supabase.from('votes').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  return {
    matchupCount: m.count ?? 0,
    voteCount: v.count ?? 0,
    activeUserCount: p.count ?? 0,
  }
}
