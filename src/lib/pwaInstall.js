import { isCapacitorNativeShell } from './capacitorShell'

export function isPwaStandalone() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  if (window.navigator.standalone === true) return true
  return false
}

export function isIosSafariFamily() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iphone|ipod|ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!iOS) return false
  const isCriOS = /CriOS/i.test(ua)
  const isFxiOS = /FxiOS/i.test(ua)
  const isEdgiOS = /EdgiOS/i.test(ua)
  return !isCriOS && !isFxiOS && !isEdgiOS
}

export function isMobileBrowserViewport() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iphone|ipod|android.+mobile|windows phone/i.test(ua)) return true
  if (/ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return true
  return window.matchMedia('(max-width: 767px) and (pointer: coarse)').matches
}

export function shouldOfferPwaInstall() {
  if (typeof window === 'undefined') return false
  if (isCapacitorNativeShell()) return false
  if (isPwaStandalone()) return false
  return true
}
