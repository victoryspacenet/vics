import { useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  Megaphone,
  ThumbsUp,
  AlertTriangle,
  Home,
  Sparkles,
  Mail,
} from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { formatDate } from '../../lib/utils'

/** MZ 파스텔 — 타입별 아이콘 링 */
const TYPE_CONFIG = {
  vote: {
    icon: ThumbsUp,
    color: 'text-sky-600',
    bg: 'bg-gradient-to-br from-sky-100 to-cyan-100 ring-1 ring-sky-200/60',
  },
  comment: {
    icon: MessageCircle,
    color: 'text-emerald-600',
    bg: 'bg-gradient-to-br from-emerald-100 to-teal-100 ring-1 ring-emerald-200/60',
  },
  like: {
    icon: Heart,
    color: 'text-rose-500',
    bg: 'bg-gradient-to-br from-rose-100 to-pink-100 ring-1 ring-rose-200/60',
  },
  match_complete: {
    icon: Check,
    color: 'text-violet-600',
    bg: 'bg-gradient-to-br from-violet-100 to-fuchsia-100 ring-1 ring-violet-200/60',
  },
  ranking: {
    icon: Bell,
    color: 'text-amber-600',
    bg: 'bg-gradient-to-br from-amber-100 to-lime-100 ring-1 ring-amber-200/60',
  },
  notice: {
    icon: Megaphone,
    color: 'text-violet-700',
    bg: 'bg-gradient-to-br from-violet-100 to-indigo-100 ring-1 ring-violet-200/60',
  },
  content_deletion: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-gradient-to-br from-orange-100 to-amber-100 ring-1 ring-orange-200/60',
  },
  restriction_lift: {
    icon: Home,
    color: 'text-teal-600',
    bg: 'bg-gradient-to-br from-teal-100 to-cyan-100 ring-1 ring-teal-200/60',
  },
  appeal_result: {
    icon: Check,
    color: 'text-emerald-600',
    bg: 'bg-gradient-to-br from-emerald-100 to-lime-100 ring-1 ring-emerald-200/60',
  },
  inquiry_reply: {
    icon: Mail,
    color: 'text-cyan-600',
    bg: 'bg-gradient-to-br from-cyan-100 to-sky-100 ring-1 ring-cyan-200/60',
  },
  moderation_forfeit: {
    icon: AlertTriangle,
    color: 'text-rose-700',
    bg: 'bg-gradient-to-br from-rose-100 to-red-100 ring-1 ring-rose-200/60',
  },
}

function payloadObj(notif) {
  const p = notif?.payload
  if (p && typeof p === 'object') return p
  try {
    return typeof p === 'string' && p ? JSON.parse(p) : {}
  } catch {
    return {}
  }
}

export function NotificationPanel({ onClose }) {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { openWelcomeBackModal } = useUIStore()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotificationStore()
  const panelRef = useRef(null)

  const mergedList = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [notifications]
  )

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

    const pl = payloadObj(notif)

    if (notif.type === 'content_deletion' && pl.deletionId) {
      navigate(`/notice/deletion/${pl.deletionId}`)
      return
    }
    if (notif.type === 'appeal_result' && pl.receiptId) {
      navigate(`/appeal-result/${encodeURIComponent(pl.receiptId)}`)
      return
    }
    if (notif.type === 'inquiry_reply' && pl.receipt_id) {
      navigate(`/inquiry/history/${encodeURIComponent(pl.receipt_id)}`)
      return
    }
    if (notif.type === 'restriction_lift') {
      openWelcomeBackModal({
        nickname: pl.nickname || profile?.nickname || '회원',
        avatarUrl: pl.avatarUrl ?? profile?.avatar_url ?? null,
        userId: user?.id,
        endsAt: typeof pl.endsAtMs === 'number' ? pl.endsAtMs : null,
      })
      return
    }
    if (notif.related_matchup_id) {
      navigate(`/matchup/${notif.related_matchup_id}`)
    }
    if (notif.related_notice_id) {
      navigate(`/notice/${notif.related_notice_id}`)
    }
  }

  const handleMarkAll = async () => {
    if (user) await markAllAsRead(user.id)
  }

  return (
    <div
      ref={panelRef}
      className="w-[min(20rem,calc(100vw-2rem))] max-w-80 overflow-hidden rounded-2xl border-2 border-pink-200 bg-gradient-to-br from-rose-50 via-fuchsia-50 to-cyan-50 shadow-[0_20px_50px_-12px_rgba(236,72,153,0.35),0_8px_24px_-8px_rgba(34,211,238,0.2)] ring-2 ring-white z-50"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-pink-200 bg-gradient-to-r from-fuchsia-100 via-pink-50 to-violet-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 text-white shadow-md shadow-fuchsia-400/35 ring-1 ring-white/50">
            <Bell size={15} strokeWidth={2.5} />
          </div>
          <span className="bg-gradient-to-r from-fuchsia-800 via-violet-700 to-cyan-700 bg-clip-text text-sm font-black tracking-tight text-transparent">
            알림
          </span>
          {unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm shadow-fuchsia-400/40 ring-1 ring-white/40">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-bold text-fuchsia-800 transition-colors hover:bg-white hover:text-fuchsia-900"
          >
            <CheckCheck size={13} strokeWidth={2.25} className="text-emerald-600" />
            모두 읽음
          </button>
        )}
      </div>

      {/* 알림 목록 */}
      <div className="max-h-96 overflow-y-auto overscroll-contain [scrollbar-color:rgba(244,114,182,0.35)_transparent]">
        {loading && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl p-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-pink-100 to-fuchsia-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-pink-100/90" />
                  <div className="h-3 w-1/2 rounded bg-fuchsia-100/70" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && mergedList.length === 0 && (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-100 to-cyan-100 ring-1 ring-pink-200/60">
              <Sparkles className="text-fuchsia-400" size={26} strokeWidth={2} />
            </div>
            <p className="text-sm font-bold text-fuchsia-900/75">아직 알림이 없어요</p>
            <p className="mt-1 text-xs font-medium text-fuchsia-700/50">새 소식이 오면 여기에 모여요</p>
          </div>
        )}

        {!loading &&
          mergedList.map((notif) => {
            const pl = payloadObj(notif)
            let cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.vote
            if (notif.type === 'appeal_result') {
              cfg =
                pl.decision === 'approve'
                  ? {
                      icon: Check,
                      color: 'text-emerald-600',
                      bg: 'bg-gradient-to-br from-emerald-100 to-lime-100 ring-1 ring-emerald-200/60',
                    }
                  : {
                      icon: AlertTriangle,
                      color: 'text-orange-600',
                      bg: 'bg-gradient-to-br from-orange-100 to-amber-100 ring-1 ring-orange-200/60',
                    }
            }
            const Icon = cfg.icon
            const isNotice =
              notif.type === 'notice' ||
              notif.type === 'appeal_result' ||
              notif.type === 'content_deletion' ||
              notif.type === 'restriction_lift' ||
              notif.type === 'inquiry_reply' ||
              notif.type === 'moderation_forfeit'
            return (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleNotifClick(notif)}
                className={`w-full border-b border-pink-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gradient-to-r hover:from-fuchsia-50 hover:to-cyan-50/90 ${
                  !notif.is_read
                    ? 'bg-gradient-to-r from-fuchsia-50 via-rose-50/95 to-white'
                    : 'bg-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}
                  >
                    <Icon size={15} strokeWidth={2.25} className={cfg.color} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`leading-snug ${
                        isNotice
                          ? 'text-sm font-black text-fuchsia-950'
                          : 'text-sm font-semibold text-fuchsia-950/95'
                      }`}
                    >
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs font-medium text-fuchsia-800/55">
                        {notif.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] font-medium text-fuchsia-600/45">{formatDate(notif.created_at)}</p>
                  </div>

                  {!notif.is_read && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-sm shadow-fuchsia-400/50 ring-1 ring-white/80" />
                  )}
                </div>
              </button>
            )
          })}
      </div>
    </div>
  )
}
