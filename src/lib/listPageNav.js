import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** 목록 페이지네이션 — URL ?page= 과 브라우저 뒤로가기 동기화 */

export const LIST_PAGE_URL_PARAM = 'page'

/** 목록 → 상세 Link state 키 (페이지·필터 URL 유지) */
export const LIST_RETURN_STATE_KEYS = [
  'listReturnTo',
  'adminUsersReturnTo',
  'adminMatchupsReturnTo',
  'adminAppealsReturnTo',
  'adminInquiryReturnTo',
]

/**
 * @param {string} pathname
 * @param {string} search
 */
export function buildListReturnTo(pathname, search) {
  return `${pathname || ''}${search || ''}`
}

/**
 * @param {unknown} state
 * @returns {string | null}
 */
export function readListReturnToFromState(state) {
  if (!state || typeof state !== 'object') return null
  for (const key of LIST_RETURN_STATE_KEYS) {
    const value = state[key]
    if (typeof value === 'string' && value.startsWith('/')) return value
  }
  return null
}

/**
 * 앱 뒤로가기 — Link state 목록 URL 우선, 없으면 history back, 직접 진입 시 fallback
 * @param {string} [fallback='/']
 */
export function useNavigateBack(fallback = '/') {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    (explicitFallback) => {
      const stateReturn = readListReturnToFromState(location.state)
      const fb = explicitFallback ?? stateReturn ?? fallback

      if (stateReturn) {
        navigate(stateReturn, { replace: true })
        return
      }

      if (location.key !== 'default') {
        navigate(-1)
        return
      }

      navigate(fb, { replace: true })
    },
    [navigate, location.key, location.state, fallback],
  )
}

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
