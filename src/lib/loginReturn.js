/** 로그인 완료 후 이동 경로 (직전 페이지 복귀) */

const STORAGE_KEY = 'vics_login_return_to'
export const LAST_PATH_BEFORE_LOGIN_KEY = 'vics_last_path_before_login'

/** 비로그인 사용자의 마지막 방문 경로 (로그인 페이지에서 복귀용) */
export function setLastPathBeforeLogin(path) {
  if (!path || typeof path !== 'string') return
  sessionStorage.setItem(LAST_PATH_BEFORE_LOGIN_KEY, path)
}

export function getLastPathBeforeLogin() {
  return sessionStorage.getItem(LAST_PATH_BEFORE_LOGIN_KEY)
}

/**
 * @param {string} raw
 * @param {string} [fallback='/']
 * @returns {string}
 */
export function getSafeReturnPath(raw, fallback = '/') {
  if (!raw || typeof raw !== 'string') return fallback
  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return fallback
    const path = `${url.pathname}${url.search}${url.hash}`
    if (!path || path === '/') return path || fallback
    if (path.startsWith('/login') || path.startsWith('/signup')) return fallback
    return path
  } catch {
    return fallback
  }
}

/**
 * React Router location.state.from (Navigate 등)
 * @param {import('react-router-dom').Location | { pathname?: string, search?: string, hash?: string }} [from]
 * @returns {string | null}
 */
export function pathFromRouterState(from) {
  if (!from || typeof from !== 'object') return null
  const p = from.pathname ?? '/'
  const s = from.search ?? ''
  const h = from.hash ?? ''
  return `${p}${s}${h}`
}

export function storeLoginReturnForOAuth(path) {
  const safe = getSafeReturnPath(path, '')
  if (safe) sessionStorage.setItem(STORAGE_KEY, safe)
}

export function clearStoredLoginReturn() {
  sessionStorage.removeItem(STORAGE_KEY)
}

/**
 * OAuth 완료 후 한 번만 사용
 * @returns {string | null}
 */
export function consumeStoredLoginReturn() {
  const v = sessionStorage.getItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  return v
}
