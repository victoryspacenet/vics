import { Link, useLocation } from 'react-router-dom'
import { Home, Trophy, Plus, User, Compass } from 'lucide-react'
import { Header } from './Header'
import { Footer } from './Footer'
import { Toast } from '../ui/Toast'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useNotificationStore } from '../../store/notificationStore'

export function Layout({ children }) {
  const location = useLocation()
  const isMainPage = location.pathname === '/' || location.pathname.startsWith('/feed/')
  return (
    <div className={`min-h-screen overflow-x-hidden ${isMainPage ? 'bg-[#0f1419]' : 'bg-gray-50'}`}>
      <Header />
      <main className="max-w-screen-lg mx-auto px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>
      <Footer />
      <Toast />
      <BottomNav />
    </div>
  )
}

// ── 모바일 하단 내비게이션 바 ─────────────────────────────────────
function BottomNav() {
  const location  = useLocation()
  const { user }  = useAuthStore()
  const { openCreateDrawer, openLoginModal } = useUIStore()
  const { unreadCount } = useNotificationStore()

  const handleCreate = () => {
    if (!user) { openLoginModal(); return }
    openCreateDrawer()
  }

  const isActive = (path) => location.pathname === path
  const isMainArea = location.pathname === '/' || location.pathname.startsWith('/feed/')

  const isMainPage = isMainArea
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
      {/* 블러 배경 */}
      <div className={`absolute inset-0 backdrop-blur-md border-t ${
        isMainPage ? 'bg-[#0f1419]/95 border-white/10' : 'bg-white/90 border-gray-100'
      }`} />

      <div className="relative flex items-end justify-around h-16 px-1 w-full max-w-sm mx-auto min-w-0">
        {/* 홈 (메인 페이지) */}
        <NavItem
          to="/"
          icon={Home}
          label="홈"
          active={isActive('/') || location.pathname.startsWith('/feed/')}
          dark={isMainPage}
        />

        {/* 랭킹 */}
        <NavItem
          to="/ranking"
          icon={Trophy}
          label="랭킹"
          active={isActive('/ranking')}
          dark={isMainPage}
        />

        {/* + 생성 버튼 (중앙, 강조) */}
        <button
          onClick={handleCreate}
          className="flex flex-col items-center gap-0.5 -mt-4 shrink-0"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200/70 hover:scale-110 active:scale-95 transition-transform">
            <Plus size={28} className="text-white stroke-[2.5]" />
          </div>
          <span className="text-[9px] font-black text-emerald-600 pb-1">만들기</span>
        </button>

        {/* 알림 */}
        <button
          onClick={() => !user ? openLoginModal() : null}
          className="flex flex-col items-center gap-0.5 py-2 px-3 relative"
        >
          {user ? (
            <Link to="/mypage" className="flex flex-col items-center gap-0.5">
              <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                isActive('/mypage') ? (isMainPage ? 'bg-emerald-500' : 'bg-[#22282E]') : ''
              }`}>
                <User size={20} className={isActive('/mypage') ? 'text-white' : (isMainPage ? 'text-white/60' : 'text-gray-400')} />
              </div>
              <span className={`text-[9px] font-bold ${isActive('/mypage') ? (isMainPage ? 'text-emerald-400' : 'text-[#22282E]') : (isMainPage ? 'text-white/60' : 'text-gray-400')}`}>마이</span>
            </Link>
          ) : (
            <button onClick={openLoginModal} className="flex flex-col items-center gap-0.5">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl">
                <User size={20} className={isMainPage ? 'text-white/60' : 'text-gray-400'} />
              </div>
              <span className={`text-[9px] font-bold ${isMainPage ? 'text-white/60' : 'text-gray-400'}`}>마이</span>
            </button>
          )}
        </button>

        {/* Explore */}
        <NavItem
          to="/explore"
          icon={Compass}
          label="탐색"
          active={isActive('/explore')}
          dark={isMainPage}
        />
      </div>

      {/* Safe area 하단 여백 */}
      <div className={`h-safe-area-inset-bottom ${isMainPage ? 'bg-[#0f1419]/95' : 'bg-white/90'}`} />
    </nav>
  )
}

function NavItem({ to, icon: Icon, label, active, dark }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-0.5 py-2 px-3">
      <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
        active ? (dark ? 'bg-emerald-500' : 'bg-[#22282E]') : ''
      }`}>
        <Icon
          size={20}
          className={active ? 'text-white' : (dark ? 'text-white/60' : 'text-gray-400')}
        />
      </div>
      <span className={`text-[9px] font-bold ${
        active ? (dark ? 'text-emerald-400' : 'text-[#22282E]') : (dark ? 'text-white/60' : 'text-gray-400')
      }`}>
        {label}
      </span>
    </Link>
  )
}
