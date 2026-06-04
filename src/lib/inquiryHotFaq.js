import { supabase } from './supabase'
import { FAQ_ALL_IDS, FAQ_ITEMS, FAQ_MAIN_IDS } from './faqData'
import { normalizeCategoryHelpRow } from './inquiryCategoryHelp'
import { listInquiryHelpCategories } from './inquiryHelpCategories'

const SETTINGS_KEY = 'inquiry_hot_faq'

/** 카테고리 도움말 DB 행 — 문의 메인 핫 FAQ 참조 키 */
export const HOT_FAQ_HELP_PREFIX = 'help:'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 다른 탭·창에서 저장했을 때 문의 메인이 갱신되도록 버전만 올림 (storage 이벤트) */
export const INQUIRY_HOT_FAQ_LS_REV_KEY = 'vics_inquiry_hot_faq_rev'

function bumpLocalRevision() {
  try {
    localStorage.setItem(INQUIRY_HOT_FAQ_LS_REV_KEY, String(Date.now()))
  } catch {
    /* private 모드 등 */
  }
}

export function isHotFaqHelpRef(ref) {
  return String(ref || '').startsWith(HOT_FAQ_HELP_PREFIX)
}

export function hotFaqHelpRef(helpId) {
  return `${HOT_FAQ_HELP_PREFIX}${String(helpId)}`
}

export function parseHotFaqHelpId(ref) {
  if (!isHotFaqHelpRef(ref)) return null
  const id = ref.slice(HOT_FAQ_HELP_PREFIX.length)
  return UUID_RE.test(id) ? id : null
}

function normTitle(title) {
  return String(title || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function faqPairKey(category, title) {
  return `${String(category || '').trim()}::${normTitle(title)}`
}

/**
 * 노출 목록에 이미 올라간 항목(및 같은 질문의 faq id ↔ help: 짝) — 풀에서 제외
 * @param {string[]} orderedRefs
 * @param {{ id: string, category_slug: string, title: string }[]} helpRows
 */
export function buildHotFaqCoverSet(orderedRefs, helpRows) {
  const cover = new Set(orderedRefs || [])
  const helpByKey = new Map()
  for (const row of helpRows || []) {
    helpByKey.set(faqPairKey(row.category_slug, row.title), row)
  }
  const faqIdByKey = new Map()
  for (const id of FAQ_ALL_IDS) {
    const faq = FAQ_ITEMS[id]
    if (faq) faqIdByKey.set(faqPairKey(faq.category, faq.question), id)
  }

  for (const ref of orderedRefs || []) {
    if (FAQ_ITEMS[ref]) {
      const faq = FAQ_ITEMS[ref]
      const row = helpByKey.get(faqPairKey(faq.category, faq.question))
      if (row) cover.add(hotFaqHelpRef(row.id))
    }
    if (isHotFaqHelpRef(ref)) {
      const hid = parseHotFaqHelpId(ref)
      const row = (helpRows || []).find((r) => String(r.id) === hid)
      if (row) {
        const fid = faqIdByKey.get(faqPairKey(row.category_slug, row.title))
        if (fid) cover.add(fid)
      }
    }
  }
  return cover
}

/** 저장 시 같은 질문이면 help: 참조로 통일 (faq id 5·8 과 help: 중복 방지) */
export async function normalizeHotFaqRefsForSave(refs) {
  const helpRows = await fetchAllCategoryHelpRows()
  const helpByKey = new Map(
    helpRows.map((r) => [faqPairKey(r.category_slug, r.title), r]),
  )
  const out = []
  const seenKeys = new Set()

  for (const ref of refs || []) {
    let finalRef = ref
    let pairKey = null

    if (FAQ_ITEMS[ref]) {
      const faq = FAQ_ITEMS[ref]
      pairKey = faqPairKey(faq.category, faq.question)
      const row = helpByKey.get(pairKey)
      if (row) finalRef = hotFaqHelpRef(row.id)
    } else if (isHotFaqHelpRef(ref)) {
      const hid = parseHotFaqHelpId(ref)
      const row = helpRows.find((r) => String(r.id) === hid)
      if (row) pairKey = faqPairKey(row.category_slug, row.title)
    }

    if (pairKey) {
      if (seenKeys.has(pairKey)) continue
      seenKeys.add(pairKey)
    }

    if (isValidHotFaqRefSimple(finalRef, helpRows)) out.push(finalRef)
  }
  return out
}

function isValidHotFaqRefSimple(ref, helpRows) {
  const helpIdSet = new Set((helpRows || []).map((r) => String(r.id)))
  return isValidHotFaqRef(ref, helpIdSet)
}

/** @returns {Promise<{ id: string, category_slug: string, title: string, on_list?: boolean }[]>} */
export async function fetchCategoryHelpRowsForHotFilter() {
  return fetchAllCategoryHelpRows()
}

/** 카테고리 FAQ에 저장된 모든 도움말 (노출·풀 구분 없음) */
export async function fetchAllCategoryHelpRows() {
  try {
    const { data, error } = await supabase
      .from('inquiry_category_help')
      .select('id, category_slug, title, answer, body, steps, actions, illustration, on_list, sort_order')
      .order('category_slug')
      .order('sort_order', { ascending: true })
    if (error) {
      console.warn('[inquiryHotFaq] category_help:', error.message)
      return []
    }
    return (data || []).filter((r) => String(r.title || '').trim())
  } catch (e) {
    console.warn('[inquiryHotFaq] category_help fetch', e)
    return []
  }
}

/**
 * @param {string} ref
 * @param {Map<string, object>} helpById
 * @param {Map<string, string>} categoryLabelBySlug
 */
export function resolveHotFaqRef(ref, helpById, categoryLabelBySlug) {
  if (isHotFaqHelpRef(ref)) {
    const hid = parseHotFaqHelpId(ref)
    if (!hid) return null
    const row = helpById?.get(hid)
    if (!row) return null
    const n = normalizeCategoryHelpRow(row)
    if (!n) return null
    const slug = n.category_slug
    return {
      id: ref,
      kind: 'help',
      question: n.title,
      answer: n.answer || n.body || '',
      categorySlug: slug,
      categoryLabel: categoryLabelBySlug?.get(slug) || slug,
      detailTo: `/inquiry/category/${slug}/help/${hid}`,
    }
  }
  const faq = FAQ_ITEMS[ref]
  if (!faq) return null
  return {
    id: ref,
    kind: 'faq',
    question: faq.question,
    answer: faq.answer,
    categorySlug: faq.category,
    categoryLabel: categoryLabelBySlug?.get(faq.category) || faq.category,
    detailTo: `/inquiry/faq/${ref}`,
  }
}

/**
 * @param {string[]} refs
 */
export async function resolveHotFaqRefs(refs) {
  const [helpRows, cats] = await Promise.all([fetchAllCategoryHelpRows(), listInquiryHelpCategories()])
  const helpById = new Map(helpRows.map((r) => [String(r.id), r]))
  const categoryLabelBySlug = new Map(cats.map((c) => [c.slug, c.label]))
  return (refs || [])
    .map((ref) => resolveHotFaqRef(ref, helpById, categoryLabelBySlug))
    .filter(Boolean)
}

function isValidHotFaqRef(ref, helpIdSet) {
  if (isHotFaqHelpRef(ref)) {
    const hid = parseHotFaqHelpId(ref)
    return hid != null && helpIdSet.has(hid)
  }
  return Boolean(FAQ_ITEMS[ref])
}

/**
 * 메인 FAQ에 아직 없는 항목 — 카테고리 도움말 전체 + faqData(중복 제목 제외)
 * @param {string[]} orderedRefs
 * @returns {Promise<{ ref: string, kind: 'help'|'faq', question: string, categoryLabel: string }[]>}
 */
export async function getHotFaqAddablePool(orderedRefs = []) {
  const [helpRows, cats] = await Promise.all([fetchAllCategoryHelpRows(), listInquiryHelpCategories()])
  const categoryLabelBySlug = new Map(cats.map((c) => [c.slug, c.label]))
  const cover = buildHotFaqCoverSet(orderedRefs, helpRows)
  const helpKeys = new Set(helpRows.map((r) => faqPairKey(r.category_slug, r.title)))

  const pool = []

  for (const row of helpRows) {
    const ref = hotFaqHelpRef(row.id)
    if (cover.has(ref)) continue
    pool.push({
      ref,
      kind: 'help',
      question: normTitle(row.title),
      categoryLabel: categoryLabelBySlug.get(row.category_slug) || row.category_slug,
    })
  }

  for (const id of FAQ_ALL_IDS) {
    if (cover.has(id)) continue
    const faq = FAQ_ITEMS[id]
    if (!faq) continue
    if (helpKeys.has(faqPairKey(faq.category, faq.question))) continue
    pool.push({
      ref: id,
      kind: 'faq',
      question: faq.question,
      categoryLabel: categoryLabelBySlug.get(faq.category) || faq.category,
    })
  }

  return pool
}

async function loadStoredHotFaqRefs() {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
    if (error) console.warn('[inquiryHotFaq] get:', error.message)
    const ids = data?.value?.ids
    if (Array.isArray(ids) && ids.length > 0) return ids.map(String)
  } catch (e) {
    console.warn('[inquiryHotFaq]', e)
  }
  return null
}

async function filterValidStoredRefs(refs) {
  const helpRows = await fetchAllCategoryHelpRows()
  const helpIdSet = new Set(helpRows.map((r) => String(r.id)))
  return (refs || []).filter((ref) => isValidHotFaqRef(ref, helpIdSet))
}

/**
 * 문의 메인에 노출할 FAQ 참조 목록 (faq id 또는 help:uuid). Supabase 미설정 시 faqData FAQ_MAIN_IDS.
 * @returns {Promise<string[]>}
 */
export async function getHotFaqIds() {
  let baseIds = await loadStoredHotFaqRefs()
  if (!baseIds?.length) baseIds = [...FAQ_MAIN_IDS]

  const valid = await filterValidStoredRefs(baseIds)
  if (valid.length > 0) return valid

  const fallback = await filterValidStoredRefs([...FAQ_MAIN_IDS])
  if (fallback.length > 0) return fallback

  return [...FAQ_MAIN_IDS]
}

/** @returns {Promise<ReturnType<typeof resolveHotFaqRef>[]>} */
export async function getHotFaqDisplayItems() {
  const ids = await getHotFaqIds()
  return resolveHotFaqRefs(ids)
}

/**
 * 카테고리별 도움말 저장 후, 삭제된 help: 참조·무효 faq id 정리
 */
export async function pruneHotFaqIdsAfterCategoryHelpSave() {
  const rawIds = await loadStoredHotFaqRefs()
  if (!rawIds?.length) return

  const filtered = await filterValidStoredRefs(rawIds)
  if (filtered.length === 0) return

  const same =
    rawIds.length === filtered.length && rawIds.every((id, i) => id === filtered[i])
  if (same) return

  try {
    await saveHotFaqIds(filtered)
  } catch (e) {
    console.warn('[inquiryHotFaq] prune save:', e?.message || e)
  }
}

/**
 * @param {string[]} ids - faq id 또는 help:uuid, 순서 그대로 저장
 */
export async function saveHotFaqIds(ids) {
  const helpRows = await fetchAllCategoryHelpRows()
  const normalized = await normalizeHotFaqRefsForSave(ids)
  const helpIdSet = new Set(helpRows.map((r) => String(r.id)))
  const valid = normalized.filter((ref) => isValidHotFaqRef(ref, helpIdSet))
  if (valid.length === 0) throw new Error('최소 1개 이상의 항목을 선택해 주세요.')
  const { error } = await supabase.from('admin_settings').upsert(
    { key: SETTINGS_KEY, value: { ids: valid } },
    { onConflict: 'key' },
  )
  if (error) throw error
  if (typeof window !== 'undefined') {
    bumpLocalRevision()
    window.dispatchEvent(new CustomEvent('vics:inquiry-hot-faq:updated'))
  }
  return valid
}

/** @deprecated filterHotFaqIdsByListedCategoryHelp — help: 참조 방식으로 대체. 하위 호환용 no-op 패스 */
export function filterHotFaqIdsByListedCategoryHelp(ids, _helpRows) {
  return ids
}
