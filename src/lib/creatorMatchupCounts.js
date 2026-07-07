/**
 * Champion 게시물 수 — matchups.user_id(작성자 A) 기준 집계
 */
import { supabase } from './supabase'
import { getCurrentSeason } from './season'

/**
 * @param {string[]} userIds
 * @param {{ seasonOnly?: boolean }} [opts]
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchCreatorMatchupCountMap(userIds, { seasonOnly = false } = {}) {
  const ids = [...new Set((userIds || []).map(String).filter(Boolean))]
  if (ids.length === 0) return {}

  let query = supabase.from('matchups').select('user_id').in('user_id', ids)
  if (seasonOnly) {
    const { startAt } = getCurrentSeason()
    query = query.gte('created_at', startAt.toISOString())
  }

  const { data, error } = await query
  if (error) {
    if (import.meta.env.DEV) console.warn('[fetchCreatorMatchupCountMap]', error.message)
    return {}
  }

  /** @type {Record<string, number>} */
  const map = {}
  for (const row of data || []) {
    if (!row?.user_id) continue
    const key = String(row.user_id)
    map[key] = (map[key] || 0) + 1
  }
  return map
}

/** 프로필 행에 _creatorMatchupCount 부착 */
export async function attachCreatorMatchupCounts(rows, { seasonOnly = false } = {}) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : []
  if (!list.length) return list
  const countMap = await fetchCreatorMatchupCountMap(
    list.map((r) => r.id),
    { seasonOnly },
  )
  return list.map((r) => {
    const fromDb = countMap[String(r.id)]
    const fallback = Number(r.total_matchups) || 0
    return {
      ...r,
      _creatorMatchupCount: fromDb != null ? fromDb : fallback,
    }
  })
}
