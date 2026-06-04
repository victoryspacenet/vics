import { createClient } from '@supabase/supabase-js'
import { resolveSiteUrl } from './siteApiBase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let _429PushLast = 0
function wrapSupabaseFetch(getClient) {
  return async (input, init) => {
    const res = await globalThis.fetch(input, init)
    if (
      typeof window !== 'undefined' &&
      res.status === 429 &&
      supabaseUrl &&
      String(input).includes(supabaseUrl) &&
      Date.now() - _429PushLast > 10 * 60 * 1000
    ) {
      _429PushLast = Date.now()
      queueMicrotask(async () => {
        try {
          const { data: { session } } = await getClient().auth.getSession()
          if (!session?.access_token) return
          await fetch(resolveSiteUrl('/api/system-push-dispatch'), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventId: 'rate_limit_breach',
              title: 'Supabase API Rate Limit (429)',
              body: `요청 URL: ${String(input).slice(0, 500)}`,
            }),
          })
        } catch {
          /* ignore */
        }
      })
    }
    return res
  }
}

// 런타임 HTTPS 검증: 프로덕션에서는 반드시 https 사용
function validateSupabaseUrl(url) {
  if (!url) return
  try {
    const parsed = new URL(url)
    const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname)
    const isHttps = parsed.protocol === 'https:'
    if (!isLocalhost && !isHttps) {
      console.error(
        '[VICS 보안] Supabase URL은 HTTPS여야 합니다. VITE_SUPABASE_URL을 https:// 로 설정해주세요.',
        { received: url }
      )
      // 개발 중 잘못된 URL이어도 화면(에러 UI)은 뜨게 하고, 프로덕션에서만 하드 실패
      if (import.meta.env.PROD) {
        throw new Error('Supabase URL must use HTTPS in production. Check VITE_SUPABASE_URL.')
      }
    }
  } catch (e) {
    if (e.message?.includes('HTTPS')) throw e
    console.warn('[VICS] Supabase URL 검증 중 오류:', e.message)
  }
}
validateSupabaseUrl(supabaseUrl)

let supabaseSingleton
supabaseSingleton = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    /** PKCE 재설정 시 code verifier 때문에 브라우저 불일치가 나기 쉬워 implicit 사용. 재설정 URL은 `#access_token=…` */
    flowType: 'implicit',
    /** 브라우저의 navigator.locks 경합 완화(다중 탭·initialize+업데이트 동시 실행 시 steal 메시지). */
    lockAcquireTimeout: 120000,
  },
  global: {
    fetch: wrapSupabaseFetch(() => supabaseSingleton),
  },
})

export const supabase = supabaseSingleton
