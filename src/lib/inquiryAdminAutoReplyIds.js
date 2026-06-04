/**
 * 문의 관리: 자동응답이 붙은 inquiry_id 집합 (목록·통계에서 제외용).
 * - 짧은 TTL 메모리 캐시로 동일 세션 반복 조회 감소
 * - DB에 `inquiry_auto_reply_excluded_inquiry_ids` RPC가 있으면 DISTINCT 한 번에 조회
 * - 없으면 id 순 페이지 스캔으로 유니크 수집(상한)
 */
import { supabase } from './supabase'

const CACHE_TTL_MS = 120_000
const RPC_NAME = 'inquiry_auto_reply_excluded_inquiry_ids'

/** @type {{ at: number, ids: string[] }} */
let cache = { at: 0, ids: [] }

const FALLBACK_PAGE = 2000
const FALLBACK_MAX_PAGES = 50

export function invalidateAutoReplyInquiryIdCache() {
  cache = { at: 0, ids: [] }
}

/**
 * @returns {Promise<string[]>} inquiry UUID 문자열 목록 (중복 제거)
 */
export async function getAutoReplyExcludedInquiryIds() {
  const now = Date.now()
  if (now - cache.at < CACHE_TTL_MS && Array.isArray(cache.ids)) {
    return cache.ids
  }

  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc(RPC_NAME)
    if (!rpcErr && Array.isArray(rpcRows)) {
      const ids = []
      for (const row of rpcRows) {
        const id =
          row && typeof row === 'object' && 'inquiry_id' in row
            ? row.inquiry_id
            : row
        if (id) ids.push(String(id))
      }
      const unique = [...new Set(ids)]
      cache = { at: now, ids: unique }
      return unique
    }
  } catch {
    /* RPC 미배포 등 */
  }

  const merged = new Set()
  for (let p = 0; p < FALLBACK_MAX_PAGES; p++) {
    const from = p * FALLBACK_PAGE
    const to = from + FALLBACK_PAGE - 1
    const { data, error } = await supabase
      .from('inquiry_replies')
      .select('inquiry_id')
      .eq('reply_type', 'auto')
      .not('inquiry_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, to)
    if (error) {
      console.warn('[inquiryAdminAutoReplyIds] fallback scan:', error.message)
      break
    }
    if (!data?.length) break
    for (const r of data) {
      if (r.inquiry_id) merged.add(String(r.inquiry_id))
    }
    if (data.length < FALLBACK_PAGE) break
  }

  const ids = [...merged]
  cache = { at: now, ids }
  return ids
}
