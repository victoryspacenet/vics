/** 개발 중 Cursor Simple Browser 등 IDE 내장 웹뷰 — HMR·캐시가 불안정한 환경 */

const DISMISS_KEY = 'vics:devEmbeddedBrowserBanner:dismiss'

export function isDevEmbeddedIdeBrowser() {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent || ''

  // Cursor·VS Code Simple Browser (Electron 기반)
  if (/Electron/i.test(ua)) return true

  // IDE 패널 iframe 임베드
  try {
    if (window.self !== window.top) return true
  } catch {
    return true
  }

  return false
}

export function isDevEmbeddedBrowserBannerDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissDevEmbeddedBrowserBanner() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    void 0
  }
}

export function hardReloadDevPreview() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('_dev_refresh', String(Date.now()))
  window.location.replace(url.toString())
}

/** 내장 브라우저 bfcache 복귀 시 한 번 새로고침 (자동 HMR reload는 무한 로딩 유발) */
export function setupDevEmbeddedBrowserReload() {
  if (!isDevEmbeddedIdeBrowser()) return

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload()
  })
}
