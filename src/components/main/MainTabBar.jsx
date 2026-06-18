import { useLocation } from 'react-router-dom'
import { PrefetchLink } from '../navigation/PrefetchLink'
import { Flame, Sparkles, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'

const FEED_TABS = [
  {
    id: 'best',
    label: '베스트',
    tag: 'TOP',
    icon: Flame,
    path: '/feed/best',
    active:
      'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-[0_6px_24px_-4px_rgba(251,146,60,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ring-[1.5px] ring-white/40',
    idle:
      'border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-orange-50/50 text-amber-800/90 shadow-sm shadow-amber-200/25 hover:border-amber-300 hover:from-amber-50 hover:to-orange-50 hover:shadow-amber-200/40',
    idleIcon: 'bg-amber-100/90 text-amber-600 group-hover:bg-amber-100 group-hover:text-amber-700',
  },
  {
    id: 'hot',
    label: '추천',
    tag: 'PICK',
    icon: Sparkles,
    path: '/feed/hot',
    active:
      'bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_6px_24px_-4px_rgba(168,85,247,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] ring-[1.5px] ring-white/40',
    idle:
      'border-fuchsia-200/75 bg-gradient-to-br from-fuchsia-50/90 to-violet-50/50 text-violet-900/85 shadow-sm shadow-fuchsia-200/25 hover:border-fuchsia-300 hover:from-fuchsia-50 hover:to-violet-50 hover:shadow-fuchsia-200/40',
    idleIcon: 'bg-fuchsia-100/90 text-fuchsia-600 group-hover:bg-fuchsia-100 group-hover:text-fuchsia-700',
  },
  {
    id: 'new',
    label: 'NEW',
    tag: 'FRESH',
    icon: Zap,
    path: '/feed/new',
    active:
      'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 text-white shadow-[0_6px_24px_-4px_rgba(20,184,166,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] ring-[1.5px] ring-white/40',
    idle:
      'border-teal-200/80 bg-gradient-to-br from-emerald-50/90 to-cyan-50/45 text-teal-900/85 shadow-sm shadow-teal-200/25 hover:border-teal-300 hover:from-emerald-50 hover:to-cyan-50 hover:shadow-teal-200/40',
    idleIcon: 'bg-teal-100/90 text-teal-600 group-hover:bg-teal-100 group-hover:text-teal-700',
  },
]

export function MainTabBar({ currentVariant }) {
  const location = useLocation()
  /** 홈(MainPage)에서는 섹션 사이 정적 배치, 개별 피드 페이지에서만 sticky */
  const isSticky = currentVariant !== null

  return (
    <div
      className={cn(
        '-mx-4 px-4 max-lg:touch-manipulation',
        isSticky
          ? 'sticky top-14 z-20 mb-3 py-2'
          : 'relative mb-4 py-3',
      )}
    >
      {/* 글래스 트랙 — 순백·과포화 완화 (메인/피드 눈부심 완화) */}
      <div
        className={cn(
          'mx-auto max-w-lg rounded-[1.75rem] border border-slate-200/55',
          'bg-gradient-to-b from-slate-200/45 via-slate-100/92 to-slate-200/35',
          'shadow-[0_10px_32px_-12px_rgba(100,116,139,0.2),0_4px_14px_-4px_rgba(45,212,191,0.08)]',
          'backdrop-blur-xl backdrop-saturate-110',
          'p-2 lg:p-1.5',
        )}
      >
        <div
          role="tablist"
          aria-label="매치업 피드 종류"
          className="flex items-stretch justify-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x snap-x snap-mandatory pb-0.5 scrollbar-hide lg:gap-1.5 lg:overflow-visible"
        >
          {FEED_TABS.map((tab) => {
            const Icon = tab.icon
            const active =
              currentVariant === tab.id || location.pathname === tab.path

            return (
              <PrefetchLink
                key={tab.id}
                to={tab.path}
                role="tab"
                aria-selected={active}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-[3.25rem] shrink-0 snap-start touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-4 py-3',
                  'min-w-[7.25rem] max-lg:flex-none lg:min-h-0 lg:min-w-0 lg:flex-none lg:px-5 lg:py-2.5',
                  'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100',
                  active
                    ? cn('scale-[1.02] lg:scale-100', tab.active)
                    : cn(
                        'border',
                        'hover:scale-[1.03] active:scale-[0.98]',
                        tab.idle
                      )
                )}
              >
                {/* 비활성일 때 은은한 시머 */}
                {!active && (
                  <span
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-100/40 via-transparent to-slate-50/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden
                  />
                )}

                <span className="relative flex items-center gap-1.5 lg:gap-1.5">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 lg:h-8 lg:w-8',
                      active ? 'bg-white/20 shadow-inner' : cn('group-hover:scale-110', tab.idleIcon)
                    )}
                  >
                    <Icon
                      size={16}
                      strokeWidth={active ? 2.75 : 2.25}
                      className={cn(active ? 'text-white drop-shadow-sm' : '')}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col items-start leading-none">
                    <span
                      className={cn(
                        'text-[13px] sm:text-sm font-black tracking-tight',
                        active ? 'text-white drop-shadow-sm' : 'text-inherit'
                      )}
                    >
                      {tab.label}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 hidden text-[9px] font-bold uppercase tracking-[0.2em] sm:block',
                        active ? 'text-white/85' : 'opacity-70 group-hover:opacity-90'
                      )}
                    >
                      {tab.tag}
                    </span>
                  </span>
                </span>

                {/* 활성 탭 하단 글로우 닷 */}
                {active && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-white/50 blur-[3px]"
                    aria-hidden
                  />
                )}
              </PrefetchLink>
            )
          })}
        </div>

        <p className="mt-2 text-center text-[10px] font-semibold sm:text-[11px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
          지금 뜨는 경쟁을 한눈에 ✨
        </p>
      </div>
    </div>
  )
}
