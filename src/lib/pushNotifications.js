import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'

/** @type {string|null} */
let lastRegisteredToken = null

/**
 * 네이티브 앱에서만: 권한 → FCM 토큰 등록 → Netlify로 토픽 구독 + Supabase upsert(서버 처리)
 * @returns {Promise<{ ok?: true, skipped?: string, error?: unknown }>}
 */
export async function registerPushForCurrentUser() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) {
      return { skipped: 'web' }
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token || !session.user) {
      return { skipped: 'no_session' }
    }

    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') {
      return { skipped: 'denied' }
    }

    /** @type {{ remove: () => Promise<void> } | undefined} */
    let regHandle
    /** @type {{ remove: () => Promise<void> } | undefined} */
    let errHandle

    const result = await new Promise((resolve) => {
      let settled = false
      const finish = async (payload) => {
        if (settled) return
        settled = true
        try {
          await regHandle?.remove()
        } catch {
          void 0
        }
        try {
          await errHandle?.remove()
        } catch {
          void 0
        }
        resolve(payload)
      }

      void (async () => {
        try {
          regHandle = await PushNotifications.addListener('registration', async (reg) => {
            const value = reg?.value
            if (!value) {
              await finish({ ok: false, error: new Error('empty registration token') })
              return
            }
            lastRegisteredToken = value
            const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
            try {
              const res = await fetch(resolveSiteUrl('/api/fcm-register-token'), {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: value, platform }),
              })
              if (!res.ok) {
                const t = await res.text().catch(() => '')
                await finish({ ok: false, error: new Error(t || res.statusText) })
                return
              }
              await finish({ ok: true })
            } catch (e) {
              await finish({ ok: false, error: e })
            }
          })

          errHandle = await PushNotifications.addListener('registrationError', async (err) => {
            await finish({ ok: false, error: err })
          })

          await PushNotifications.register()
        } catch (e) {
          await finish({ ok: false, error: e })
        }
      })()

      setTimeout(() => {
        void finish({ ok: false, error: new Error('push registration timeout') })
      }, 18000)
    })

    return result
  } catch (e) {
    return { ok: false, error: e }
  }
}

/** 로그아웃 전: 내 기기 토큰 행 삭제 (RLS) */
export async function clearPushDeviceTokensForUser(userId) {
  if (!userId) return
  try {
    await supabase.from('push_device_tokens').delete().eq('user_id', userId)
  } catch {
    void 0
  }
  lastRegisteredToken = null
}

export function getLastRegisteredPushToken() {
  return lastRegisteredToken
}
