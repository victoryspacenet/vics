import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** 네이티브: 알림 탭 시 FCM data.route 로 SPA 이동 */
export function PushNotificationNavBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    /** @type {{ remove: () => Promise<void> } | undefined} */
    let tapHandle

    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform() || cancelled) return
        const { PushNotifications } = await import('@capacitor/push-notifications')
        tapHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          const d = event.notification?.data || {}
          const route = d.route != null ? String(d.route).trim() : ''
          if (route.startsWith('/')) navigate(route)
        })
      } catch {
        void 0
      }
    })()

    return () => {
      cancelled = true
      void tapHandle?.remove?.()
    }
  }, [navigate])

  return null
}
