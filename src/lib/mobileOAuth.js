import { supabase } from './supabase'
import { isCapacitorNativeShell, MOBILE_OAUTH_CALLBACK_URL } from './capacitorShell'
import { useUIStore } from '../store/uiStore'

let listenerRegistered = false

function parseOAuthCallbackParams(url) {
  const raw = String(url || '')
  const hashIdx = raw.indexOf('#')
  const queryIdx = raw.indexOf('?')
  let fragment = ''
  if (hashIdx >= 0) fragment = raw.slice(hashIdx + 1)
  else if (queryIdx >= 0) fragment = raw.slice(queryIdx + 1)
  return new URLSearchParams(fragment)
}

async function finishOAuthFromCallbackUrl(url) {
  const params = parseOAuthCallbackParams(url)
  const errorDesc = params.get('error_description') || params.get('error')
  if (errorDesc) {
    const human = errorDesc.replace(/\+/g, ' ')
    console.error('[OAuth mobile] callback error:', human)
    useUIStore.getState().showToast(`소셜 로그인 실패: ${human}`, 'error')
    return
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) {
      console.error('[OAuth mobile] setSession:', error.message)
      useUIStore.getState().showToast(`소셜 로그인 실패: ${error.message}`, 'error')
      return
    }
    useUIStore.getState().showToast('로그인 됐어요!', 'success')
    return
  }

  const code = params.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[OAuth mobile] exchangeCodeForSession:', error.message)
      useUIStore.getState().showToast(`소셜 로그인 실패: ${error.message}`, 'error')
      return
    }
    useUIStore.getState().showToast('로그인 됐어요!', 'success')
  }
}

/** 앱 딥링크·콜드스타트에서 OAuth 콜백 수신 */
export function registerMobileOAuthCallbackListener() {
  if (!isCapacitorNativeShell() || listenerRegistered) return
  listenerRegistered = true

  void (async () => {
    try {
      const { App } = await import('@capacitor/app')
      await App.addListener('appUrlOpen', async ({ url }) => {
        if (!url?.startsWith(MOBILE_OAUTH_CALLBACK_URL)) return
        try {
          const { Browser } = await import('@capacitor/browser')
          await Browser.close()
        } catch {
          /* ignore */
        }
        await finishOAuthFromCallbackUrl(url)
      })

      const launch = await App.getLaunchUrl()
      if (launch?.url?.startsWith(MOBILE_OAUTH_CALLBACK_URL)) {
        await finishOAuthFromCallbackUrl(launch.url)
      }
    } catch (err) {
      console.error('[OAuth mobile] listener setup:', err)
    }
  })()
}

/**
 * Capacitor: InAppBrowser + 딥링크 콜백으로 세션을 앱 WebView에 유지
 * @param {'google' | 'kakao'} provider
 */
export async function signInWithOAuthNative(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: MOBILE_OAUTH_CALLBACK_URL,
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  if (!data?.url) throw new Error('OAuth URL을 받지 못했어요')

  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url: data.url })
}
