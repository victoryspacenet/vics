import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Clock, Info, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

async function fetchAdminNotifications() {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error(error); return [] }
  return data || []
}

async function markOneRead(id) {
  await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id)
}

async function markAllRead() {
  await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false)
}

async function deleteNotif(id) {
  await supabase.from('admin_notifications').delete().eq('id', id)
}

const TYPE_CONFIG = {
  sla: {
    icon: Clock,
    color: 'text-red-500',
    bg: 'bg-red-50',
    ring: 'ring-1 ring-red-200',
  },
  system: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    ring: 'ring-1 ring-blue-200',
  },
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export function AdminNotificationPanel({ onClose }) {
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    fetchAdminNotifications().then((list) => { setNotifs(list); setLoading(false) })
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await markOneRead(notif.id)
      setNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n))
    }
    if (notif.type === 'sla' && notif.related_id) {
      onClose()
      navigate(`/admin/inquiry/${notif.related_id}`)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await deleteNotif(id)
    setNotifs((prev) => prev.filter((n) => n.id !== id))
  }

  const handleMarkAll = async () => {
    await markAllRead()
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifs.filter((n) => !n.is_read).length

  return (
    <div
      ref={panelRef}
      className="w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl z-50"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-gray-600" />
          <span className="text-sm font-black text-[#22282E]">관리자 알림</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-700"
          >
            <CheckCheck size={13} className="text-emerald-500" />
            모두 읽음
          </button>
        )}
      </div>

      {/* 목록 */}
      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <div className="py-10 text-center text-sm text-gray-400">불러오는 중...</div>
        )}

        {!loading && notifs.length === 0 && (
          <div className="py-12 text-center">
            <Bell size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-bold text-gray-400">새 알림이 없어요</p>
          </div>
        )}

        {!loading && notifs.map((notif) => {
          const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system
          const Icon = cfg.icon
          return (
            <button
              key={notif.id}
              type="button"
              onClick={() => handleClick(notif)}
              className={`group w-full border-b border-gray-50 px-4 py-3 text-left last:border-0 hover:bg-gray-50 transition-colors ${
                !notif.is_read ? 'bg-red-50/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.ring}`}>
                  <Icon size={14} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#22282E] leading-snug">{notif.title}</p>
                  {notif.body && (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{notif.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-400">{timeAgo(notif.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-all"
                    aria-label="삭제"
                  >
                    <X size={12} className="text-gray-400" />
                  </button>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 하단 */}
      {notifs.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
          <button
            type="button"
            onClick={() => { navigate('/admin/inquiry'); onClose() }}
            className="text-xs text-emerald-600 font-bold hover:underline"
          >
            1:1 문의 목록으로 이동 →
          </button>
        </div>
      )}
    </div>
  )
}

/** 어드민 알림 미읽음 수 조회 훅 */
export function useAdminUnreadCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetch = () => {
      supabase
        .from('admin_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .then(({ count: c }) => setCount(c || 0))
    }
    fetch()

    // Supabase Realtime 구독
    const channel = supabase
      .channel('admin_notif_count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return count
}
