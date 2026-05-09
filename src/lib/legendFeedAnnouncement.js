import { supabase } from './supabase'

export const LEGEND_FEED_UPDATED = 'vics:legend-feed:updated'

const WINDOW_MS = 10 * 60 * 1000

/** 메인 피드에 동시에 쌓을 수 있는 레전드 배너 최대 개수 (그 이상은 최신 5건만 노출) */
export const LEGEND_FEED_MAX_VISIBLE = 5

/**
 * 최근 10분 이내 레전드 강림 배너 — 최신순 최대 {@link LEGEND_FEED_MAX_VISIBLE}건.
 * 같은 구간에 6건 이상이면 가장 오래된 것부터 조회 결과에서 빠져 노출되지 않습니다.
 * @returns {Promise<Array<{ id: string, nickname: string, user_id: string, created_at: string }>>}
 */
export async function fetchActiveLegendAnnouncements() {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from('legend_feed_announcements')
    .select('id, user_id, nickname, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(LEGEND_FEED_MAX_VISIBLE)

  if (error) {
    if (import.meta.env.DEV) console.warn('[legendFeedAnnouncement]', error.message)
    return []
  }
  if (!Array.isArray(data)) return []
  return data.filter((r) => r?.nickname)
}

/**
 * [전설의 길을 계속 걷기] 클릭 시 — 본인 행만 INSERT
 * @param {string} nickname
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function publishLegendFeedAnnouncement(nickname) {
  const nick = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : 'Victory'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { ok: false, error: '로그인이 필요해요' }

  const { error } = await supabase.from('legend_feed_announcements').insert({
    user_id: user.id,
    nickname: nick,
  })

  if (error) {
    if (import.meta.env.DEV) console.warn('[legendFeedAnnouncement] insert', error.message)
    return { ok: false, error: error.message || '배너 등록에 실패했어요' }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LEGEND_FEED_UPDATED, { detail: { nickname: nick } }))
  }
  return { ok: true }
}
