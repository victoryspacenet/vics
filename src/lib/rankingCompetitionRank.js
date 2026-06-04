import { supabase } from './supabase'

/** 랭킹 정렬·동순위 판정용 수치 */
export function profileRankingSortValue(row, orderCol) {
  if (orderCol === 'hit_rate') {
    const vt = Number(row?.vote_total) || 0
    if (vt < 1) return -1
    const h = row?.hit_rate
    if (h != null && !Number.isNaN(Number(h))) return Number(h)
    return ((Number(row?.vote_hits) || 0) / vt) * 100
  }
  return Number(row?.[orderCol]) || 0
}

export function rankingSortValuesEqual(a, b, orderCol) {
  if (orderCol === 'hit_rate') return Math.abs(Number(a) - Number(b)) < 1e-6
  return Number(a) === Number(b)
}

/**
 * 이미 정렬된 전체 목록에 동순위 반영 (1,1,3 방식).
 * @returns rows with `_displayRank`
 */
export function attachCompetitionRanksInMemory(rows, orderCol, getValue) {
  if (!rows?.length) return []
  const getVal = getValue || ((r) => profileRankingSortValue(r, orderCol))
  const eqCol = orderCol || 'points'
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let rank
    if (i === 0) {
      rank = 1
    } else if (rankingSortValuesEqual(getVal(row), getVal(rows[i - 1]), eqCol)) {
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
 */
export async function attachCompetitionRanksForPage(rows, { orderCol, eligibleIds, isCreator }) {
  if (!rows?.length) return []

  const getVal = (r) => profileRankingSortValue(r, orderCol)
  const countCache = new Map()

  async function displayRankForValue(v) {
    const cacheKey =
      orderCol === 'hit_rate' ? `h:${Number(v).toFixed(6)}` : `n:${orderCol}:${v}`
    if (countCache.has(cacheKey)) return countCache.get(cacheKey)

    let q = supabase.from('profiles').select('id', { count: 'exact', head: true }).gt(orderCol, v)
    if (eligibleIds?.length) q = q.in('id', eligibleIds)
    if (!isCreator && orderCol === 'hit_rate') q = q.gte('vote_total', 1)

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
    if (i > 0 && rankingSortValuesEqual(v, getVal(rows[i - 1]), orderCol)) continue
    const cacheKey =
      orderCol === 'hit_rate' ? `h:${Number(v).toFixed(6)}` : `n:${orderCol}:${v}`
    if (!countCache.has(cacheKey)) valuesNeedingCount.push(v)
  }

  await Promise.all(valuesNeedingCount.map((v) => displayRankForValue(v)))

  const out = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const v = getVal(row)
    let rank
    if (i > 0 && rankingSortValuesEqual(v, getVal(rows[i - 1]), orderCol)) {
      rank = out[i - 1]._displayRank
    } else {
      const cacheKey =
        orderCol === 'hit_rate' ? `h:${Number(v).toFixed(6)}` : `n:${orderCol}:${v}`
      rank = countCache.get(cacheKey) ?? (await displayRankForValue(v))
    }
    out.push({ ...row, _displayRank: rank })
  }
  return out
}
