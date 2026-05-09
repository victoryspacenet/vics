import { supabase } from './supabase'

export const VCARD_CLAPS_UPDATED = 'vics:vcard-claps:updated'

/**
 * @param {string} ownerUserId — 축하를 받는 프로필(카드 주인) id
 * @returns {Promise<{ total: number, hasClapped: boolean, error: Error | null }>}
 */
export async function fetchVcardClapStats(ownerUserId) {
  if (!ownerUserId) return { total: 0, hasClapped: false, error: null }
  const { data, error } = await supabase.rpc('vcard_clap_stats', { p_owner: ownerUserId })
  if (error) return { total: 0, hasClapped: false, error }
  const row = Array.isArray(data) ? data[0] : data
  return {
    total: Number(row?.total_claps ?? 0),
    hasClapped: Boolean(row?.viewer_has_clapped),
    error: null,
  }
}

/**
 * 이번 주(최근 7일) / 지난 주(8~14일 전) Clap 수와 증가율 반환
 * @param {string} ownerUserId
 * @returns {Promise<{
 *   thisWeek: number,
 *   lastWeek: number,
 *   growthRate: number | null,   // null = 지난주 0이어서 계산 불가
 *   isNew: boolean               // 이번 주에 처음 Clap 발생 (지난주 0, 이번주 > 0)
 * }>}
 */
export async function fetchFandomWeeklyGrowth(ownerUserId) {
  const empty = { thisWeek: 0, lastWeek: 0, growthRate: null, isNew: false }
  if (!ownerUserId) return empty
  const { data, error } = await supabase.rpc('get_fandom_weekly_growth', { p_owner: ownerUserId })
  if (error) {
    if (import.meta.env.DEV) console.warn('[fetchFandomWeeklyGrowth]', error.message)
    return empty
  }
  const row = typeof data === 'string' ? JSON.parse(data) : data
  const thisWeek = Number(row?.this_week ?? 0)
  const lastWeek = Number(row?.last_week ?? 0)
  const isNew = lastWeek === 0 && thisWeek > 0
  const growthRate =
    lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null
  return { thisWeek, lastWeek, growthRate, isNew }
}

/**
 * 시청자가 카드 주인에게 축하 1회 기록 (UNIQUE로 계정당 1회)
 * @param {string} ownerUserId
 * @returns {Promise<{ ok: boolean, reason?: 'login' | 'self' | 'duplicate' | 'unknown' }>}
 */
export async function recordVcardClap(ownerUserId) {
  if (!ownerUserId) return { ok: false, reason: 'unknown' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { ok: false, reason: 'login' }
  if (user.id === ownerUserId) return { ok: false, reason: 'self' }

  const { error } = await supabase.from('vcard_story_claps').insert({
    owner_user_id: ownerUserId,
    clapper_user_id: user.id,
  })

  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' }
    return { ok: false, reason: 'unknown' }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VCARD_CLAPS_UPDATED, { detail: { ownerUserId } }))
  }
  return { ok: true }
}
