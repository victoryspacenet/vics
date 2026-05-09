import { supabase } from './supabase'
import { FAQ_ITEMS, FAQ_MAIN_IDS } from './faqData'

const SETTINGS_KEY = 'inquiry_hot_faq'

/** 다른 탭·창에서 저장했을 때 문의 메인이 갱신되도록 버전만 올림 (storage 이벤트) */
export const INQUIRY_HOT_FAQ_LS_REV_KEY = 'vics_inquiry_hot_faq_rev'

function bumpLocalRevision() {
  try {
    localStorage.setItem(INQUIRY_HOT_FAQ_LS_REV_KEY, String(Date.now()))
  } catch {
    /* private 모드 등 */
  }
}

export async function fetchCategoryHelpRowsForHotFilter() {
  try {
    const { data, error } = await supabase
      .from('inquiry_category_help')
      .select('category_slug, title, on_list')
    if (error) {
      console.warn('[inquiryHotFaq] category_help:', error.message)
      return []
    }
    return data || []
  } catch (e) {
    console.warn('[inquiryHotFaq] category_help fetch', e)
    return []
  }
}

/**
 * FAQ와 동일한 category_slug·제목(title)인 inquiry_category_help 행이 하나라도 있으면,
 * 그중 on_list=true 인 행이 없을 때 메인 핫 FAQ에서 제외한다.
 * (DB에 해당 제목 행이 없으면 코드 전용 FAQ로 보고 항상 허용)
 * @param {string[]} ids
 * @param {{ category_slug: string, title: string, on_list?: boolean }[]} helpRows
 */
export function filterHotFaqIdsByListedCategoryHelp(ids, helpRows) {
  const rows = helpRows || []
  return ids.filter((id) => {
    const faq = FAQ_ITEMS[id]
    if (!faq) return false
    const slug = faq.category
    const q = String(faq.question || '').trim()
    const matching = rows.filter(
      (r) => r.category_slug === slug && String(r.title || '').trim() === q,
    )
    if (matching.length === 0) return true
    return matching.some((r) => r.on_list !== false)
  })
}

/**
 * 문의 메인에 노출할 FAQ id 목록 (순서 유지). Supabase 미설정 시 faqData의 FAQ_MAIN_IDS.
 * 카테고리별 도움말 DB에 묶인 FAQ는 노출 목록(on_list)에 있을 때만 포함.
 * @returns {Promise<string[]>}
 */
export async function getHotFaqIds() {
  const helpRows = await fetchCategoryHelpRowsForHotFilter()
  let baseIds
  try {
    const { data, error } = await supabase.from('admin_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
    if (error) console.warn('[inquiryHotFaq] get:', error.message)
    const ids = data?.value?.ids
    if (Array.isArray(ids) && ids.length > 0) {
      const valid = ids.filter((id) => FAQ_ITEMS[id])
      if (valid.length > 0) baseIds = valid
    }
  } catch (e) {
    console.warn('[inquiryHotFaq]', e)
  }
  if (!baseIds) baseIds = [...FAQ_MAIN_IDS]

  const filtered = filterHotFaqIdsByListedCategoryHelp(baseIds, helpRows)
  if (filtered.length > 0) return filtered

  const fallback = filterHotFaqIdsByListedCategoryHelp([...FAQ_MAIN_IDS], helpRows)
  if (fallback.length > 0) return fallback

  return [...FAQ_MAIN_IDS]
}

/**
 * 카테고리별 도움말 저장 후, 메인 핫 FAQ(admin_settings)에서
 * 더 이상 카테고리 노출 목록에 없는 FAQ id를 제거한다.
 */
export async function pruneHotFaqIdsAfterCategoryHelpSave() {
  const helpRows = await fetchCategoryHelpRowsForHotFilter()
  let rawIds
  try {
    const { data, error } = await supabase.from('admin_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
    if (error) {
      console.warn('[inquiryHotFaq] prune get:', error.message)
      return
    }
    const ids = data?.value?.ids
    if (Array.isArray(ids) && ids.length > 0) {
      rawIds = ids.filter((id) => FAQ_ITEMS[id])
    }
  } catch (e) {
    console.warn('[inquiryHotFaq] prune', e)
    return
  }
  if (!rawIds?.length) rawIds = [...FAQ_MAIN_IDS]

  const filtered = filterHotFaqIdsByListedCategoryHelp(rawIds, helpRows)
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
 * @param {string[]} ids - FAQ_ITEMS 키만 허용, 순서 그대로 저장
 */
export async function saveHotFaqIds(ids) {
  const valid = [...new Set(ids)].filter((id) => FAQ_ITEMS[id])
  if (valid.length === 0) throw new Error('최소 1개 이상의 FAQ를 선택해 주세요.')
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
