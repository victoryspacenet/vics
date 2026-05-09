import { supabase } from './supabase'
import { FAQ_ITEMS } from './faqData'
import { listInquiryHelpCategories } from './inquiryHelpCategories'
import { pruneHotFaqIdsAfterCategoryHelpSave } from './inquiryHotFaq'

/** 카테고리·제목이 FAQ 기본 항목과 같을 때 단계 복원용 (DB steps 비어 있음 등) */
const FAQ_FALLBACK_BY_CAT_TITLE = (() => {
  const m = new Map()
  for (const faq of Object.values(FAQ_ITEMS)) {
    if (!faq.category || !faq.question) continue
    m.set(`${faq.category}::${faq.question}`, faq)
  }
  return m
})()

const TABLE = 'inquiry_category_help'

export const INQUIRY_CATEGORY_HELP_LS_REV_KEY = 'vics_inquiry_category_help_rev'

/** @type {const} */
export const CATEGORY_HELP_ILLUSTRATIONS = ['', 'points', 'vote', 'report', 'profile', 'ranking', 'delete']

function bumpRevision() {
  try {
    localStorage.setItem(INQUIRY_CATEGORY_HELP_LS_REV_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vics:inquiry-category-help:updated'))
  }
}

export function parseSteps(val) {
  if (val == null) return []
  if (Array.isArray(val)) return val.map(String).filter(Boolean)
  if (typeof val === 'string') {
    const t = val.trim()
    if (!t) return []
    try {
      const parsed = JSON.parse(t)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      /* ignore */
    }
    return []
  }
  if (typeof val === 'object') return []
  return []
}

export function parseActions(val) {
  if (!Array.isArray(val)) return []
  return val.filter((a) => a && typeof a.text === 'string' && typeof a.to === 'string')
}

/**
 * DB에 steps가 비어 있고(또는 마이그레이션으로 본문만 answer에 합쳐진 경우),
 * FAQ와 동일한 카테고리·제목이면 번호 단계·바로가기·일러스트를 FAQ와 맞춰 복원한다.
 */
function enrichCategoryHelpWithFaqFallback(normalized) {
  if (!normalized) return null
  if (normalized.steps.length > 0) return normalized
  const faq = FAQ_FALLBACK_BY_CAT_TITLE.get(`${normalized.category_slug}::${normalized.title}`)
  if (!faq || !Array.isArray(faq.steps) || faq.steps.length === 0) return normalized

  const hasDbActions = normalized.actions.length > 0
  const ill =
    normalized.illustration && CATEGORY_HELP_ILLUSTRATIONS.includes(normalized.illustration)
      ? normalized.illustration
      : faq.illustration && CATEGORY_HELP_ILLUSTRATIONS.includes(faq.illustration)
        ? faq.illustration
        : ''

  return {
    ...normalized,
    answer: faq.answer || normalized.answer,
    steps: faq.steps,
    actions: hasDbActions ? normalized.actions : parseActions(faq.actions || []),
    illustration: ill,
  }
}

/** DB 행 → 관리자/클라이언트 공통 형태 */
export function normalizeCategoryHelpRow(row) {
  if (!row) return null
  const base = {
    id: row.id,
    category_slug: row.category_slug,
    title: row.title || '',
    answer: row.answer ?? '',
    body: row.body ?? '',
    steps: parseSteps(row.steps),
    actions: parseActions(row.actions),
    illustration: row.illustration && CATEGORY_HELP_ILLUSTRATIONS.includes(row.illustration) ? row.illustration : '',
    sort_order: row.sort_order ?? 0,
  }
  return enrichCategoryHelpWithFaqFallback(base)
}

/**
 * @param {string} slug
 */
export async function listCategoryHelpItems(slug) {
  const cats = await listInquiryHelpCategories()
  if (!cats.some((c) => c.slug === slug)) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, title, sort_order, answer')
    .eq('category_slug', slug)
    .eq('on_list', true)
    .order('sort_order', { ascending: true })
  if (error) {
    console.warn('[inquiryCategoryHelp]', error.message)
    return []
  }
  return data || []
}

/**
 * 관리자용: 카테고리별 노출 목록(listed) + 풀(pool, on_list=false).
 * @returns {Promise<Record<string, { listed: ReturnType<typeof normalizeCategoryHelpRow>[], pool: ReturnType<typeof normalizeCategoryHelpRow>[] }>>}
 */
export async function getCategoryHelpMap() {
  const cats = await listInquiryHelpCategories()
  const map = {}
  for (const { slug } of cats) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('category_slug', slug)
      .order('on_list', { ascending: false })
      .order('sort_order', { ascending: true })
    if (error) {
      console.warn('[inquiryCategoryHelp]', error.message)
      map[slug] = { listed: [], pool: [] }
      continue
    }
    const listed = []
    const pool = []
    for (const row of data || []) {
      const n = normalizeCategoryHelpRow(row)
      if (!n) continue
      const onList = row.on_list !== false
      if (onList) listed.push(n)
      else pool.push(n)
    }
    map[slug] = { listed, pool }
  }
  return map
}

/**
 * @param {string} id
 */
export async function getCategoryHelpById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('on_list', true)
    .maybeSingle()
  if (error || !data) return null
  return normalizeCategoryHelpRow(data)
}

function buildHelpRow(slug, it, i, onList) {
  const steps = parseSteps(it.steps)
  const actions = parseActions(it.actions)
  const rawIll = String(it.illustration || '').trim()
  const illustration =
    rawIll && CATEGORY_HELP_ILLUSTRATIONS.includes(rawIll) && rawIll !== '' ? rawIll : null
  return {
    id: it.id || crypto.randomUUID(),
    category_slug: slug,
    title: String(it.title || '').trim(),
    answer: String(it.answer ?? '').trim(),
    body: String(it.body ?? '').trim(),
    steps,
    actions,
    illustration,
    on_list: onList,
    sort_order: i,
  }
}

/**
 * @param {string} slug
 * @param {{ listed?: any[], pool?: any[] } | any[]} payload — 구버전 호환: 배열만 넘기면 전부 노출 목록으로 저장
 */
export async function syncCategoryHelpItems(slug, payload) {
  const cats = await listInquiryHelpCategories()
  if (!cats.some((c) => c.slug === slug)) throw new Error('잘못된 카테고리예요.')
  const listed = Array.isArray(payload) ? payload : payload?.listed || []
  const pool = Array.isArray(payload) ? [] : payload?.pool || []

  const rows = [
    ...listed
      .map((it, i) => buildHelpRow(slug, it, i, true))
      .filter((r) => r.title.length > 0),
    ...pool
      .map((it, i) => buildHelpRow(slug, it, i, false))
      .filter((r) => r.title.length > 0),
  ]

  const { error: delErr } = await supabase.from(TABLE).delete().eq('category_slug', slug)
  if (delErr) throw delErr
  if (rows.length === 0) {
    return
  }
  const { error: insErr } = await supabase.from(TABLE).insert(rows)
  if (insErr) throw insErr
}

/**
 * @param {Record<string, { listed: any[], pool: any[] }>} categoryMap
 */
export async function saveAllCategoryHelp(categoryMap) {
  for (const slug of Object.keys(categoryMap)) {
    const slot = categoryMap[slug]
    if (slot && Array.isArray(slot.listed) && Array.isArray(slot.pool)) {
      await syncCategoryHelpItems(slug, slot)
    } else if (Array.isArray(slot)) {
      await syncCategoryHelpItems(slug, { listed: slot, pool: [] })
    } else {
      await syncCategoryHelpItems(slug, { listed: [], pool: [] })
    }
  }
  bumpRevision()
  await pruneHotFaqIdsAfterCategoryHelpSave()
}
