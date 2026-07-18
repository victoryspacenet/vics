/** 목록 페이지네이션 — URL ?page= 과 브라우저 뒤로가기 동기화 */

export const LIST_PAGE_URL_PARAM = 'page'

export function parseListPageParam(raw, { minPage = 1 } = {}) {
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n >= minPage ? n : minPage
}

/** URL 1-based → 0-based 인덱스 (검색 등) */
export function parseListPageIndexFromUrl(raw) {
  return Math.max(0, parseListPageParam(raw) - 1)
}

/**
 * @param {import('react-router-dom').SetURLSearchParams} setSearchParams
 * @param {number | null | undefined} page 1-based; 1 이하면 param 삭제
 * @param {Record<string, string | number | null | undefined>} [otherPatch]
 * @param {{ replace?: boolean, minPage?: number }} [opts]
 */
export function patchSearchParamsPage(setSearchParams, page, otherPatch = {}, opts = {}) {
  const replace = opts.replace ?? false
  const minPage = opts.minPage ?? 1
  setSearchParams(
    (prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(otherPatch)) {
        if (value == null || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      if (page == null || Number(page) <= minPage) next.delete(LIST_PAGE_URL_PARAM)
      else next.set(LIST_PAGE_URL_PARAM, String(page))
      return next
    },
    { replace },
  )
}
