import { supabase } from './supabase'
import { canonicalCategoryIdFromStoredValue } from './matchupCategoryAliases'
import { mapTiedMaxLabels } from './resolveTiedMaxLabels'

/** @typedef {'eternal_quest' | 'food_place' | 'food_taste' | 'fashion'} AdminPrimaryCategoryBucket */

export const ADMIN_PRIMARY_CATEGORY_LABELS = {
  eternal_quest: '영원한 난제',
  food_place: '맛집',
  food_taste: '맛식',
  fashion: '패션',
}

const BUCKET_PRIORITY = /** @type {AdminPrimaryCategoryBucket[]} */ ([
  'eternal_quest',
  'fashion',
  'food_place',
  'food_taste',
])

/**
 * DB category → 관리자 주요 카테고리 버킷 (해당 4종만)
 * @param {string | null | undefined} raw
 * @returns {AdminPrimaryCategoryBucket | null}
 */
export function resolveAdminPrimaryCategoryBucket(raw) {
  const stored = raw == null ? '' : String(raw).trim()
  if (!stored) return null

  const canonical = canonicalCategoryIdFromStoredValue(stored)
  if (canonical === 'eternal_quest') return 'eternal_quest'
  if (canonical === 'fashion') return 'fashion'

  if (canonical === 'food_gourmet') {
    if (stored === '맛식' || stored === 'tanghulu') return 'food_taste'
    return 'food_place'
  }

  return null
}

/**
 * @param {Record<string, number>} counts
 * @returns {AdminPrimaryCategoryBucket[]}
 */
export function resolvePrimaryCategoryBuckets(counts) {
  const { keys } = mapTiedMaxLabels(counts, BUCKET_PRIORITY, ADMIN_PRIMARY_CATEGORY_LABELS)
  return /** @type {AdminPrimaryCategoryBucket[]} */ (keys)
}

/**
 * @param {AdminPrimaryCategoryBucket | null | undefined} bucket
 */
export function getPrimaryCategoryLabel(bucket) {
  if (!bucket) return ''
  return ADMIN_PRIMARY_CATEGORY_LABELS[bucket] || ''
}

/**
 * @param {Iterable<string | null | undefined>} categoryValues
 */
export function tallyAdminPrimaryCategoryBuckets(categoryValues) {
  /** @type {Record<AdminPrimaryCategoryBucket, number>} */
  const counts = {
    eternal_quest: 0,
    food_place: 0,
    food_taste: 0,
    fashion: 0,
  }

  for (const raw of categoryValues) {
    const bucket = resolveAdminPrimaryCategoryBucket(raw)
    if (bucket) counts[bucket] += 1
  }

  return counts
}

/**
 * @param {Record<string, number>} counts
 */
export function mapPrimaryCategoryFromCounts(counts) {
  const { keys, labels, label } = mapTiedMaxLabels(
    counts,
    BUCKET_PRIORITY,
    ADMIN_PRIMARY_CATEGORY_LABELS,
  )
  if (!labels.length) return {}
  return {
    primaryCategoryBuckets: keys,
    primaryCategoryLabels: labels,
    primaryCategoryLabel: label,
  }
}

/**
 * @param {string} userId
 */
export async function fetchAdminUserPrimaryCategory(userId) {
  const id = String(userId || '').trim()
  if (!id) return {}

  try {
    const [votesRes, createdRes, challengedRes] = await Promise.all([
      supabase.from('votes').select('matchups(category)').eq('user_id', id),
      supabase.from('matchups').select('category').eq('user_id', id),
      supabase
        .from('matchups')
        .select('category')
        .eq('right_user_id', id)
        .not('right_type', 'is', null),
    ])

    if (votesRes.error) throw votesRes.error
    if (createdRes.error) throw createdRes.error
    if (challengedRes.error) throw challengedRes.error

    const categories = []

    for (const row of votesRes.data || []) {
      const m = Array.isArray(row.matchups) ? row.matchups[0] : row.matchups
      categories.push(m?.category)
    }
    for (const row of createdRes.data || []) {
      categories.push(row?.category)
    }
    for (const row of challengedRes.data || []) {
      categories.push(row?.category)
    }

    return mapPrimaryCategoryFromCounts(tallyAdminPrimaryCategoryBuckets(categories))
  } catch (e) {
    console.warn('[userPrimaryCategory] fetchAdminUserPrimaryCategory:', e?.message || e)
    return {}
  }
}

/**
 * @param {string[] | null | undefined} topCategories — 데모·레거시 목록
 */
export function derivePrimaryCategoryFromTopCategories(topCategories) {
  const list = Array.isArray(topCategories) ? topCategories : []
  const mapped = list.map((raw) => {
    const s = String(raw || '').trim()
    if (s === '음식' || s === 'food') return 'food_gourmet'
    if (s === '패션') return 'fashion'
    if (s === '영원한 난제') return 'eternal_quest'
    if (s === '맛집') return '맛집'
    if (s === '맛식') return '맛식'
    return s
  })
  return mapPrimaryCategoryFromCounts(tallyAdminPrimaryCategoryBuckets(mapped))
}
