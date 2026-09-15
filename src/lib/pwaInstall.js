import { isCapacitorNativeShell } from './capacitorShell'
import { isInAppBrowser } from './inAppBrowser'

function safeMatchMedia(query) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return Boolean(window.matchMedia(query).matches)
  } catch {
    return false
  }
}

export function isPwaStandalone() {
  if (typeof window === 'undefined') return false
  if (safeMatchMedia('(display-mode: standalone)')) return true
  if (safeMatchMedia('(display-mode: fullscreen)')) return true
  if (window.navigator.standalone === true) return true
  return false
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iphone|ipod|ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isIosSafariFamily() {
  if (typeof navigator === 'undefined') return false
  if (!isIosDevice()) return false
  const ua = navigator.userAgent || ''
  const isCriOS = /CriOS/i.test(ua)
  const isFxiOS = /FxiOS/i.test(ua)
  const isEdgiOS = /EdgiOS/i.test(ua)
  const isOPiOS = /OPiOS/i.test(ua)
  return !isCriOS && !isFxiOS && !isEdgiOS && !isOPiOS
}

export function isMobileBrowserViewport() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iphone|ipod|android.+mobile|windows phone/i.test(ua)) return true
  if (/ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return true
  return safeMatchMedia('(max-width: 767px) and (pointer: coarse)')
}

export function shouldOfferPwaInstall() {
  if (typeof window === 'undefined') return false
  if (isCapacitorNativeShell()) return false
  if (isPwaStandalone()) return false
  return true
}

/**
 * 홈 화면 추가가 가능한 경로.
 * - android: Chrome 설치 프롬프트 또는 브라우저 메뉴
 * - ios-safari: 공유 → 홈 화면에 추가
 * - ios-other: Safari로 이동해야 함 (iOS Chrome 등은 A2HS 없음)
 * - in-app: 카카오/인스타 등 — 외부 브라우저로 열어야 함
 * - none: 이미 설치됨·데스크톱·네이티브 앱
 */
export function getPwaInstallMode() {
  try {
    if (!shouldOfferPwaInstall()) return 'none'
    if (isInAppBrowser()) return 'in-app'
    if (isIosSafariFamily()) return 'ios-safari'
    if (isIosDevice()) return 'ios-other'
    if (isMobileBrowserViewport()) return 'android'
    return 'none'
  } catch {
    return 'none'
  }
}
