import { supabase } from './supabase'

/**
 * 마감·미정산 매치업 포인트 정산 (DB RPC).
 * LEFT·RIGHT(도전자) Creator 포인트 + Voter Oracle 포인트를 서비스 소개 규정대로 1회 지급.
 * @returns {Promise<number|null>} 정산된 매치업 수 (실패 시 null)
 */
export async function requestDueMatchupSettlement() {
  try {
    const { data, error } = await supabase.rpc('settle_all_due_matchup_results')
    if (error) {
      if (/settle_all_due_matchup_results|function.*does not exist/i.test(error.message || '')) {
        return null
      }
      throw error
    }
    return typeof data === 'number' ? data : Number(data) || 0
  } catch {
    return null
  }
}

/**
 * 단일 매치업 정산 시도 (상세·마이페이지 등)
 * @param {string} matchupId
 */
export async function requestMatchupSettlement(matchupId) {
  if (!matchupId) return false
  try {
    const { data, error } = await supabase.rpc('settle_matchup_result_points', {
      p_matchup_id: matchupId,
    })
    if (error) {
      if (/settle_matchup_result_points|function.*does not exist/i.test(error.message || '')) {
        return false
      }
      throw error
    }
    return data === true
  } catch {
    return false
  }
}
