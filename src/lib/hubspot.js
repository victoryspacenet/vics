/** HubSpot 포털 ID — 추적 코드 URL의 js.hs-scripts.com/{ID}.js 숫자 */
function readPortalId() {
  return String(import.meta.env.VITE_HUBSPOT_PORTAL_ID || '').trim()
}

function devTrackingEnabled() {
  const v = import.meta.env.VITE_HUBSPOT_ENABLE_DEV
  return v === '1' || v === 'true'
}

/** 프로덕션 또는 VITE_HUBSPOT_ENABLE_DEV=1 일 때만 로드 */
export function isHubSpotEnabled() {
  const id = readPortalId()
  if (!id || !/^\d+$/.test(id)) return false
  if (import.meta.env.DEV && !devTrackingEnabled()) return false
  return true
}

let initPromise = null

/** HubSpot 추적 스크립트 1회 로드 (설정 → 추적 코드와 동일) */
export function initHubSpot() {
  if (!isHubSpotEnabled()) return Promise.resolve(false)
  if (initPromise) return initPromise

  const portalId = readPortalId()

  initPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }

    window._hsq = window._hsq || []

    const existing = document.querySelector(`script[data-vics-hubspot="${portalId}"]`)
    if (existing) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.id = 'hs-script-loader'
    script.async = true
    script.defer = true
    script.src = `https://js.hs-scripts.com/${portalId}.js`
    script.dataset.vicsHubspot = portalId
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.warn('[HubSpot] script load failed')
      resolve(false)
    }
    document.head.appendChild(script)
  })

  return initPromise
}

/** React Router SPA — 화면 전환 시 HubSpot pageview */
export function trackHubSpotPageView(pagePath) {
  if (!isHubSpotEnabled()) return
  const path = pagePath || '/'
  window._hsq = window._hsq || []
  window._hsq.push(['setPath', path])
  window._hsq.push(['trackPageView'])
}

/**
 * 로그인 유저 식별 (선택) — HubSpot CRM 연락처 매칭
 * @param {string} email
 */
export function identifyHubSpotUser(email) {
  if (!isHubSpotEnabled() || !email) return
  window._hsq = window._hsq || []
  window._hsq.push(['identify', { email: String(email).trim() }])
}
