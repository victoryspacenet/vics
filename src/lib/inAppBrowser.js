import { isCapacitorNativeShell } from './capacitorShell'

const IN_APP_UA =
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|KAKAOTALK|Line\/|NAVER|Twitter|Snapchat|LinkedInApp|MicroMessenger|BytedanceWebview|musical_ly|TikTok|GSA\//i

/** 카카오톡·인스타 등 인앱 브라우저 — Google OAuth 가 차단되는 환경 */
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  if (isCapacitorNativeShell()) return false

  const ua = navigator.userAgent || ''
  // iOS/Android 정식 브라우저 탭
  if (/CriOS|FxiOS|EdgiOS|OPiOS|SamsungBrowser/i.test(ua)) return false

  if (IN_APP_UA.test(ua)) return true

  // Android WebView (앱 내장 브라우저)
  if (/Android/i.test(ua) && /;\s*wv\)|Version\/[\d.]+.*Chrome\/[\d.]+(?!.*CriOS)/i.test(ua)) {
    return true
  }

  return false
}

/** 안내 문구용 — iOS는 사파리, Android는 크롬 */
export function getExternalBrowserLabel() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Safari'
  return 'Chrome'
}

export function getLoginPageUrl() {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/login`
}

/** Android 인앱에서 Chrome으로 열기. iOS는 스키마가 불안정해 false. */
export function openInExternalBrowser(url) {
  if (typeof window === 'undefined') return false
  const target = url || window.location.href
  const ua = navigator.userAgent || ''
  if (!/Android/i.test(ua)) return false

  let parsed
  try {
    parsed = new URL(target, window.location.origin)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false

  const hostAndPath = `${parsed.host}${parsed.pathname}${parsed.search}`
  const fallback = encodeURIComponent(parsed.href)
  window.location.href =
    `intent://${hostAndPath}#Intent;scheme=${parsed.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${fallback};end`
  return true
}
