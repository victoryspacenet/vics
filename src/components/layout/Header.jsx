import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Bell, Trophy, User, LogIn, UserPlus, Plus, X, Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useNotificationStore } from '../../store/notificationStore'
import { Avatar } from '../ui/Avatar'
import { NotificationPanel } from '../ui/NotificationPanel'
import { Logo } from '../ui/Logo'
import { cn } from '../../lib/utils'

export function Header() {
  const location = useLocation()
  const isMainPage = location.pathname === '/' || location.pathname.startsWith('/feed/')
  const { user, profile, signOut } = useAuthStore()
  const { openCreateDrawer, openLoginModal } = useUIStore()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const handleCreateClick = () => {
    if (!user) { openLoginModal(); return }
    openCreateDrawer()
  }

  const handleBellClick = () => {
    if (!user) { openLoginModal(); return }
    setNotifOpen((prev) => !prev)
    setProfileMenuOpen(false)
  }

  return (
    <header className={`sticky top-0 z-30 backdrop-blur-sm border-b transition-colors ${
      isMainPage ? 'bg-[#0f1419]/95 border-white/10' : 'bg-white/95 border-gray-100'
    }`}>
      <div className="max-w-screen-lg mx-auto px-4 h-14 flex items-center gap-2 min-w-0">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mr-2 shrink-0 group">
          <Logo size={32} dark={isMainPage} link={false} />
          <span className={`font-black text-lg tracking-tight hidden sm:block ${isMainPage ? 'text-white' : 'text-[#22282E]'}`}>
            VictorySpace
          </span>
        </Link>

        <div className="flex-1" />

        {/* 매치업목록 + 만들기 + Search */}
        <Link
          to="/matchups"
          className={`flex-shrink-0 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            isMainPage ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-[#22282E] hover:bg-gray-50'
          }`}
        >
          매치업목록
        </Link>
        {/* Create Button — 네온 그라데이션 CTA */}
        <button
          onClick={handleCreateClick}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black
            bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f]
            shadow-[0_0_16px_rgba(132,204,22,0.4)] hover:shadow-[0_0_26px_rgba(132,204,22,0.65)]
            hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
        >
          <Plus size={16} strokeWidth={2.5} />
          만들기
        </button>
        {/* 모바일: 아이콘만 */}
        <button
          onClick={handleCreateClick}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-xl
            bg-gradient-to-br from-lime-400 to-emerald-400 text-white
            shadow-[0_0_12px_rgba(132,204,22,0.5)] hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        {/* Search */}
        <div className="relative">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="매치업 검색..."
                className={`w-40 sm:w-52 px-3 py-1.5 text-sm rounded-xl outline-none transition-colors ${
                  isMainPage ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500' : 'bg-gray-50 border border-gray-200 focus:border-[#22282E]'
                }`}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className={`ml-1 p-2 rounded-xl ${isMainPage ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-400'}`}
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className={`p-2 rounded-xl transition-colors ${isMainPage ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-50 text-gray-400 hover:text-[#22282E]'}`}
            >
              <Search size={18} />
            </button>
          )}
        </div>

        {/* Icons */}
        {user ? (
          <>
            {/* 알림 벨 */}
            <div className="relative">
            <button
              onClick={handleBellClick}
              className={cn(
                'p-2 rounded-xl transition-colors relative',
                isMainPage
                  ? (notifOpen ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/10')
                  : (notifOpen ? 'bg-gray-100 text-[#22282E]' : 'hover:bg-gray-100 text-gray-500 hover:text-[#22282E]')
              )}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <NotificationPanel onClose={() => setNotifOpen(false)} />
              )}
            </div>

            <Link
              to="/ranking"
              className={`p-2 rounded-xl transition-colors ${isMainPage ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-[#22282E]'}`}
            >
              <Trophy size={18} />
            </Link>

            {/* 프로필 메뉴 */}
            <div className="relative">
              <button
                onClick={() => { setProfileMenuOpen(!profileMenuOpen); setNotifOpen(false) }}
                className="p-1 rounded-full hover:ring-2 hover:ring-gray-200 transition-all"
              >
                <Avatar
                  src={profile?.avatar_url}
                  alt={profile?.nickname || user.email}
                  size="sm"
                />
              </button>
              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-[#22282E] truncate">
                        {profile?.nickname || '사용자'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/mypage"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#22282E] transition-colors"
                    >
                      <User size={15} />
                      마이페이지
                    </Link>
                    <Link
                      to="/landing"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-violet-500 hover:bg-violet-50 transition-colors"
                    >
                      <Sparkles size={15} />
                      서비스 소개
                    </Link>
                    <button
                      onClick={() => { signOut(); setProfileMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#22282E] transition-colors"
                    >
                      <LogIn size={15} />
                      로그아웃
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* 모바일 전용: 서비스 소개 아이콘 버튼 */}
            <Link
              to="/landing"
              className="md:hidden p-2 rounded-xl hover:bg-violet-50 text-violet-400 hover:text-violet-600 transition-colors"
              title="서비스 소개"
            >
              <Sparkles size={18} />
            </Link>
            <button
              onClick={openLoginModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-colors font-medium ${
                isMainPage ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-[#22282E] hover:bg-gray-50'
              }`}
            >
              <LogIn size={16} />
              <span className="hidden sm:block">로그인</span>
            </button>
            <Link
              to="/signup"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-xl transition-colors font-medium ${
                isMainPage ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#22282E] hover:bg-[#363d46]'
              }`}
            >
              <UserPlus size={16} />
              <span className="hidden sm:block">회원가입</span>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
