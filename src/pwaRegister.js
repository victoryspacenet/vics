import { isCapacitorNativeShell } from './lib/capacitorShell'

export function registerPwaServiceWorker() {
  if (typeof window === 'undefined') return
  if (import.meta.env.DEV) return
  if (isCapacitorNativeShell()) return

  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true })
    })
    .catch(() => {
      /* 빌드에 SW가 없으면 무시 */
    })
}
