/**
 * 이용 제한 해제 안내 (Welcome Back) — Supabase
 */
import { getRecentlyEndedRestriction } from './warnSanctionStorage'
import { addRestrictionLiftPush } from './noticePushStorage'
import { supabase } from './supabase'

/**
 * @param {string} userId
 * @param {object} profile
 * @returns {Promise<{ endsAt: number, nickname: string, avatarUrl: string | null } | null>}
 */
export async function getPendingWelcomeBack(userId, profile) {
  if (!userId) return null
  const ended = await getRecentlyEndedRestriction(userId)
  if (!ended) return null
  const endsMs = Number(ended.endsAt)
  try {
    const { data, error } = await supabase
      .from('user_welcome_back_acks')
      .select('ends_at_ms')
      .eq('user_id', userId)
      .eq('ends_at_ms', endsMs)
      .maybeSingle()
    if (error) throw error
    if (data) return null
  } catch (e) {
    console.warn('[restrictionLiftStorage] ack 조회 실패:', e)
    return null
  }
  return {
    endsAt: endsMs,
    nickname: profile?.nickname || '회원',
    avatarUrl: profile?.avatar_url || null,
  }
}

/** Welcome Back 팝업 표시 완료 */
export async function markWelcomeBackShown(userId, endsAt) {
  if (!userId || typeof endsAt !== 'number') return
  const endsMs = Math.floor(endsAt)
  try {
    await supabase.from('user_welcome_back_acks').upsert(
      { user_id: userId, ends_at_ms: endsMs, acknowledged_at: new Date().toISOString() },
      { onConflict: 'user_id,ends_at_ms' }
    )
  } catch (e) {
    console.warn('[restrictionLiftStorage] ack 저장 실패:', e)
  }
}

/** 푸시가 아직 없으면 추가 */
export async function ensureRestrictionLiftPush(userId, pending) {
  if (!userId || !pending) return
  const endsMs = Math.floor(Number(pending.endsAt))
  try {
    const { data, error } = await supabase
      .from('restriction_lift_push_sent')
      .select('ends_at_ms')
      .eq('user_id', userId)
      .eq('ends_at_ms', endsMs)
      .maybeSingle()
    if (error) throw error
    if (data) return
  } catch (e) {
    console.warn('[restrictionLiftStorage] 푸시 중복 조회 실패:', e)
    return
  }
  try {
    await addRestrictionLiftPush({
      userId,
      nickname: pending.nickname,
      avatarUrl: pending.avatarUrl,
      title: '🏠 기다렸어요! 이용 제한이 해제되었습니다.',
      body: `${pending.nickname}님, 이제 다시 VICTORYSPACE의 모든 활동이 가능해요. 지금 바로 확인해보세요! ✨`,
      endsAtMs: endsMs,
    })
    await supabase.from('restriction_lift_push_sent').insert({
      user_id: userId,
      ends_at_ms: endsMs,
    })
  } catch (e) {
    console.warn('[restrictionLiftStorage] 푸시 저장 실패:', e)
  }
}
