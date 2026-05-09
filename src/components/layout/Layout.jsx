import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, Home, List, Plus, Trophy, User, Compass, Megaphone, Gift } from 'lucide-react'
import { Header } from './Header'
import { Footer } from './Footer'
import { Toast } from '../ui/Toast'
import { PopupNoticeDisplay } from '../notice/PopupNoticeDisplay'
import { NotificationPanel } from '../ui/NotificationPanel'
import { WelcomeBackOverlay } from '../ui/WelcomeBackOverlay'
import { FandomMilestoneGate } from '../fandom/FandomMilestoneGate'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { setLastPathBeforeLogin } from '../../lib/loginReturn'
import { useNotificationStore } from '../../store/notificationStore'
import { cn } from '../../lib/utils'
import { isLegendDiamondShellActive } from '../../lib/legendDiamondUiTheme'

export function Layout({ children }) {
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const legendDiamondShell = Boolean(user && isLegendDiamondShellActive(profile))

  useEffect(() => {
    if (user) return
    const p = location.pathname
    if (p === '/login' || p === '/signup') return
    setLastPathBeforeLogin(`${location.pathname}${location.search}${location.hash}`)
  }, [user, location.pathname, location.search, location.hash])

  const isAdmin = location.pathname.startsWith('/admin')
  const isRestricted = location.pathname === '/restricted' || location.pathname.startsWith('/restricted')
  const isMainPage = location.pathname === '/' || location.pathname.startsWith('/feed/')
  const isMatchupsPage = location.pathname === '/matchups'
  const isRankingPage = location.pathname === '/ranking'
  const isRewardsPage = location.pathname === '/rewards' || location.pathname.startsWith('/rewards/')
  const isFandomPage = location.pathname === '/fandom'
  if (isAdmin) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gray-100">
        {children}
        <Toast />
        <NotificationPanelOverlay />
      </div>
    )
  }

  if (isRestricted) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-gray-50 via-white to-slate-100/50">
        {children}
        <Toast />
      </div>
    )
  }

  return (
    <div
      data-vics-shell={legendDiamondShell ? 'legend-diamond' : undefined}
      className={cn(
        'min-h-screen overflow-x-hidden',
        legendDiamondShell
          ? 'vics-shell-legend-diamond-root'
          : cn(
              isMainPage &&
                'bg-gradient-to-br from-slate-50 via-white/90 to-emerald-50/45',
              !isMainPage &&
                (isMatchupsPage || isRankingPage || isRewardsPage || isFandomPage) &&
                'bg-gradient-to-br from-violet-100/95 via-fuchsia-50/80 to-teal-50/70',
              !isMainPage &&
                !isMatchupsPage &&
                !isRankingPage &&
                !isRewardsPage &&
                !isFandomPage &&
                'bg-gradient-to-b from-gray-50/90 via-white to-slate-100/40',
            ),
      )}
    >
      <Header />
      <main className="w-full min-w-0 max-w-screen-lg mx-auto px-4 pt-6 pb-24 lg:pb-6">
        {children}
      </main>
      <Footer />
      <Toast />
      <PopupNoticeDisplay />
      <BottomNav legendDiamondShell={legendDiamondShell} />
      <NotificationPanelOverlay />
      <WelcomeBackOverlay />
      <FandomMilestoneGate />
    </div>
  )
}

function NotificationPanelOverlay() {
  const isOpen = useUIStore((s) => s.isNotificationPanelOpen)
  const closeNotificationPanel = useUIStore((s) => s.closeNotificationPanel)
  if (!isOpen) return null
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
        onClick={closeNotificationPanel}
        aria-hidden
      />
      <div className="fixed right-4 top-14 z-50 sm:right-4 sm:top-14">
        <NotificationPanel onClose={closeNotificationPanel} />
      </div>
    </>
  )
}

/** 하단 탭별 액센트 — 활성은 풀 그라데이션, 비활성은 같은 계열 파스텔 틴트 */
const NAV_ACCENTS = {
  home: {
    active: 'bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-lg shadow-sky-400/30 ring-1 ring-white/25',
    label: 'text-sky-700',
    inactive:
      'bg-gradient-to-br from-sky-50/98 to-indigo-50/90 border border-sky-200/50 shadow-sm shadow-sky-100/40 hover:from-sky-100/95 hover:to-blue-50/90',
    iconInactive: 'text-sky-600/80 group-hover:text-sky-700',
    labelInactive: 'text-sky-600/65 group-hover:text-sky-800',
  },
  ranking: {
    active: 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 shadow-lg shadow-amber-400/30 ring-1 ring-white/25',
    label: 'text-amber-800',
    inactive:
      'bg-gradient-to-br from-amber-50/98 to-orange-50/90 border border-amber-200/50 shadow-sm shadow-amber-100/40 hover:from-amber-100/95 hover:to-orange-50/90',
    iconInactive: 'text-amber-700/80 group-hover:text-amber-800',
    labelInactive: 'text-amber-700/65 group-hover:text-amber-900',
  },
  notice: {
    active: 'bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 shadow-lg shadow-violet-400/35 ring-1 ring-white/25',
    label: 'text-violet-700',
    inactive:
      'bg-gradient-to-br from-violet-50/98 to-fuchsia-50/90 border border-violet-200/45 shadow-sm shadow-violet-100/40 hover:from-violet-100/95 hover:to-purple-50/90',
    iconInactive: 'text-violet-600/80 group-hover:text-violet-800',
    labelInactive: 'text-violet-600/65 group-hover:text-violet-800',
  },
  matchups: {
    active: 'bg-gradient-to-br from-rose-400 via-pink-500 to-rose-700 shadow-lg shadow-rose-400/30 ring-1 ring-white/25',
    label: 'text-rose-700',
    inactive:
      'bg-gradient-to-br from-rose-50/98 to-pink-50/90 border border-rose-200/45 shadow-sm shadow-rose-100/40 hover:from-rose-100/95 hover:to-pink-50/90',
    iconInactive: 'text-rose-600/80 group-hover:text-rose-800',
    labelInactive: 'text-rose-600/65 group-hover:text-rose-800',
  },
  explore: {
    active: 'bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-700 shadow-lg shadow-cyan-400/30 ring-1 ring-white/25',
    label: 'text-teal-800',
    inactive:
      'bg-gradient-to-br from-cyan-50/98 to-emerald-50/90 border border-teal-200/45 shadow-sm shadow-cyan-100/40 hover:from-cyan-100/95 hover:to-teal-50/90',
    iconInactive: 'text-teal-600/80 group-hover:text-teal-800',
    labelInactive: 'text-teal-600/65 group-hover:text-teal-900',
  },
  create: {
    fab: 'bg-gradient-to-br from-lime-400 via-emerald-400 to-teal-500 shadow-lg shadow-emerald-200/70 ring-2 ring-white/40',
    label: 'text-emerald-700',
  },
  bell: {
    active: 'bg-gradient-to-br from-orange-400 via-amber-500 to-red-500 shadow-lg shadow-orange-400/35 ring-1 ring-white/25',
    label: 'text-orange-700',
    inactive:
      'bg-gradient-to-br from-orange-50/98 to-amber-50/90 border border-orange-200/45 shadow-sm shadow-orange-100/40 hover:from-orange-100/95 hover:to-amber-50/90',
    iconInactive: 'text-orange-600/85 group-hover:text-orange-800',
    labelInactive: 'text-orange-600/65 group-hover:text-orange-800',
  },
  my: {
    active: 'bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-800 shadow-lg shadow-indigo-400/35 ring-1 ring-white/25',
    label: 'text-indigo-800',
    inactive:
      'bg-gradient-to-br from-indigo-50/98 to-violet-50/90 border border-indigo-200/45 shadow-sm shadow-indigo-100/40 hover:from-indigo-100/95 hover:to-violet-50/90',
    iconInactive: 'text-indigo-600/80 group-hover:text-indigo-800',
    labelInactive: 'text-indigo-600/65 group-hover:text-indigo-900',
  },
  rewards: {
    active: 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 shadow-lg shadow-emerald-400/30 ring-1 ring-white/25',
    label: 'text-emerald-800',
    inactive:
      'bg-gradient-to-br from-emerald-50/98 to-teal-50/90 border border-emerald-200/50 shadow-sm shadow-emerald-100/40 hover:from-emerald-100/95 hover:to-teal-50/90',
    iconInactive: 'text-emerald-600/80 group-hover:text-emerald-800',
    labelInactive: 'text-emerald-600/65 group-hover:text-emerald-900',
  },
}

/** 레전드 다이아 셸 — 하단 탭 다크 글래스 */
const NAV_ACCENTS_LD = {
  home: {
    active:
      'bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-700 shadow-lg shadow-cyan-500/35 ring-1 ring-cyan-200/30',
    label: 'text-cyan-50',
    inactive:
      'border border-cyan-900/50 bg-slate-900/55 shadow-sm shadow-black/30 hover:border-cyan-600/40 hover:bg-slate-800/70',
    iconInactive: 'text-cyan-200/75 group-hover:text-cyan-100',
    labelInactive: 'text-slate-400 group-hover:text-cyan-100/90',
  },
  ranking: {
    active:
      'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-700 shadow-lg shadow-amber-500/35 ring-1 ring-amber-200/25',
    label: 'text-amber-50',
    inactive:
      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-amber-700/50 hover:bg-slate-800/70',
    iconInactive: 'text-amber-200/70 group-hover:text-amber-100',
    labelInactive: 'text-slate-400 group-hover:text-amber-100/85',
  },
  notice: {
    active:
      'bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700 shadow-lg shadow-violet-500/35 ring-1 ring-white/20',
    label: 'text-violet-50',
    inactive:
      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-violet-600/45 hover:bg-slate-800/70',
    iconInactive: 'text-violet-200/75 group-hover:text-violet-100',
    labelInactive: 'text-slate-400 group-hover:text-violet-100/90',
  },
  matchups: {
    active:
      'bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-800 shadow-lg shadow-rose-500/35 ring-1 ring-white/20',
    label: 'text-rose-50',
    inactive:
      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-rose-600/45 hover:bg-slate-800/70',
    iconInactive: 'text-rose-200/75 group-hover:text-rose-100',
    labelInactive: 'text-slate-400 group-hover:text-rose-100/90',
  },
  explore: {
    active:
      'bg-gradient-to-br from-teal-400 via-cyan-500 to-emerald-800 shadow-lg shadow-teal-500/35 ring-1 ring-white/20',
    label: 'text-teal-50',
    inactive:
      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-teal-600/45 hover:bg-slate-800/70',
    iconInactive: 'text-teal-200/75 group-hover:text-teal-100',
    labelInactive: 'text-slate-400 group-hover:text-teal-100/90',
  },
  create: {
    fab: 'bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-600 shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-200/35',
    label: 'text-cyan-100',
  },
  bell: {
    active:
      'bg-gradient-to-br from-orange-400 via-amber-500 to-rose-600 shadow-lg shadow-orange-500/35 ring-1 ring-white/20',
    label: 'text-orange-50',
    inactive:
      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-orange-600/45 hover:bg-slate-800/70',
    iconInactive: 'text-orange-200/75 group-hover:text-orange-100',
    labelInactive: 'text-slate-400 group-hover:text-orange-100/90',
  },
  my: {
    active:
      'bg-gradient-to-br from-indigo-500 via-violet-600 to-slate-900 shadow-lg shadow-indigo-500/35 ring-1 ring-white/20',
    label: 'text-indigo-50',
    inactive:
      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-indigo-600/45 hover:bg-slate-800/70',
    iconInactive: 'text-indigo-200/75 group-hover:text-indigo-100',
    labelInactive: 'text-slate-400 group-hover:text-indigo-100/90',
  },
  rewards: {
    active:
      'bg-gradient-to-br from-emerald-400 via-teal-500 to-green-700 shadow-lg shadow-emerald-500/35 ring-1 ring-white/20',
    label: 'text-emerald-50',
    inactive:
      'border border-slate-700/80 bg-slate-900/55 shadow-sm hover:border-emerald-600/45 hover:bg-slate-800/70',
    iconInactive: 'text-emerald-200/75 group-hover:text-emerald-100',
    labelInactive: 'text-slate-400 group-hover:text-emerald-100/90',
  },
}

// ── 모바일 하단 내비게이션 바 ─────────────────────────────────────
function BottomNav({ legendDiamondShell = false }) {
  const location  = useLocation()
  const { user }  = useAuthStore()
  const { openCreateDrawer, openLoginModal, openNotificationPanel, isNotificationPanelOpen } = useUIStore()
  const { unreadCount } = useNotificationStore()
  const totalUnread = unreadCount

  const handleCreate = () => {
    if (!user) { openLoginModal(); return }
    openCreateDrawer()
  }

  const navAcc = legendDiamondShell ? NAV_ACCENTS_LD : NAV_ACCENTS
  const isActive = (path) => location.pathname === path
  const bellOn = user && isNotificationPanelOpen

  return (
    <nav
      className={cn('fixed bottom-0 left-0 right-0 z-40 lg:hidden', legendDiamondShell && 'vics-bottomnav-legend-diamond')}
      aria-label="하단 메뉴"
    >
      {/* 글래스 + 살짝 채도 있는 상단 라인 */}
      <div
        className={cn(
          'vics-bottomnav-legend-diamond__bg absolute inset-0 backdrop-blur-xl',
          legendDiamondShell
            ? 'border-t'
            : 'border-t border-white/70 bg-gradient-to-b from-white/[0.97] via-slate-50/90 to-slate-100/80 shadow-[0_-8px_32px_rgba(15,23,42,0.08)]',
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px',
          legendDiamondShell
            ? 'vics-bottomnav-legend-diamond__hairline'
            : 'bg-gradient-to-r from-sky-300/40 via-violet-300/35 to-teal-300/40',
        )}
      />

      <div className="relative flex items-end justify-between gap-0.5 h-16 px-1 w-full max-w-screen-lg mx-auto min-w-0">
        <NavItem
          to="/"
          icon={Home}
          label="홈"
          active={isActive('/')}
          accent={navAcc.home}
        />

        <NavItem
          to="/matchups"
          icon={List}
          label="매치업"
          active={isActive('/matchups')}
          accent={navAcc.matchups}
        />

        <NavItem
          to="/ranking"
          icon={Trophy}
          label="랭킹"
          active={isActive('/ranking')}
          accent={navAcc.ranking}
        />

        <NavItem
          to="/rewards"
          icon={Gift}
          label="리워드"
          active={isActive('/rewards')}
          accent={navAcc.rewards}
        />

        <button
          type="button"
          onClick={handleCreate}
          className="flex flex-1 min-w-0 flex-col items-center justify-end gap-0.5 -mt-4"
        >
          <div
            className={cn(
              'w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shrink-0',
              navAcc.create.fab
            )}
          >
            <Plus size={24} className="text-white stroke-[2.5] drop-shadow-sm" />
          </div>
          <span className={cn('text-[8px] sm:text-[9px] font-black pb-1', navAcc.create.label)}>만들기</span>
        </button>

        <NavItem
          to="/notice"
          icon={Megaphone}
          label="공지"
          active={isActive('/notice')}
          accent={navAcc.notice}
        />

        <button
          type="button"
          onClick={() => !user ? openLoginModal() : openNotificationPanel()}
          className="flex flex-1 min-w-0 flex-col items-center justify-end gap-0.5 py-2 px-1 relative group"
        >
          <div
            className={cn(
              'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 relative shrink-0 group-hover:scale-105 group-active:scale-95',
              bellOn ? navAcc.bell.active : navAcc.bell.inactive
            )}
          >
            <Bell size={18} className={bellOn ? 'text-white drop-shadow-sm' : navAcc.bell.iconInactive} />
            {user && totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full leading-none ring-2 ring-white">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <span
            className={cn(
              'text-[8px] sm:text-[9px] font-bold',
              bellOn ? navAcc.bell.label : navAcc.bell.labelInactive
            )}
          >
            알림
          </span>
        </button>

        <button
          type="button"
          onClick={() => !user ? openLoginModal() : null}
          className="flex flex-1 min-w-0 flex-col items-center justify-end gap-0.5 py-2 px-1 relative group"
        >
          {user ? (
            <Link to="/mypage" className="flex flex-1 min-w-0 flex-col items-center justify-end gap-0.5">
              <div
                className={cn(
                  'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 shrink-0 group-hover:scale-105 group-active:scale-95',
                  isActive('/mypage') ? navAcc.my.active : navAcc.my.inactive
                )}
              >
                <User size={18} className={isActive('/mypage') ? 'text-white drop-shadow-sm' : navAcc.my.iconInactive} />
              </div>
              <span
                className={cn(
                  'text-[8px] sm:text-[9px] font-bold',
                  isActive('/mypage') ? navAcc.my.label : navAcc.my.labelInactive
                )}
              >
                마이
              </span>
            </Link>
          ) : (
            <>
              <div
                className={cn(
                  'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105 group-active:scale-95 shrink-0',
                  navAcc.my.inactive
                )}
              >
                <User size={18} className={navAcc.my.iconInactive} />
              </div>
              <span className={cn('text-[9px] font-bold', navAcc.my.labelInactive)}>마이</span>
            </>
          )}
        </button>

      </div>

      <div
        className={cn(
          'h-safe-area-inset-bottom',
          legendDiamondShell
            ? 'vics-bottomnav-legend-diamond__safe'
            : 'bg-gradient-to-b from-slate-50/90 to-slate-100/90',
        )}
      />
    </nav>
  )
}

function NavItem({ to, icon: Icon, label, active, accent }) {
  return (
    <Link
      to={to}
      className="flex flex-1 min-w-0 flex-col items-center justify-end gap-0.5 py-2 px-1 group"
    >
      <div
        className={cn(
          'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all duration-200 shrink-0 group-hover:scale-105 group-active:scale-95',
          active ? accent.active : accent.inactive
        )}
      >
        <Icon
          size={18}
          className={cn('transition-colors', active ? 'text-white drop-shadow-sm' : accent.iconInactive)}
        />
      </div>
      <span
        className={cn(
          'text-[8px] sm:text-[9px] font-bold transition-colors',
          active ? accent.label : accent.labelInactive
        )}
      >
        {label}
      </span>
    </Link>
  )
}

