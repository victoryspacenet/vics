import { supabase } from './supabase'

/**
 * SNS·링크 공유 성공 시 기록 (관리자 유저 유형 집계용)
 * @param {'matchup' | 'ranking' | 'other'} shareKind
 */
export async function logUserShareEvent(shareKind = 'matchup') {
  const kind = shareKind === 'ranking' || shareKind === 'other' ? shareKind : 'matchup'
  try {
    const { error } = await supabase.rpc('log_user_share_event', { p_share_kind: kind })
    if (error) console.warn('[userShareEvent] log:', error.message)
  } catch (e) {
    console.warn('[userShareEvent] log', e?.message || e)
  }
}
