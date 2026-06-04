import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Bell, Trophy, User, LogIn, UserPlus, Plus, X, Sparkles, Megaphone, FileText, Settings, LayoutDashboard, Coins,
  Heart, Compass,
} from 'lucide-react'
import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useNotificationStore } from '../../store/notificationStore'
import { Avatar } from '../ui/Avatar'
import { Logo } from '../ui/Logo'
import { cn } from '../../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../../lib/layoutShellClasses'
import { encodeForUrl } from '../../lib/sanitize'
import { useCanAccessAdmin } from '../../lib/adminAuth'
import { isLegendDiamondShellActive } from '../../lib/legendDiamondUiTheme'

export function Header() {
  const location = useLocation()
  const { user, profile, signOut } = useAuthStore()
  const showAdminNav = useCanAccessAdmin()
  const shellLd = Boolean(user && isLegendDiamondShellActive(profile))
  const { openCreateDrawer, openLoginModal } = useUIStore()
  const { unreadCount } = useNotificationStore()
  const totalUnread = unreadCount
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [pointsPulse, setPointsPulse] = useState(false)
  /** 헤더 backdrop-blur 아래에 두면 드롭다운 상단이 비쳐 보임 → body로 포털 */
  const [profileMenuPos, setProfileMenuPos] = useState(null)
  const profileMenuAnchorRef = useRef(null)
  const { isNotificationPanelOpen, toggleNotificationPanel, closeNotificationPanel } = useUIStore()

  useLayoutEffect(() => {
    if (!profileMenuOpen) {
      setProfileMenuPos(null)
      return
    }
    const el = profileMenuAnchorRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setProfileMenuPos({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [profileMenuOpen])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeForUrl(searchQuery.trim())}`)
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
    toggleNotificationPanel()
    setProfileMenuOpen(false)
  }

  const isNoticeActive =
    location.pathname === '/notice' || location.pathname.startsWith('/notice/')

  useEffect(() => {
    const onPulse = () => {
      setPointsPulse(true)
      window.setTimeout(() => setPointsPulse(false), 1900)
    }
    window.addEventListener('vics:header:points-pulse', onPulse)
    return () => window.removeEventListener('vics:header:points-pulse', onPulse)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 backdrop-blur-md border-b transition-colors',
        shellLd
          ? 'border-cyan-500/15 bg-gradient-to-b from-slate-950/[0.97] via-slate-900/94 to-slate-950/90 shadow-[0_1px_0_rgba(34,211,238,0.06)]'
          : 'border-gray-100/80 bg-gradient-to-b from-white/95 via-white/85 to-slate-50/35 shadow-[0_1px_0_rgba(15,23,42,0.04)]',
      )}
    >
      <div className={cn('mx-auto flex h-14 w-full min-w-0 items-center gap-2 px-4', LAYOUT_CONTENT_MAX_WIDTH_CLASS)}>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mr-2 shrink-0 group">
          <Logo size={32} dark={shellLd} link={false} />
          <span
            className={cn(
              'font-black text-lg tracking-tight hidden sm:block',
              shellLd ? 'text-cyan-50' : 'text-[#22282E]',
            )}
          >
            VictorySpace
          </span>
        </Link>

        <nav
          aria-label="주요 메뉴"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2',
            'overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x scrollbar-hide',
            'lg:justify-end lg:overflow-visible',
          )}
        >
        {/* 매치업목록 — 민트·라임 MZ */}
        <Link
          to="/matchups"
          className={cn(
            'flex-shrink-0 touch-manipulation rounded-2xl border px-3 py-2.5 text-xs font-black transition-all duration-300 sm:py-2 sm:text-sm whitespace-nowrap',
            shellLd
              ? location.pathname === '/matchups'
                ? 'border-cyan-400/50 bg-gradient-to-br from-cyan-500 via-teal-600 to-slate-900 text-cyan-50 shadow-[0_4px_18px_-4px_rgba(34,211,238,0.35)] ring-1 ring-cyan-200/25'
                : 'border-slate-600/80 bg-slate-900/70 text-cyan-100/90 hover:border-cyan-500/40 hover:bg-slate-800/80 hover:shadow-md hover:shadow-cyan-900/30 active:scale-[0.98]'
              : location.pathname === '/matchups'
                ? 'border-emerald-400/50 bg-gradient-to-br from-lime-300 via-emerald-400 to-teal-500 text-[#0f1f0f] shadow-[0_4px_18px_-4px_rgba(16,185,129,0.45)] ring-1 ring-white/60'
                : 'border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-teal-50/40 text-emerald-800 hover:border-emerald-300 hover:from-emerald-50 hover:to-teal-50 hover:shadow-md hover:shadow-emerald-200/30 active:scale-[0.98]',
          )}
        >
          매치업목록
        </Link>
        {user && showAdminNav && (
          <Link
            to="/admin/dashboard"
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap',
              location.pathname.startsWith('/admin')
                ? 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white shadow-md shadow-slate-300/40'
                : shellLd
                  ? 'border border-slate-600/80 bg-slate-900/60 text-cyan-100/90 hover:bg-slate-800/80'
                  : 'text-slate-700 hover:text-[#22282E] hover:bg-slate-100 border border-slate-200/80',
            )}
            title="관리자 페이지"
          >
            <LayoutDashboard size={15} className="shrink-0 opacity-90" />
            <span className="hidden sm:inline">관리자페이지</span>
            <span className="sm:hidden">관리자</span>
          </Link>
        )}
        {/* Create Button — 네온 그라데이션 CTA */}
        <button
          onClick={handleCreateClick}
          className={cn(
            'hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black transition-all duration-200',
            shellLd
              ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-600 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.45)] hover:shadow-[0_0_28px_rgba(34,211,238,0.55)] hover:scale-[1.03] active:scale-[0.97]'
              : 'bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] shadow-[0_0_16px_rgba(132,204,22,0.4)] hover:shadow-[0_0_26px_rgba(132,204,22,0.65)] hover:scale-[1.03] active:scale-[0.97]',
          )}
        >
          <Plus size={16} strokeWidth={2.5} />
          만들기
        </button>
        {/* 모바일: 아이콘만 */}
        <button
          onClick={handleCreateClick}
          className={cn(
            'flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl transition-all sm:hidden',
            shellLd
              ? 'bg-gradient-to-br from-cyan-400 to-emerald-600 text-white shadow-[0_0_14px_rgba(34,211,238,0.5)] hover:scale-105 active:scale-95'
              : 'bg-gradient-to-br from-lime-400 to-emerald-400 text-white shadow-[0_0_12px_rgba(132,204,22,0.5)] hover:scale-105 active:scale-95',
          )}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        {/* 검색 — 스카이·시안 MZ */}
        <div className="relative">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="카테고리&매치업 검색..."
                className={cn(
                  'w-40 sm:w-52 px-3 py-1.5 text-sm rounded-2xl outline-none transition-all border-2',
                  shellLd
                    ? 'border-cyan-500/40 bg-slate-900/90 text-cyan-50 placeholder:text-cyan-400/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25'
                    : 'border-sky-200/80 bg-white text-[#22282E] placeholder:text-sky-400/80 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30',
                )}
              />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className={cn(
                'flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-2xl border p-2 transition-colors',
                shellLd
                    ? 'border-slate-600 bg-slate-800 text-cyan-200 hover:bg-slate-700'
                    : 'border-sky-200/60 bg-sky-50/80 text-sky-500 hover:bg-sky-100 hover:text-sky-700',
                )}
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="검색"
              className={cn(
                'flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-2xl border p-2 transition-all duration-300',
                shellLd
                  ? 'border-slate-600/90 bg-slate-900/70 text-cyan-200 shadow-sm shadow-black/30 hover:border-cyan-500/40 hover:bg-slate-800/90 active:scale-95'
                  : 'border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-cyan-50/50 text-sky-600 shadow-sm shadow-sky-200/20 hover:border-sky-300 hover:from-sky-100/80 hover:to-cyan-50 hover:text-sky-700 hover:shadow-md active:scale-95',
              )}
            >
              <Search size={18} strokeWidth={2.25} />
            </button>
          )}
        </div>

        {/* Icons */}
        {user ? (
          <>
            <Link
              to="/rewards"
              title="보유 포인트 · 리워드 센터"
              className={cn(
                'hidden sm:inline-flex shrink-0 items-center gap-1 rounded-2xl border px-2.5 py-1.5 text-[11px] font-black transition-all duration-300 sm:text-xs',
                shellLd
                  ? 'border-amber-500/35 bg-slate-900/75 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.15)] hover:border-amber-400/45 hover:shadow-[0_0_18px_rgba(251,191,36,0.22)] active:scale-[0.98]'
                  : 'border-amber-300/80 bg-gradient-to-r from-amber-100/95 via-yellow-50 to-amber-50/90 text-amber-950 shadow-[0_0_14px_rgba(251,191,36,0.28)] hover:border-amber-400 hover:shadow-[0_0_20px_rgba(251,191,36,0.42)] active:scale-[0.98]',
                (location.pathname === '/rewards' || location.pathname.startsWith('/rewards/')) &&
                  (shellLd ? 'ring-2 ring-amber-400/40' : 'ring-2 ring-amber-400/50'),
                pointsPulse && 'vics-header-points-pulse ring-2 ring-amber-400/70',
              )}
            >
              <Coins size={15} className={cn('shrink-0', shellLd ? 'text-amber-300' : 'text-amber-600')} strokeWidth={2.4} />
              <span
                className={cn(
                  'tabular-nums',
                  shellLd
                    ? 'bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-100 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-amber-700 via-orange-600 to-amber-800 bg-clip-text text-transparent',
                )}
              >
                {Number(profile?.points || 0).toLocaleString('ko-KR')}P
              </span>
            </Link>
            <Link
              to="/fandom"
              title="내 팬덤 · F-Point"
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-2xl border px-2 py-1.5 text-[10px] font-black transition-all duration-300 sm:gap-1 sm:px-2.5 sm:text-[11px]',
                shellLd
                  ? location.pathname === '/fandom'
                    ? 'border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-600 via-purple-700 to-slate-950 text-fuchsia-50 shadow-md ring-1 ring-fuchsia-300/25'
                    : 'border-slate-600/80 bg-slate-900/70 text-fuchsia-100/95 hover:border-fuchsia-500/35 hover:bg-slate-800/80 active:scale-[0.98]'
                  : location.pathname === '/fandom'
                    ? 'border-rose-400/55 bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-600 text-white shadow-md shadow-rose-200/50 ring-1 ring-white/40'
                    : 'border-rose-200/70 bg-gradient-to-br from-rose-50/95 to-pink-50/70 text-rose-950 shadow-sm hover:border-rose-300 hover:shadow-md active:scale-[0.98]',
              )}
            >
              <Heart
                size={14}
                className={cn(
                  'shrink-0',
                  shellLd
                    ? location.pathname === '/fandom'
                      ? 'text-fuchsia-100'
                      : 'text-fuchsia-300'
                    : location.pathname === '/fandom'
                      ? 'text-white'
                      : 'text-rose-500',
                )}
                fill="currentColor"
              />
              <span
                className={cn(
                  'tabular-nums',
                  shellLd
                    ? location.pathname === '/fandom'
                      ? 'text-fuchsia-50'
                      : 'text-fuchsia-100/90'
                    : location.pathname === '/fandom'
                      ? 'text-white'
                      : 'text-rose-950',
                )}
              >
                {Number(profile?.fandom_points ?? 0).toLocaleString('ko-KR')}
              </span>
              <span
                className={cn(
                  'hidden sm:inline',
                  shellLd ? (location.pathname === '/fandom' ? 'text-fuchsia-100' : 'text-fuchsia-200/80') : location.pathname === '/fandom' && 'text-white',
                )}
              >
                FP
              </span>
            </Link>
            {/* 알림 벨 */}
            <div className="relative">
            <button
              type="button"
              onClick={handleBellClick}
              title="알림"
              className={cn(
                'relative flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border transition-all duration-300',
                shellLd
                  ? isNotificationPanelOpen
                    ? 'border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-600 via-purple-700 to-slate-950 text-fuchsia-50 shadow-[0_4px_16px_-4px_rgba(192,132,252,0.35)] ring-1 ring-fuchsia-300/25'
                    : 'border-slate-600/80 bg-slate-900/70 text-fuchsia-200/90 hover:border-fuchsia-500/35 hover:bg-slate-800/80 active:scale-95'
                  : isNotificationPanelOpen
                    ? 'border-rose-400/55 bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-500 text-white shadow-[0_4px_16px_-4px_rgba(244,114,182,0.45)] ring-1 ring-white/45'
                    : 'border-rose-200/60 bg-gradient-to-br from-rose-50/90 to-pink-50/40 text-rose-600 shadow-sm shadow-rose-200/25 hover:border-rose-300 hover:from-rose-50 hover:to-pink-50 hover:text-rose-700 hover:shadow-md active:scale-95',
              )}
            >
                <Bell size={18} strokeWidth={2.25} />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full leading-none">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </button>
            </div>

            <Link
              to="/ranking"
              title="랭킹"
              className={cn(
                'flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border transition-all duration-300',
                shellLd
                  ? location.pathname === '/ranking'
                    ? 'border-amber-400/45 bg-gradient-to-br from-amber-500 via-orange-600 to-slate-950 text-amber-50 shadow-[0_4px_16px_-4px_rgba(245,158,11,0.3)] ring-1 ring-amber-200/20'
                    : 'border-slate-600/80 bg-slate-900/70 text-amber-200/90 hover:border-amber-500/35 hover:bg-slate-800/80 active:scale-95'
                  : location.pathname === '/ranking'
                    ? 'border-amber-400/50 bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 text-white shadow-[0_4px_16px_-4px_rgba(245,158,11,0.45)] ring-1 ring-white/45'
                    : 'border-amber-200/65 bg-gradient-to-br from-amber-50/90 to-yellow-50/35 text-amber-700 shadow-sm shadow-amber-200/25 hover:border-amber-300 hover:from-amber-50 hover:to-yellow-50 hover:text-amber-900 hover:shadow-md active:scale-95',
              )}
            >
              <Trophy size={18} strokeWidth={2.25} />
            </Link>

            {/* 공지사항 — 바이올렛·인디고 MZ */}
            <Link
              to="/notice"
              title="공지사항"
              className={cn(
                'flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border transition-all duration-300',
                shellLd
                  ? isNoticeActive
                    ? 'border-violet-400/45 bg-gradient-to-br from-indigo-600 via-violet-700 to-slate-950 text-violet-50 shadow-[0_4px_16px_-4px_rgba(139,92,246,0.32)] ring-1 ring-violet-300/20'
                    : 'border-slate-600/80 bg-slate-900/70 text-violet-200/90 hover:border-violet-500/35 hover:bg-slate-800/80 active:scale-95'
                  : isNoticeActive
                    ? 'border-violet-400/50 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-[0_4px_16px_-4px_rgba(139,92,246,0.4)] ring-1 ring-white/45'
                    : 'border-violet-200/65 bg-gradient-to-br from-violet-50/90 to-indigo-50/35 text-violet-700 shadow-sm shadow-violet-200/25 hover:border-violet-300 hover:from-violet-50 hover:to-indigo-50 hover:text-violet-900 hover:shadow-md active:scale-95',
              )}
            >
              <Megaphone size={18} strokeWidth={2.25} />
            </Link>

            {/* 프로필 메뉴 — 드롭다운은 portal로 렌더(헤더 backdrop-blur와 분리) */}
            <div className="relative" ref={profileMenuAnchorRef}>
              <button
                type="button"
                onClick={() => { setProfileMenuOpen(!profileMenuOpen); closeNotificationPanel() }}
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full p-0.5 transition-all hover:ring-2 hover:ring-pink-300/70"
              >
                <Avatar
                  src={profile?.avatar_url}
                  alt={profile?.nickname || user.email}
                  size="sm"
                />
              </button>
              {profileMenuOpen &&
                profileMenuPos &&
                createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[140]"
                      aria-hidden
                      onClick={() => { setProfileMenuOpen(false); closeNotificationPanel() }}
                    />
                    <div
                      className="fixed z-[150] w-44 overflow-hidden rounded-2xl border border-pink-200 bg-white text-[#22282E] shadow-[0_16px_48px_-12px_rgba(15,23,42,0.25)]"
                      style={{ top: profileMenuPos.top, right: profileMenuPos.right }}
                      role="menu"
                    >
                      <div className="border-b border-pink-100 bg-[#fff5f7] px-4 py-3">
                        <p className="truncate text-sm font-bold text-fuchsia-950">
                          {profile?.nickname || '사용자'}
                        </p>
                        <p className="truncate text-xs text-fuchsia-800/70">{user.email}</p>
                      </div>
                      <Link
                        to="/mypage"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-fuchsia-900/90 transition-colors hover:bg-fuchsia-50"
                      >
                        <User size={15} className="shrink-0 text-fuchsia-500" />
                        마이페이지
                      </Link>
                      <Link
                        to="/inquiry/history"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-fuchsia-900/90 transition-colors hover:bg-fuchsia-50"
                      >
                        <FileText size={15} className="shrink-0 text-fuchsia-400" />
                        내 문의 내역 보기
                      </Link>
                      <Link
                        to="/landing"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50"
                      >
                        <Sparkles size={15} className="shrink-0 text-violet-500" />
                        서비스 소개
                      </Link>
                      {showAdminNav && (
                        <Link
                          to="/admin/dashboard"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                        >
                          <Settings size={15} className="shrink-0 text-emerald-600" />
                          관리자 페이지
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => { signOut(); setProfileMenuOpen(false) }}
                        className="flex w-full items-center gap-2 border-t border-pink-100 px-4 py-2.5 text-left text-sm text-fuchsia-900/85 transition-colors hover:bg-rose-50"
                      >
                        <LogIn size={15} className="shrink-0 text-rose-400" />
                        로그아웃
                      </button>
                    </div>
                  </>,
                  document.body,
                )}
            </div>
          </>
        ) : (
          <>
            {/* 랭킹 (비로그인도 접근 가능) */}
            <Link
              to="/ranking"
              title="랭킹"
              className={cn(
                'flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border transition-all duration-300',
                location.pathname === '/ranking'
                  ? 'border-amber-400/50 bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 text-white shadow-[0_4px_16px_-4px_rgba(245,158,11,0.45)] ring-1 ring-white/45'
                  : 'border-amber-200/65 bg-gradient-to-br from-amber-50/90 to-yellow-50/35 text-amber-700 shadow-sm shadow-amber-200/25 hover:border-amber-300 hover:from-amber-50 hover:to-yellow-50 hover:text-amber-900 hover:shadow-md active:scale-95'
              )}
            >
              <Trophy size={18} strokeWidth={2.25} />
            </Link>
            {/* 공지사항 (비로그인도 접근 가능) */}
            <Link
              to="/notice"
              title="공지사항"
              className={cn(
                'flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border transition-all duration-300',
                isNoticeActive
                  ? 'border-violet-400/50 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-[0_4px_16px_-4px_rgba(139,92,246,0.4)] ring-1 ring-white/45'
                  : 'border-violet-200/65 bg-gradient-to-br from-violet-50/90 to-indigo-50/35 text-violet-700 shadow-sm shadow-violet-200/25 hover:border-violet-300 hover:from-violet-50 hover:to-indigo-50 hover:text-violet-900 hover:shadow-md active:scale-95'
              )}
            >
              <Megaphone size={18} strokeWidth={2.25} />
            </Link>
            {/* 탐색 (비로그인도 접근 가능) */}
            <Link
              to="/explore"
              title="탐색"
              className={cn(
                'flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border transition-all duration-300',
                (location.pathname === '/explore' || location.pathname.startsWith('/feed/'))
                  ? 'border-sky-400/50 bg-gradient-to-br from-sky-400 via-cyan-400 to-teal-500 text-white shadow-[0_4px_16px_-4px_rgba(14,165,233,0.4)] ring-1 ring-white/45'
                  : 'border-sky-200/65 bg-gradient-to-br from-sky-50/90 to-cyan-50/35 text-sky-700 shadow-sm shadow-sky-200/25 hover:border-sky-300 hover:from-sky-50 hover:to-cyan-50 hover:text-sky-900 hover:shadow-md active:scale-95'
              )}
            >
              <Compass size={18} strokeWidth={2.25} />
            </Link>
            {/* 모바일 전용: 서비스 소개 아이콘 버튼 */}
            <Link
              to="/landing"
              className="md:hidden flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl p-2 text-violet-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
              title="서비스 소개"
            >
              <Sparkles size={18} />
            </Link>
            <button
              type="button"
              onClick={openLoginModal}
              className={cn(
                'flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-sm font-black transition-all duration-300',
                'border-indigo-200/75 bg-gradient-to-br from-indigo-50/95 via-white to-sky-50/60 text-indigo-700',
                'shadow-sm shadow-indigo-200/30 hover:border-indigo-300/90 hover:from-indigo-100/80 hover:via-white hover:to-sky-100/50 hover:text-indigo-900 hover:shadow-md hover:shadow-indigo-200/40 active:scale-[0.98]'
              )}
            >
              <LogIn size={16} strokeWidth={2.25} className="text-indigo-500 shrink-0" />
              <span className="hidden sm:inline">로그인</span>
            </button>
            <Link
              to="/signup"
              className="flex min-h-11 touch-manipulation items-center gap-1.5 rounded-xl bg-[#22282E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#363d46]"
            >
              <UserPlus size={16} />
              <span className="hidden sm:block">회원가입</span>
            </Link>
          </>
        )}
        </nav>
      </div>
    </header>
  )
}
