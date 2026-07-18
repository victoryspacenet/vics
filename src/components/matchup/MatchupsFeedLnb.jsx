import { useEffect, useMemo, useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { getFeedCategoryNavItems } from '../../lib/categoryAdminStorage'
import { cn } from '../../lib/utils'

export const MATCHUPS_FEED_FILTERS = [
  { id: 'active', label: '투표진행중 매치업' },
  { id: 'completed', label: '투표완료 매치업' },
  { id: 'mine', label: '내 매치업' },
]

export const MATCHUPS_CAT_STORAGE_KEY = 'vics_matchups_feed_category'
export const MATCHUPS_CAT_URL_PARAM = 'cat'
export const MATCHUPS_TAG_URL_PARAM = 'tag'
export const VALID_MATCHUPS_FEED_FILTERS = ['active', 'completed', 'mine']

export const MATCHUPS_FEED_LNB_SHELL_CLASS =
  'rounded-2xl border border-fuchsia-100/70 bg-gradient-to-b from-white via-fuchsia-50/30 to-pink-50/20 shadow-[0_4px_24px_-8px_rgba(217,70,239,0.12)]'

const LNB_ROW_ON =
  'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 text-white font-black shadow-[0_4px_14px_-2px_rgba(168,85,247,0.4)] ring-1 ring-white/30'
const LNB_ROW_OFF =
  'text-fuchsia-800/80 hover:text-fuchsia-900 hover:bg-fuchsia-50/80 hover:shadow-sm'

export function readInitialMatchupsFeedCategory() {
  if (typeof window === 'undefined') return 'all'
  try {
    const items = getFeedCategoryNavItems()
    const ids = new Set(items.map((c) => c.id))
    const params = new URLSearchParams(window.location.search)
    const urlCat = params.get(MATCHUPS_CAT_URL_PARAM)
    let stored = ''
    try {
      stored = sessionStorage.getItem(MATCHUPS_CAT_STORAGE_KEY) || ''
    } catch {
      void 0
    }
    const candidate = urlCat || stored
    if (candidate && candidate !== 'all' && ids.has(candidate)) return candidate
  } catch {
    void 0
  }
  return 'all'
}

export function buildMatchupsListUrl({ filter = 'active', category = 'all', tag = null } = {}) {
  const params = new URLSearchParams()
  params.set('filter', filter || 'active')
  if (category && category !== 'all') params.set(MATCHUPS_CAT_URL_PARAM, category)
  const tagToken = String(tag ?? '').trim()
  if (tagToken) params.set(MATCHUPS_TAG_URL_PARAM, tagToken)
  return `/matchups?${params.toString()}`
}

export function useMatchupsFeedCategories() {
  const [catNavTick, setCatNavTick] = useState(0)

  useEffect(() => {
    const bump = () => setCatNavTick((t) => t + 1)
    window.addEventListener('vics_categories_changed', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener('vics_categories_changed', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const feedCategories = useMemo(() => {
    void catNavTick
    try {
      return getFeedCategoryNavItems()
    } catch {
      return [{ id: 'all', icon: '✨', label: '전체 매치' }]
    }
  }, [catNavTick])

  return feedCategories
}

export function MatchupsFeedLnbContent({
  category,
  filter,
  feedCategories,
  user,
  onCategoryChange,
  onFilterChange,
  onCreateClick,
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 py-2 mb-1">
        <p className="text-[10px] font-black bg-gradient-to-r from-fuchsia-500 to-violet-500 bg-clip-text text-transparent uppercase tracking-widest">
          🌐 카테고리
        </p>
      </div>
      {feedCategories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onCategoryChange(c.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
            category === c.id ? LNB_ROW_ON : LNB_ROW_OFF
          }`}
          style={
            c.id !== 'all' && c.pointColor && category !== c.id
              ? { borderLeft: `3px solid ${c.pointColor}` }
              : undefined
          }
        >
          {c.id === 'all' && c.icon ? <span>{c.icon}</span> : null}
          {c.id !== 'all' && c.iconImageUrl ? (
            <img src={c.iconImageUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
          ) : null}
          {c.id !== 'all' && !c.iconImageUrl && c.icon ? (
            <span className="shrink-0 text-base leading-none">{c.icon}</span>
          ) : null}
          <span className="min-w-0 truncate">{c.label}</span>
        </button>
      ))}
      <div className="pt-4 mt-4 border-t border-pink-100/60">
        <p className="px-3 py-2 text-[10px] font-black bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent uppercase tracking-widest">
          📍 필터
        </p>
        {MATCHUPS_FEED_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            disabled={f.id === 'mine' && !user}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${
              filter === f.id ? LNB_ROW_ON : LNB_ROW_OFF
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        <button
          type="button"
          onClick={onCreateClick}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] text-sm font-black rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition-all"
        >
          <Plus size={16} strokeWidth={2.5} />
          매치업 생성
        </button>
      </div>
    </div>
  )
}

export function MatchupsFeedLnbDesktopAside(lnbProps) {
  return (
    <aside className="hidden lg:block">
      <div className={`sticky top-24 p-3 ${MATCHUPS_FEED_LNB_SHELL_CLASS}`}>
        <div className="px-3 pt-2 pb-3 mb-2 border-b border-fuchsia-100/60">
          <p className="text-xs font-black bg-gradient-to-r from-fuchsia-600 via-pink-500 to-violet-600 bg-clip-text text-transparent uppercase tracking-widest">
            ⚔️ MATCHUP LIST
          </p>
        </div>
        <MatchupsFeedLnbContent {...lnbProps} />
      </div>
    </aside>
  )
}

export function MatchupsFeedLnbMobileTrigger({
  activeCategoryLabel,
  onOpen,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 rounded-xl border border-fuchsia-200/60 bg-gradient-to-br from-white to-fuchsia-50/80 text-xs font-bold text-fuchsia-800/85 shadow-sm',
        className,
      )}
    >
      <span className="max-w-[38vw] truncate sm:max-w-none" title={activeCategoryLabel}>
        🌐 {activeCategoryLabel}
      </span>
      <ChevronDown size={12} className="shrink-0" />
    </button>
  )
}

export function MatchupsFeedLnbMobileDrawer({ open, onClose, ...lnbProps }) {
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-gradient-to-br from-fuchsia-900/25 via-violet-900/20 to-pink-900/25 backdrop-blur-md backdrop-saturate-150"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed top-0 left-0 bottom-0 z-50 w-[min(18rem,90vw)] max-w-[18rem] shadow-xl shadow-gray-200/40 overflow-y-auto p-4 ${MATCHUPS_FEED_LNB_SHELL_CLASS} rounded-none rounded-r-2xl`}
      >
        <div className="flex justify-between items-center mb-4">
          <p className="font-black bg-gradient-to-r from-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
            🌐 카테고리 & 필터
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-fuchsia-400 hover:bg-fuchsia-50 transition-colors font-bold"
          >
            ✕
          </button>
        </div>
        <MatchupsFeedLnbContent {...lnbProps} />
      </div>
    </>
  )
}

/** 목록·상세 공통 — 데스크탑 LNB + 모바일 드로어 트리거 */
export function MatchupsFeedLnbPageLayout({
  lnbProps,
  mobileOpen,
  onMobileOpenChange,
  activeCategoryLabel,
  children,
  className,
  /** 지정 시 기본 모바일 트리거 대신 사용 (상세 등) */
  mobileToolbar,
}) {
  return (
    <div className={cn('relative', className)}>
      <div className="relative grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
        <MatchupsFeedLnbDesktopAside {...lnbProps} />
        <div className="min-w-0">
          {mobileToolbar ?? (
            <div className="lg:hidden mb-3">
              <MatchupsFeedLnbMobileTrigger
                activeCategoryLabel={activeCategoryLabel}
                onOpen={() => onMobileOpenChange(true)}
              />
            </div>
          )}
          {children}
        </div>
      </div>
      <MatchupsFeedLnbMobileDrawer
        open={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        {...lnbProps}
      />
    </div>
  )
}
