import { supabase } from './supabase'

/**
 * 내가 만든 도전자 대기 NEW 매치업
 * (`status` active, `right_type` 없음, 만료 전) — 메인 피드 NEW 탭과 동일 기준
 * @param {string} userId
 * @returns {Promise<{ data: object[], error: object | null }>}
 */
export async function fetchMyNewMatchupsWaiting(userId) {
  if (!userId) return { data: [], error: null }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('matchups')
    .select('id, title, category, created_at, left_label, right_label')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('right_type', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(50)

  return { data: data ?? [], error }
}
