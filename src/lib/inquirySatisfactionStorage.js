/**
 * 문의 답변 만족도 — Supabase `inquiry_satisfaction`
 */
import { supabase } from './supabase'

/**
 * @param {string} inquiryKey - receipt_id 등 고유 키
 * @param {string} userId
 * @returns {Promise<'good' | 'bad' | null>}
 */
export async function getInquirySatisfaction(inquiryKey, userId) {
  if (!inquiryKey || !userId) return null
  try {
    const { data, error } = await supabase
      .from('inquiry_satisfaction')
      .select('value')
      .eq('user_id', userId)
      .eq('inquiry_key', inquiryKey)
      .maybeSingle()
    if (error) throw error
    return data?.value ?? null
  } catch (e) {
    console.warn('[inquirySatisfactionStorage] 조회 실패:', e)
    return null
  }
}

/**
 * @param {string} inquiryKey
 * @param {'good' | 'bad'} value
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function saveInquirySatisfaction(inquiryKey, value, userId) {
  if (!inquiryKey || !userId || (value !== 'good' && value !== 'bad')) return false
  try {
    const { error } = await supabase.from('inquiry_satisfaction').upsert(
      { user_id: userId, inquiry_key: inquiryKey, value },
      { onConflict: 'user_id,inquiry_key' }
    )
    if (error) throw error
    return true
  } catch (e) {
    console.warn('[inquirySatisfactionStorage] 저장 실패:', e)
    return false
  }
}
