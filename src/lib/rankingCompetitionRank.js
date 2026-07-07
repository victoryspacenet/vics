import { supabase } from './supabase'
import { getRankingSortValue, rankingSortValuesEqual as sortValuesEqualByConfig } from './rankingPageSort'

/** @deprecated rankingPageSort.getRankingSortValue 사용 권장 */
export function profileRankingSortValue(row, orderCol, config) {
  if (config) return getRankingSortValue(row, config)
  if (orderCol === 'hit_rate') {
    const vt = Number(row?.vote_total) || 0
    if (vt < 1) return -1
    const h = row?.hit_rate
    if (h != null && !Number.isNaN(Number(h))) return Number(h)
    return ((Number(row?.vote_hits) || 0) / vt) * 100
  }
  return Number(row?.[orderCol]) || 0
}

export function rankingSortValuesEqual(a, b, orderColOrConfig) {
  if (orderColOrConfig && typeof orderColOrConfig === 'object' && 'kind' in orderColOrConfig) {
    return sortValuesEqualByConfig(a, b, orderColOrConfig)
  }
  if (orderColOrConfig === 'hit_rate') return Math.abs(Number(a) - Number(b)) < 1e-6
  return Number(a) === Number(b)
}

/**
 * 이미 정렬된 전체 목록에 동순위 반영 (1,1,3 방식).
 * @returns rows with `_displayRank`
 */
export function attachCompetitionRanksInMemory(rows, orderColOrConfig, getValue) {
  if (!rows?.length) return []
  const config = typeof orderColOrConfig === 'object' && orderColOrConfig?.orderCol
    ? orderColOrConfig
    : null
  const orderCol = config?.orderCol ?? orderColOrConfig
  const getVal = getValue || ((r) => profileRankingSortValue(r, orderCol, config))
  const eqKey = config ?? orderCol
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let rank
    if (i === 0) {
      rank = 1
    } else if (rankingSortValuesEqual(getVal(row), getVal(rows[i - 1]), eqKey)) {
      rank = out[i - 1]._displayRank
    } else {
      rank = i + 1
    }
    out.push({ ...row, _displayRank: rank })
  }
  return out
}

/**
 * 페이지네이션된 랭킹 목록 — DB에서 “더 높은 점수” 인원 수로 전역 동순위 계산.
 * @param {{ sortConfig: import('./rankingPageSort').getRankingPageSortConfig extends (...args: any) => infer R ? R : never, eligibleIds?: string[] }} options
 */
export async function attachCompetitionRanksForPage(rows, { sortConfig, orderCol, eligibleIds, isCreator }) {
  if (!rows?.length) return []

  const config = sortConfig ?? null
  const col = config?.orderCol ?? orderCol
  const getVal = (r) => profileRankingSortValue(r, col, config)
  const eqKey = config ?? col
  const countCache = new Map()

  async function displayRankForValue(v) {
    const cacheKey =
      (config?.kind === 'hit_rate' || col === 'hit_rate') ? `h:${Number(v).toFixed(6)}` : `n:${col}:${v}`
    if (countCache.has(cacheKey)) return countCache.get(cacheKey)

    let q = supabase.from('profiles').select('id', { count: 'exact', head: true }).gt(col, v)
    if (eligibleIds?.length) q = q.in('id', eligibleIds)
    const minVotes = config?.requireMinVoteTotal
    if (minVotes != null) q = q.gte('vote_total', minVotes)

    const { count, error } = await q
    if (error && import.meta.env.DEV) {
      console.warn('[attachCompetitionRanksForPage]', error.message)
    }
    const rank = (count ?? 0) + 1
    countCache.set(cacheKey, rank)
    return rank
  }

  const valuesNeedingCount = []
  for (let i = 0; i < rows.length; i++) {
    const v = getVal(rows[i])
    if (i > 0 && rankingSortValuesEqual(v, getVal(rows[i - 1]), eqKey)) continue
    const cacheKey =
      (config?.kind === 'hit_rate' || col === 'hit_rate') ? `h:${Number(v).toFixed(6)}` : `n:${col}:${v}`
    if (!countCache.has(cacheKey)) valuesNeedingCount.push(v)
  }

  await Promise.all(valuesNeedingCount.map((v) => displayRankForValue(v)))

  const out = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const v = getVal(row)
    let rank
    if (i > 0 && rankingSortValuesEqual(v, getVal(rows[i - 1]), eqKey)) {
      rank = out[i - 1]._displayRank
    } else {
      const cacheKey =
        (config?.kind === 'hit_rate' || col === 'hit_rate') ? `h:${Number(v).toFixed(6)}` : `n:${col}:${v}`
      rank = countCache.get(cacheKey) ?? (await displayRankForValue(v))
    }
    out.push({ ...row, _displayRank: rank })
  }
  return out
}
