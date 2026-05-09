import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
let notifFetchChain = Promise.resolve()
/** reset(로그아웃) 이후 늦게 끝난 fetch가 상태를 덮어쓰지 않도록 */
let notifFetchEpoch = 0

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  realtimeChannel: null,

  // 알림 목록 로드
  fetchNotifications: async (userId) => {
    if (!userId) return
    const epoch = notifFetchEpoch
    notifFetchChain = notifFetchChain.catch(() => {}).then(async () => {
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
    })
    return notifFetchChain
  },

  // Supabase Realtime 구독 시작
  subscribeRealtime: (userId) => {
    if (!userId) return
    const prev = get().realtimeChannel
    if (prev) { supabase.removeChannel(prev) }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new
          set((state) => ({
            notifications: [newNotif, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }))
        }
      )
      .subscribe((status) => {
        console.log('[Notifications] realtime:', status)
      })

    set({ realtimeChannel: channel })
  },

  // Realtime 구독 해제
  unsubscribeRealtime: () => {
    const { realtimeChannel } = get()
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      set({ realtimeChannel: null })
    }
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
    const { realtimeChannel } = get()
    if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    set({ notifications: [], unreadCount: 0, loading: false, realtimeChannel: null })
  },
}))
