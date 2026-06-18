import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { startVisibilityPolling } from '../lib/visibilityPolling'

/** Auth 스토리지 락(steal)·중복 요청으로 인한 abort — 사용자 조치 불필요 */
function isBenignNotificationFetchError(err) {
  const msg = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase()
  if (err?.name === 'AbortError') return true
  if (msg.includes('aborterror')) return true
  if (msg.includes('lock broken')) return true
  if (msg.includes("'steal'")) return true
  if (msg.includes('steal')) return true
  if (msg.includes('aborted')) return true
  return false
}

/** 짧은 간격 다중 호출 시 Supabase 내부 락/abort 충돌 방지 */
let notifFetchEpoch = 0
let notifFetchInFlight = null
let notifLastFetchedAt = 0
let notifLastFetchedUserId = null
const NOTIF_FETCH_TTL_MS = 30_000

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  pollingCleanup: null,

  // 알림 목록 로드
  fetchNotifications: async (userId, { force = false } = {}) => {
    if (!userId) return
    if (notifFetchInFlight) return notifFetchInFlight
    if (
      !force &&
      notifLastFetchedUserId === userId &&
      Date.now() - notifLastFetchedAt < NOTIF_FETCH_TTL_MS
    ) {
      return
    }

    const epoch = notifFetchEpoch
    notifFetchInFlight = (async () => {
      set({ loading: true })
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        if (epoch !== notifFetchEpoch) return
        const list = data || []
        set({
          notifications: list,
          unreadCount: list.filter((n) => !n.is_read).length,
        })
        notifLastFetchedAt = Date.now()
        notifLastFetchedUserId = userId
      } catch (err) {
        if (isBenignNotificationFetchError(err)) {
          if (import.meta.env.DEV) {
            console.debug('[Notifications] fetch skipped (benign):', err?.message || err?.details)
          }
          return
        }
        console.error('[Notifications] fetch error:', err)
      } finally {
        if (epoch === notifFetchEpoch) set({ loading: false })
      }
    })()

    try {
      await notifFetchInFlight
    } finally {
      notifFetchInFlight = null
    }
  },

  /** Realtime 대신 60초 폴링 (Disk I/O 절감) */
  subscribeRealtime: (userId) => {
    if (!userId) return
    const prev = get().pollingCleanup
    if (prev) prev()

    const cleanup = startVisibilityPolling({
      intervalMs: 60_000,
      runImmediately: false,
      onTick: () => {
        void get().fetchNotifications(userId)
      },
    })
    set({ pollingCleanup: cleanup })
  },

  unsubscribeRealtime: () => {
    const { pollingCleanup } = get()
    if (pollingCleanup) pollingCleanup()
    set({ pollingCleanup: null })
  },

  // 단건 읽음 처리
  markAsRead: async (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  },

  // 전체 읽음 처리
  markAllAsRead: async (userId) => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  },

  // 스토어 초기화 (로그아웃)
  reset: () => {
    notifFetchEpoch += 1
    notifLastFetchedAt = 0
    notifLastFetchedUserId = null
    const { pollingCleanup } = get()
    if (pollingCleanup) pollingCleanup()
    set({ notifications: [], unreadCount: 0, loading: false, pollingCleanup: null })
  },
}))
