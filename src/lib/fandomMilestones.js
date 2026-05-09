import { supabase } from './supabase'
import { FANDOM_MILESTONE_DESC } from './fandomTiers'

export const FANDOM_MILESTONE_CLAIMED = 'vics:fandom-milestone:claimed'

/**
 * @param {string} userId
 * @returns {Promise<number[]>}
 */
export async function fetchAckedMilestones(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('fandom_milestone_ack')
    .select('milestone')
    .eq('user_id', userId)
  if (error) {
    if (import.meta.env.DEV) console.warn('[fandomMilestones] ack:', error.message)
    return []
  }
  return (data || []).map((r) => Number(r.milestone)).filter(Number.isFinite)
}

/**
 * 달성했으나 아직 수령 확인 안 한 가장 높은 마일스톤
 * @param {number} totalClaps
 * @param {number[]} acked
 * @returns {number | null}
 */
export function findPendingMilestone(totalClaps, acked) {
  const ack = new Set(acked.map((n) => Number(n)))
  const total = Number(totalClaps || 0)
  for (const m of FANDOM_MILESTONE_DESC) {
    if (total >= m && !ack.has(m)) return m
  }
  return null
}

/**
 * @param {number} milestone
 * @returns {Promise<{ ok: true, fp: number } | { ok: false, error: string }>}
 */
export async function claimFandomMilestoneRpc(milestone) {
  const { data: raw, error } = await supabase.rpc('claim_fandom_milestone', { p_milestone: milestone })
  if (error) {
    return { ok: false, error: error.message || '보상 수령에 실패했어요' }
  }
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: '응답이 올바르지 않아요' }
  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '보상 수령에 실패했어요' }
  }
  const fp = Number(data.fandom_points_granted ?? 0)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FANDOM_MILESTONE_CLAIMED, { detail: { milestone, fp } }))
  }
  return { ok: true, fp }
}

/**
 * @param {string} ownerUserId
 * @param {number} [limit]
 */
export async function fetchRecentFandomCheers(ownerUserId, limit = 12) {
  if (!ownerUserId) return []
  const { data, error } = await supabase
    .from('fandom_cheer_messages')
    .select('id, body, created_at, author_user_id, profiles:author_user_id(nickname)')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (import.meta.env.DEV) console.warn('[fandomMilestones] cheers:', error.message)
    return []
  }
  return data || []
}
