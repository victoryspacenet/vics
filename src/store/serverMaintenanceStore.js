import { create } from 'zustand'
import {
  fetchServerMaintenanceConfig,
  probeServerHealth,
  shouldProbeServerHealth,
  SERVER_MAINTENANCE_UPDATED,
} from '../lib/serverMaintenance'

/** 평상시: 설정만 갱신 (헬스 프로브 없음) */
const POLL_MS_IDLE = 120_000
/** 점검·다운 의심·긴급 점검 */
const POLL_MS_ACTIVE = 45_000
const POLL_MS_EMERGENCY = 12_000

let pollTimer = null
let pollMsActive = POLL_MS_IDLE
let onVisible = null
let onOnline = null
let onSettingsUpdated = null

function readNavigatorOnline() {
  if (typeof navigator === 'undefined') return true
  return Boolean(navigator.onLine)
}

export const useServerMaintenanceStore = create((set, get) => ({
  ready: false,
  checking: false,
  config: {
    enabled: false,
    mode: 'off',
    message: '',
    expectedRecoveryAt: null,
    emergencyActivatedAt: null,
    emergencyActivatedBy: null,
  },
  serverReachable: true,
  forceDemo: false,

  setForceDemo: (on) => set({ forceDemo: Boolean(on) }),

  refresh: async ({ probe = true } = {}) => {
    set({ checking: true })
    try {
      const wasReady = get().ready
      const prevReachable = get().serverReachable
      const nextConfig = await fetchServerMaintenanceConfig()
      let serverReachable = prevReachable
      const runProbe =
        probe &&
        readNavigatorOnline() &&
        (!wasReady || shouldProbeServerHealth(nextConfig, prevReachable))
      if (runProbe) {
        serverReachable = await probeServerHealth({
          light: !nextConfig.enabled,
        })
      } else if (!probe) {
        serverReachable = prevReachable
      } else {
        serverReachable = true
      }
      set({ config: nextConfig, serverReachable, ready: true, checking: false })
      if (pollTimer != null && onVisible) {
        const ms =
          nextConfig.mode === 'emergency'
            ? POLL_MS_EMERGENCY
            : nextConfig.enabled || !serverReachable
              ? POLL_MS_ACTIVE
              : POLL_MS_IDLE
        if (ms !== pollMsActive) {
          pollMsActive = ms
          window.clearInterval(pollTimer)
          pollTimer = window.setInterval(onVisible, ms)
        }
      }
    } catch {
      set((s) => ({ ready: true, checking: false, serverReachable: s.serverReachable }))
    }
  },

  startPolling: () => {
    if (pollTimer != null) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      const { config, serverReachable } = get()
      const needsProbe = shouldProbeServerHealth(config, serverReachable)
      void get().refresh({ probe: needsProbe })
    }
    onVisible = tick
    onOnline = tick
    onSettingsUpdated = tick
    const { config, serverReachable } = get()
    pollMsActive =
      config?.mode === 'emergency'
        ? POLL_MS_EMERGENCY
        : config?.enabled || !serverReachable
          ? POLL_MS_ACTIVE
          : POLL_MS_IDLE
    pollTimer = window.setInterval(tick, pollMsActive)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('online', tick)
    window.addEventListener(SERVER_MAINTENANCE_UPDATED, tick)
  },

  stopPolling: () => {
    if (pollTimer != null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
    if (onVisible) {
      document.removeEventListener('visibilitychange', onVisible)
      onVisible = null
    }
    if (onOnline) {
      window.removeEventListener('online', onOnline)
      onOnline = null
    }
    if (onSettingsUpdated) {
      window.removeEventListener(SERVER_MAINTENANCE_UPDATED, onSettingsUpdated)
      onSettingsUpdated = null
    }
  },
}))

export function selectServerMaintenanceActive(state) {
  if (state.forceDemo) return true
  if (!state.ready) return false
  if (state.config.enabled) return true
  if (!readNavigatorOnline()) return false
  return !state.serverReachable
}
