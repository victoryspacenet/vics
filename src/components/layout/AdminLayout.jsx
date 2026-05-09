import { useState, useEffect, useRef } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Search, Bell, Menu, X, LayoutDashboard, Swords, Users, FolderOpen, Megaphone, MessageSquareWarning, HeadphonesIcon, Settings, ExternalLink } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { canAccessAdmin } from '../../lib/adminAuth'
import { touchOperatorLastAccessByEmail } from '../../lib/operatorAdminStorage'
import { menuKeyFromAdminPath } from '../../lib/adminRouteMenuMap'
import { notifyNewAdminLoginDevice } from '../../lib/systemPushClient'
import { useAdminPermissionStore } from '../../store/adminPermissionStore'
import { Toast } from '../ui/Toast'
import { AdminNotificationPanel, useAdminUnreadCount } from '../admin/AdminNotificationPanel'

const SIDEBAR_ITEMS = [
  { to: '/admin/dashboard', label: '대시보드', icon: LayoutDashboard, menuKey: 'dashboard' },
  { to: '/admin/matchups', label: '매치업관리', icon: Swords, menuKey: 'matchups' },
  { to: '/admin/users', label: '유저관리', icon: Users, menuKey: 'users' },
  { to: '/admin/categories', label: '카테고리관리', icon: FolderOpen, menuKey: 'matchups' },
  { to: '/admin/notice/new', label: '공지사항', icon: Megaphone, pathPrefix: '/admin/notice', menuKey: 'settings' },
  { to: '/admin/appeals', label: '이의 신청', icon: MessageSquareWarning, pathPrefix: '/admin/appeals', menuKey: 'users' },
  { to: '/admin/inquiry', label: '1:1 문의', icon: HeadphonesIcon, pathPrefix: '/admin/inquiry', menuKey: 'users' },
  { to: '/admin/settings', label: '설정', icon: Settings, pathPrefix: '/admin/settings', menuKey: 'settings' },
]

export function AdminLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuthStore()
  const { showToast } = useUIStore()
  const unreadCount = useAdminUnreadCount()
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const suspendedToastDone = useRef(false)

  const { loading: authLoading } = useAuthStore()
  const load = useAdminPermissionStore((s) => s.load)
  const loading = useAdminPermissionStore((s) => s.loading)
  const suspended = useAdminPermissionStore((s) => s.suspended)

  useEffect(() => {
    if (!user?.email || !canAccessAdmin(user)) return
    void load(user)
    void touchOperatorLastAccessByEmail(user.email)
  }, [user?.email, user, load])

  useEffect(() => {
    if (!user?.id || !canAccessAdmin(user)) return
    void notifyNewAdminLoginDevice(user)
  }, [user?.id, user?.email])

  useEffect(() => {
    suspendedToastDone.current = false
  }, [user?.id])

  useEffect(() => {
    if (loading || !suspended || suspendedToastDone.current) return
    suspendedToastDone.current = true
    showToast('정지된 운영자 계정이에요. 관리자 화면을 쓸 수 없어요.', 'error')
  }, [loading, suspended, showToast])

  useEffect(() => {
    if (loading || suspended) return
    const mk = menuKeyFromAdminPath(pathname)
    if (!mk) return
    if (useAdminPermissionStore.getState().allowsMenuRead(mk)) return
    showToast('이 메뉴에 대한 조회 권한이 없어요.', 'error')
  }, [pathname, loading, suspended, showToast])

  // 세션 복원 중에는 판단 보류 (새로고침 시 user가 잠깐 null이 되는 문제 방지)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-sm font-medium text-gray-400">로딩 중…</div>
      </div>
    )
  }

  if (!canAccessAdmin(user)) {
    return <Navigate to="/" replace />
  }

  const menuKey = menuKeyFromAdminPath(pathname)
  const canReadSection = !menuKey || useAdminPermissionStore.getState().allowsMenuRead(menuKey)

  if (!loading && suspended) {
    return <Navigate to="/" replace />
  }

  if (!loading && menuKey && !canReadSection) {
    const st = useAdminPermissionStore.getState()
    const fallback = st.allowsMenuRead('dashboard') ? '/admin/dashboard' : '/'
    return <Navigate to={fallback} replace />
  }

  const visibleSidebar = SIDEBAR_ITEMS.filter((item) => useAdminPermissionStore.getState().allowsMenuRead(item.menuKey))
  const stNav = useAdminPermissionStore.getState()
  const logoTo =
    visibleSidebar[0]?.to ??
    (stNav.allowsMenuRead('dashboard') ? '/admin/dashboard' : '/')

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-[#1a1d21] text-white shrink-0 transform transition-transform duration-200 ease-out lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="sticky top-0 py-6">
          <Link to={logoTo} onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 px-4 mb-6">
            <img src="/logo.png" alt="" width={28} height={28} className="invert" />
            <span className="font-black text-lg">Admin</span>
          </Link>
          <nav className="space-y-0.5">
            {visibleSidebar.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.to ||
                (item.pathPrefix && pathname.startsWith(item.pathPrefix)) ||
                (!item.pathPrefix && item.to !== '/admin/dashboard' && pathname.startsWith(item.to))
              return (
                <Link
                  key={item.to + (item.pathPrefix || '')}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-gray-200 px-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="메뉴 열기"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors shrink-0"
          >
            <ExternalLink size={16} />
            유저 페이지
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label="관리자 알림"
            >
              <Bell size={20} className={notifOpen ? 'text-emerald-600' : ''} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full pointer-events-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2">
                <AdminNotificationPanel onClose={() => setNotifOpen(false)} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
              👤
            </div>
            <span className="text-sm font-bold text-gray-700 hidden sm:inline">운영팀장</span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center text-sm font-medium text-gray-500">
              권한 정보 확인 중…
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <Toast />
    </div>
  )
}
