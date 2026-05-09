/**
 * 이의 신청 결과 통보 - 유저용 (Supabase)
 * appeals 테이블에서 decision/reply 필드를 직접 조회합니다.
 */
import { supabase } from './supabase'

/** 접수 번호로 결과 조회 */
export async function getAppealResultByReceiptId(receiptId) {
  const id = (receiptId || '').replace(/^#/, '')
  if (!id) return null
  try {
    const { data, error } = await supabase
      .from('appeals')
      .select('id, receipt_id, decision, reply_to_user, sanction_end_at, notified_at, user_id, nickname, sanction_date, reduced_days')
      .eq('receipt_id', id)
      .single()
    if (error) throw error
    if (!data) return null
    return {
      id:           data.id,
      receiptId:    data.receipt_id,
      decision:     data.decision,
      replyToUser:  data.reply_to_user ?? '',
      sanctionEndAt: data.sanction_end_at ?? null,
      notifiedAt:   data.notified_at ?? null,
      userId:       data.user_id,
      nickname:     data.nickname,
      sanctionDate: data.sanction_date,
      reducedDays:  data.reduced_days ?? null,
    }
  } catch (e) {
    console.warn('[appealResultStorage] 조회 실패:', e)
    return null
  }
}

/**
 * 이의 신청 결과 저장 (관리자 통보 시 호출)
 * appeals 테이블의 해당 행을 업데이트합니다.
 */
export async function saveAppealResult({ receiptId, decision, replyToUser, userId, nickname, sanctionDate, reducedDays, sanctionEndAt }) {
  const id = (receiptId || '').replace(/^#/, '')
  if (!id) return null
  try {
    const { data, error } = await supabase
      .from('appeals')
      .update({
        decision,
        reply_to_user:  replyToUser ?? '',
        reduced_days:   reducedDays ?? null,
        sanction_end_at: sanctionEndAt ?? null,
        notified_at:    new Date().toISOString(),
        status:         'completed',
        updated_at:     new Date().toISOString(),
      })
      .eq('receipt_id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } catch (e) {
    console.warn('[appealResultStorage] 저장 실패:', e)
    return null
  }
}
