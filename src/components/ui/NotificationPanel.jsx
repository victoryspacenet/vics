import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Heart, MessageCircle, ThumbsUp } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { formatDate } from '../../lib/utils'

const TYPE_CONFIG = {
  vote:    { icon: ThumbsUp,       color: 'text-blue-500',  bg: 'bg-blue-50'   },
  comment: { icon: MessageCircle,  color: 'text-green-500', bg: 'bg-green-50'  },
  like:    { icon: Heart,          color: 'text-red-400',   bg: 'bg-red-50'    },
  match_complete: { icon: Check,   color: 'text-purple-500', bg: 'bg-purple-50' },
  ranking: { icon: Bell,           color: 'text-yellow-500', bg: 'bg-yellow-50' },
}

export function NotificationPanel({ onClose }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotificationStore()
  const panelRef = useRef(null)

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) await markAsRead(notif.id)
    onClose()
    if (notif.related_matchup_id) {
      navigate(`/matchup/${notif.related_matchup_id}`)
    }
  }

  const handleMarkAll = () => {
    if (user) markAllAsRead(user.id)
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] max-w-80 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#22282E]" />
          <span className="text-sm font-bold text-[#22282E]">알림</span>
          {unreadCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 bg-[#22282E] text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#22282E] transition-colors"
          >
            <CheckCheck size={13} />
            모두 읽음
          </button>
        )}
      </div>

      {/* 알림 목록 */}
      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-9 h-9 bg-gray-100 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="py-12 text-center">
            <Bell size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">아직 알림이 없어요</p>
          </div>
        )}

        {!loading && notifications.map((notif) => {
          const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.vote
          const Icon = cfg.icon
          return (
            <button
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                !notif.is_read ? 'bg-blue-50/30' : ''
              }`}
            >
              {/* 아이콘 */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                <Icon size={15} className={cfg.color} />
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#22282E] leading-snug">
                  {notif.title}
                </p>
                {notif.body && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{formatDate(notif.created_at)}</p>
              </div>

              {/* 읽지 않음 도트 */}
              {!notif.is_read && (
                <div className="w-2 h-2 rounded-full bg-[#22282E] mt-1 shrink-0" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
