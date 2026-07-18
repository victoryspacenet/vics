import { supabase } from './supabase'

let hashListenerStarted = false
/** @type {Promise<{ handled: boolean, ok?: boolean, error?: Error }> | null} */
let bootstrapInFlight = null

function readUrlAuthParams() {
  const hashParams = new URLSearchParams(
    (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, ''),
  )
  const queryParams = new URLSearchParams(
    (typeof window !== 'undefined' ? window.location.search : '').replace(/^\?/, ''),
  )
  return { hashParams, queryParams }
}

/** 비밀번호 재설정 링크와 구분 — 소셜 OAuth 콜백만 */
export function isOAuthCallbackLanding() {
  if (typeof window === 'undefined') return false

  const path = window.location.pathname
  if (path === '/reset-password' || path === '/forgot-password') return false

  const { hashParams, queryParams } = readUrlAuthParams()
  if (hashParams.get('error') || queryParams.get('error')) return false
  if (hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery') return false

  if (hashParams.get('access_token')) return true
  if (queryParams.get('code')) return true

  return false
}

function cleanOAuthCallbackUrl() {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', window.location.pathname)
}

/**
 * 모바일 Safari·Chrome 등에서 URL 해시/코드가 늦게 붙거나
 * detectSessionInUrl 과 React 초기화가 겹치며 세션이 비는 경우를 보완합니다.
 * @returns {Promise<{ handled: boolean, ok?: boolean, error?: Error }>}
 */
export async function bootstrapOAuthCallbackFromUrl() {
  if (!isOAuthCallbackLanding()) return { handled: false }
  if (bootstrapInFlight) return bootstrapInFlight

  bootstrapInFlight = (async () => {
    const { hashParams, queryParams } = readUrlAuthParams()
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) {
        console.error('[OAuth bootstrap] setSession:', error.message)
        return { handled: true, ok: false, error }
      }
      cleanOAuthCallbackUrl()
      return { handled: true, ok: true }
    }

    const code = queryParams.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[OAuth bootstrap] exchangeCodeForSession:', error.message)
        return { handled: true, ok: false, error }
      }
      cleanOAuthCallbackUrl()
      return { handled: true, ok: true }
    }

    await supabase.auth.getSession()
    cleanOAuthCallbackUrl()
    const { data: { session } } = await supabase.auth.getSession()
    return { handled: true, ok: Boolean(session?.user) }
  })()

  try {
    return await bootstrapInFlight
  } finally {
    bootstrapInFlight = null
  }
}

/** iOS Safari 등 — 해시가 늦게 붙을 때 재시도 */
export function startOAuthCallbackHashListener(onSuccess) {
  if (hashListenerStarted || typeof window === 'undefined') return () => {}
  hashListenerStarted = true

  const tryBootstrap = async () => {
    const result = await bootstrapOAuthCallbackFromUrl()
    if (result.ok) onSuccess?.()
  }

  const onHashChange = () => {
    void tryBootstrap()
  }

  window.addEventListener('hashchange', onHashChange)
  window.setTimeout(() => {
    void tryBootstrap()
  }, 0)

  return () => {
    window.removeEventListener('hashchange', onHashChange)
    hashListenerStarted = false
  }
}
