/**
 * 이의제기 추가 질문 (연속 이의제기) - Supabase
 */
import { supabase } from './supabase'

/** receiptId별 추가 이의제기 목록 */
export async function getAppealFollowUps(receiptId) {
  const id = (receiptId || '').replace(/^#/, '')
  if (!id) return []
  try {
    const { data, error } = await supabase
      .from('appeal_follow_ups')
      .select('*')
      .eq('receipt_id', id)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row) => ({
      id:        row.id,
      content:   row.content,
      role:      row.role,
      createdAt: row.created_at,
    }))
  } catch (e) {
    console.warn('[appealFollowUpStorage] 조회 실패:', e)
    return []
  }
}

/** 추가 이의제기 저장 */
export async function addAppealFollowUp(receiptId, content) {
  const id = (receiptId || '').replace(/^#/, '')
  if (!id) return []
  try {
    await supabase.from('appeal_follow_ups').insert({
      receipt_id: id,
      content,
      role: 'user',
    })
    return getAppealFollowUps(id)
  } catch (e) {
    console.warn('[appealFollowUpStorage] 저장 실패:', e)
    return []
  }
}

/** 해당 접수번호의 추가 이의제기 전체 삭제 */
export async function removeAppealFollowUpsForReceipt(receiptId) {
  const id = (receiptId || '').replace(/^#/, '')
  if (!id) return
  try {
    await supabase.from('appeal_follow_ups').delete().eq('receipt_id', id)
  } catch (e) {
    console.warn('[appealFollowUpStorage] 삭제 실패:', e)
  }
}
