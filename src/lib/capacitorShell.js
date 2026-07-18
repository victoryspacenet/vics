/** Capacitor 네이티브 WebView 셸 판별 (OAuth·API 절대 URL 등) */

export const MOBILE_OAUTH_CALLBACK_URL = 'app.vics.space://login-callback'

export function isCapacitorNativeShell() {
  if (typeof window === 'undefined') return false
  const cap = window.Capacitor
  if (!cap) return false
  if (cap.isNativePlatform?.()) return true
  const platform = cap.getPlatform?.()
  return Boolean(platform && platform !== 'web')
}

/** Capacitor androidScheme:https → https://localhost */
export function isCapacitorHttpsLocalhostShell() {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  return protocol === 'https:' && (hostname === 'localhost' || hostname === '127.0.0.1')
}
