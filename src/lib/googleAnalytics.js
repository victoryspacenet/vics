/** GA4 Measurement ID — `G-XXXXXXXXXX` (Google Analytics → 데이터 스트림) */
function readMeasurementId() {
  return String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()
}

function devTrackingEnabled() {
  const v = import.meta.env.VITE_GA_ENABLE_DEV
  return v === '1' || v === 'true'
}

/** 프로덕션 또는 VITE_GA_ENABLE_DEV=1 일 때만 수집 */
export function isGoogleAnalyticsEnabled() {
  const id = readMeasurementId()
  if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return false
  if (import.meta.env.DEV && !devTrackingEnabled()) return false
  return true
}

let initPromise = null

/** gtag.js 1회 로드 — SPA는 send_page_view: false 후 라우트마다 page_view */
export function initGoogleAnalytics() {
  if (!isGoogleAnalyticsEnabled()) return Promise.resolve(false)
  if (initPromise) return initPromise

  const measurementId = readMeasurementId()

  initPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }

    window.dataLayer = window.dataLayer || []
    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments)
      }
    }

    const existing = document.querySelector(`script[data-vics-ga="${measurementId}"]`)
    if (existing) {
      window.gtag('config', measurementId, { send_page_view: false })
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    script.dataset.vicsGa = measurementId
    script.onload = () => {
      window.gtag('js', new Date())
      window.gtag('config', measurementId, { send_page_view: false })
      resolve(true)
    }
    script.onerror = () => {
      console.warn('[GA] gtag.js load failed')
      resolve(false)
    }
    document.head.appendChild(script)
  })

  return initPromise
}

/**
 * @param {string} pagePath — pathname + search (hash 제외)
 * @param {string} [pageTitle]
 */
export function trackGoogleAnalyticsPageView(pagePath, pageTitle) {
  if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== 'function') return
  const measurementId = readMeasurementId()
  const path = pagePath || '/'
  window.gtag('event', 'page_view', {
    send_to: measurementId,
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: pageTitle || document.title,
  })
}

/** 커스텀 이벤트 — sign_up, purchase 등 나중에 데이터 통합 시 사용 */
export function trackGoogleAnalyticsEvent(eventName, params = {}) {
  if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params)
}
