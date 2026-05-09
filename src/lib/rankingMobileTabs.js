/**
 * 랭킹 페이지 모바일 가로 탭(전체 제외 3개 카테고리)
 * - 집계: created_at 제한 없이 DB에 있는 매치업 전부(누적) — 카테고리별 생성 수·total_votes 합
 *   → 투표 합 우선, 동률이면 생성 수
 * - 캐시: 한국 시간(KST) 기준 달력 날짜가 바뀌면 무효(당일 0시~ 자정까지 동일 탭 유지)
 */
import { supabase } from './supabase'
import { DEFAULT_RANKING_MOBILE_TAB_IDS } from './categoryAdminStorage'
import { canonicalCategoryIdFromStoredValue } from './matchupCategoryAliases'

export const MOBILE_TAB_CACHE_KEY = 'vics_ranking_mobile_tab_categories_v3'

export const DEFAULT_MOBILE_TAB_CATEGORY_IDS = DEFAULT_RANKING_MOBILE_TAB_IDS

/** 한국 시간 기준 YYYY-MM-DD (캐시 일 단위 구분) */
export function getKstDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) return new Date().toISOString().slice(0, 10)
  return `${y}-${m}-${d}`
}

export function readMobileTabCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MOBILE_TAB_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const { ids, dateKey } = parsed
    if (!Array.isArray(ids) || ids.length !== 3) return null
    if (typeof dateKey !== 'string' || dateKey !== getKstDateString()) return null
    return { ids, dateKey }
  } catch {
    return null
  }
}

export function writeMobileTabCache(ids) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      MOBILE_TAB_CACHE_KEY,
      JSON.stringify({ ids, dateKey: getKstDateString() })
    )
  } catch {
    /* ignore quota */
  }
}

export function getInitialMobileTabCategoryIds() {
  if (typeof window === 'undefined') return [...DEFAULT_MOBILE_TAB_CATEGORY_IDS]
  const c = readMobileTabCache()
  return c?.ids ?? [...DEFAULT_MOBILE_TAB_CATEGORY_IDS]
}

const PAGE_SIZE = 1000
const MAX_ROWS = 100_000

async function fetchAllMatchupsCategoryRows() {
  const rows = []
  let from = 0
  while (from < MAX_ROWS) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('matchups')
      .select('category, total_votes')
      .not('category', 'is', null)
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      console.error('[rankingMobileTabs] fetch', error)
      break
    }
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

/**
 * @param {string[]} validCategoryIds — CATEGORIES의 id 목록 ('all' 제외한 것만 넘겨도 됨)
 * @returns {Promise<string[]>} 길이 3의 카테고리 id
 */
export async function fetchTopMobileTabCategoryIds(validCategoryIds) {
  const valid = new Set((validCategoryIds || []).filter((id) => id && id !== 'all'))
  if (valid.size === 0) return [...DEFAULT_MOBILE_TAB_CATEGORY_IDS]

  const data = await fetchAllMatchupsCategoryRows()

  const agg = new Map()
  for (const row of data) {
    const cat = canonicalCategoryIdFromStoredValue(row.category)
    if (!cat || !valid.has(cat)) continue
    const cur = agg.get(cat) || { count: 0, votes: 0 }
    cur.count += 1
    cur.votes += Number(row.total_votes) || 0
    agg.set(cat, cur)
  }

  const sorted = [...agg.entries()]
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => (b.votes - a.votes) || (b.count - a.count))

  const top = sorted.slice(0, 3).map((x) => x.id)
  return padToThree(top, valid)
}

function padToThree(ids, validSet) {
  const out = [...ids]
  const pool = [...DEFAULT_MOBILE_TAB_CATEGORY_IDS, ...[...validSet]].filter(
    (id, i, arr) => id && id !== 'all' && arr.indexOf(id) === i
  )
  for (const id of pool) {
    if (out.length >= 3) break
    if (!out.includes(id)) out.push(id)
  }
  return out.slice(0, 3)
}
