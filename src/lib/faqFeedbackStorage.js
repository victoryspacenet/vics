/**
 * FAQ 피드백 — Supabase `faq_feedback_events`
 */
import { supabase } from './supabase'

/**
 * @param {string} faqId
 * @param {'helpful' | 'not_helpful'} value
 * @param {string} [userId] — 없으면 현재 세션 uid
 * @returns {Promise<boolean>}
 */
export async function saveFaqFeedback(faqId, value, userId) {
  if (!faqId || (value !== 'helpful' && value !== 'not_helpful')) return false
  try {
    let uid = userId || null
    if (!uid) {
      const { data: { session } } = await supabase.auth.getSession()
      uid = session?.user?.id || null
    }
    const { error } = await supabase.from('faq_feedback_events').insert({
      faq_id: faqId,
      user_id: uid,
      vote: value,
    })
    if (error) throw error
    return true
  } catch (e) {
    console.warn('[faqFeedbackStorage] 저장 실패:', e)
    return false
  }
}

/**
 * 현재 사용자(또는 지정 uid)의 해당 FAQ 마지막 투표
 * @param {string} faqId
 * @param {string} [userId]
 * @returns {Promise<'helpful' | 'not_helpful' | null>}
 */
export async function getFaqFeedback(faqId, userId) {
  if (!faqId) return null
  try {
    let uid = userId || null
    if (!uid) {
      const { data: { session } } = await supabase.auth.getSession()
      uid = session?.user?.id || null
    }
    if (!uid) return null
    const { data, error } = await supabase
      .from('faq_feedback_events')
      .select('vote')
      .eq('faq_id', faqId)
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    const v = data?.vote
    return v === 'helpful' || v === 'not_helpful' ? v : null
  } catch (e) {
    console.warn('[faqFeedbackStorage] 조회 실패:', e)
    return null
  }
}

/**
 * 운영자용: FAQ별 집계
 * @returns {Promise<Record<string, { helpful: number, notHelpful: number }>>}
 */
export async function getFaqFeedbackStats() {
  try {
    const { data, error } = await supabase.from('faq_feedback_events').select('faq_id, vote')
    if (error) throw error
    const result = {}
    for (const row of data || []) {
      const fid = row.faq_id
      if (!fid) continue
      if (!result[fid]) result[fid] = { helpful: 0, notHelpful: 0 }
      if (row.vote === 'helpful') result[fid].helpful += 1
      else if (row.vote === 'not_helpful') result[fid].notHelpful += 1
    }
    return result
  } catch (e) {
    console.warn('[faqFeedbackStorage] 통계 실패:', e)
    return {}
  }
}
