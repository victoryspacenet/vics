/**
 * Capacitor 등 네이티브 WebView에서는 `fetch('/api/...')`가 앱 자산 기준이라
 * Netlify Functions로 연결되지 않습니다. 프로덕션 사이트 절대 URL을 붙여 해결합니다.
 *
 * 웹 브라우저: `VITE_SITE_ORIGIN` 미설정 시 상대 경로 유지(기존 동작).
 * 네이티브 빌드: `vite build` 시 `VITE_SITE_ORIGIN=https://배포도메인` 필수 권장.
 */

function trimSlash(s) {
  return String(s || '').trim().replace(/\/+$/, '')
}

/** @returns {string} 예: https://vics.example.netlify.app (없으면 '') */
export function getSiteOrigin() {
  return trimSlash(import.meta.env.VITE_SITE_ORIGIN)
}

/**
 * @param {string} path - `/api/vote` 처럼 선행 슬래시 포함
 * @returns {string} 절대 URL 또는 상대 path
 */
export function resolveSiteUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const origin = getSiteOrigin()
  if (origin) return `${origin}${p}`
  return p
}

/**
 * Supabase `signInWithOAuth`의 `redirectTo` — OAuth 완료 후 돌아올 사이트 루트(슬래시로 끝남).
 *
 * 로컬 `localhost` / `127.0.0.1`(예: npm run dev → 5173)에서는 **항상 현재 origin**을 씁니다.
 * `.env`에 `VITE_SITE_ORIGIN`을 프로덕션 URL로 두면, 예전에는 여기까지 그 URL이 쓰여
 * 소셜 로그인 중 `*.supabase.co sent an invalid response` 같은 오류가 나기 쉬웠습니다.
 *
 * Capacitor·정적 호스트 등 `window.location.origin`이 의미 없을 때만 `VITE_SITE_ORIGIN`을 사용합니다.
 *
 * @returns {string}
 */
export function getOAuthRedirectToUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    const host = window.location.hostname
    // Vite dev 서버(DEV=true): 어떤 호스트로 열어도(localhost · 127.0.0.1 · LAN IP 등)
    // OAuth redirectTo 가 VITE_SITE_ORIGIN(예: 운영 도메인)으로 고정되면
    // 로그인 후 https://www.… 로 이동해 로컬 수정분이 안 보입니다.
    const isHttpDevOrigin = /^https?:\/\//.test(origin)
    if (import.meta.env.DEV && isHttpDevOrigin) {
      return `${origin}/`
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${origin}/`
    }
  }
  const site = getSiteOrigin()
  if (site) return `${site}/`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`
  }
  return '/'
}

/**
 * 비밀번호 재설정 이메일의 `redirectTo` — 해당 **전체 URL**을 Supabase
 * Dashboard → Authentication → URL Configuration → Redirect URLs 에 등록해야 합니다.
 * (예: `http://localhost:5173/reset-password`, `https://내-도메인/reset-password`)
 *
 * `getOAuthRedirectToUrl()` 과 동일한 origin 규칙(로컬 dev에서는 현재 origin).
 */
export function getPasswordRecoveryRedirectToUrl() {
  const suffix = '/reset-password'
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    const host = window.location.hostname
    const isHttpDevOrigin = /^https?:\/\//.test(origin)
    if (import.meta.env.DEV && isHttpDevOrigin) {
      return `${origin}${suffix}`
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${origin}${suffix}`
    }
  }
  const site = getSiteOrigin()
  if (site) return `${site}${suffix}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${suffix}`
  }
  return suffix
}
