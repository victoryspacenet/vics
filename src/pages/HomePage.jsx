import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, ChevronDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchMainFeaturedFeedRestriction, HOME_FEED_MATCHUP_SELECT, invalidateMainFeaturedFeedCache } from '../lib/mainFeed'
import {
  EMPTY_TIER_RANK_INFO,
  enrichMatchupsWithCreatorRankInfo,
} from '../lib/creatorRankSnapshot'
import { runWhenIdle } from '../lib/runDeferred'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { FeedCard } from '../components/matchup/FeedCard'
import { MatchupEngagementProvider } from '../components/matchup/MatchupEngagementContext'
import {
  MATCHUPS_CAT_STORAGE_KEY,
  MATCHUPS_CAT_URL_PARAM,
  VALID_MATCHUPS_FEED_FILTERS,
  readInitialMatchupsFeedCategory,
  useMatchupsFeedCategories,
  MatchupsFeedLnbDesktopAside,
  MatchupsFeedLnbMobileTrigger,
  MatchupsFeedLnbMobileDrawer,
} from '../components/matchup/MatchupsFeedLnb'
import { cn } from '../lib/utils'
import { storedCategoryValuesForFilter } from '../lib/matchupCategoryAliases'

const SORT_OPTIONS = [
  { id: 'newest',  label: '최신순', icon: '🔃' },
  { id: 'popular', label: '인기순', icon: '🔥' },
]

/** DB·UI 공통 페이지 크기 (한 번에 가져오는 행 수) */
const PAGE_SIZE = 20

const VALID_FILTERS = VALID_MATCHUPS_FEED_FILTERS

export function HomePage({ refreshRef }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')
  const filter = VALID_FILTERS.includes(filterParam) ? filterParam : 'active'

  const [category,   setCategory]   = useState(readInitialMatchupsFeedCategory)
  const [sortBy,     setSortBy]     = useState('newest')
  const [sortOpen,   setSortOpen]   = useState(false)
  const [data,       setData]       = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [lnbOpen,    setLnbOpen]    = useState(false)
  const feedCategories = useMatchupsFeedCategories()
  const fetchSeqRef = useRef(0)
  const { openCreateDrawer, openLoginModal } = useUIStore()
  const { user } = useAuthStore()

  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const activeCategoryLabel = useMemo(
    () => feedCategories.find((c) => c.id === category)?.label ?? '전체 매치',
    [feedCategories, category]
  )

  const lnbProps = {
    category,
    filter,
    feedCategories,
    user,
    onCategoryChange: (id) => {
      setPage(1)
      setCategory(id)
      setLnbOpen(false)
    },
    onFilterChange: (id) => {
      setPage(1)
      setSearchParams((p) => {
        const n = new URLSearchParams(p)
        n.set('filter', id)
        return n
      })
      setLnbOpen(false)
    },
    onCreateClick: () => {
      setLnbOpen(false)
      user ? openCreateDrawer() : openLoginModal()
    },
  }

  useEffect(() => {
    try {
      if (category === 'all') {
        sessionStorage.removeItem(MATCHUPS_CAT_STORAGE_KEY)
      } else {
        sessionStorage.setItem(MATCHUPS_CAT_STORAGE_KEY, category)
      }
    } catch {
      void 0
    }
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (category === 'all') n.delete(MATCHUPS_CAT_URL_PARAM)
        else n.set(MATCHUPS_CAT_URL_PARAM, category)
        return n
      },
      { replace: true }
    )
  }, [category, setSearchParams])

  useEffect(() => {
    const ids = new Set(feedCategories.map((c) => c.id))
    if (!ids.has(category)) setCategory('all')
  }, [feedCategories, category])

  useEffect(() => { void fetchMatchups() }, [category, filter, sortBy, user?.id, page])
  useEffect(() => { if (refreshRef) refreshRef.current = fetchMatchups }, [])
  useEffect(() => { setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [category, filter, sortBy])

  const fetchMatchups = async () => {
    const seq = ++fetchSeqRef.current
    const hadRows = dataRef.current?.length > 0
    if (!hadRows) setLoading(true)
    let rows = []
    let rowsForEnrich = []
    try {
      /** 비로그인 시 URL에 filter=mine 이 있어도 목록은 진행 중 매치업 기준으로 조회 */
      const queryFilter = filter === 'mine' && !user?.id ? 'active' : filter

      /** 활성 피드: 전체 투표 진행 중 매치업 노출, 베스트/추천 뱃지는 메인 홈과 동일 상위 7+7만 */
      let featuredRoleById = {}
      if (queryFilter === 'active') {
        const fed = await fetchMainFeaturedFeedRestriction()
        featuredRoleById = fed.roleById
      }

      let q = supabase
        .from('matchups')
        .select(HOME_FEED_MATCHUP_SELECT, { count: 'exact' })
        .not('right_type', 'is', null)

      if (category !== 'all') {
        const catVals = storedCategoryValuesForFilter(category)
        if (catVals.length) q = q.in('category', catVals)
      }
      if (queryFilter === 'mine' && user?.id) {
        q = q.eq('user_id', user.id).eq('status', 'active')
      } else if (queryFilter === 'active') {
        q = q.eq('status', 'active')
        const now = new Date().toISOString()
        q = q.or(`expires_at.is.null,expires_at.gt.${now}`)
      } else if (queryFilter === 'completed') {
        q = q.not('expires_at', 'is', null).lt('expires_at', new Date().toISOString())
      }

      if (sortBy === 'popular') {
        q = q
          .order('total_votes', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
      } else {
        q = q.order('created_at', { ascending: false })
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data: base, error, count } = await q.range(from, to)
      if (seq !== fetchSeqRef.current) return
      if (error) throw error
      setTotalCount(typeof count === 'number' ? count : 0)
      rows = base || []
      const roleHint = (_id) => {
        if (queryFilter !== 'active') return undefined
        const key = String(_id ?? '').trim().toLowerCase()
        return featuredRoleById[key]
      }
      rowsForEnrich = rows.map((m) => ({
        ...m,
        _creatorRankInfo: { ...EMPTY_TIER_RANK_INFO },
        _rightCreatorRankInfo: { ...EMPTY_TIER_RANK_INFO },
        _feedListBadgeVariant: roleHint(m.id),
      }))
      setData(rowsForEnrich)
    } catch (err) {
      if (seq !== fetchSeqRef.current) return
      console.error(err)
      setData([])
      setTotalCount(0)
      rows = []
      rowsForEnrich = []
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
    if (seq !== fetchSeqRef.current || !rows.length) return
    runWhenIdle(() => {
      void (async () => {
        if (seq !== fetchSeqRef.current) return
        try {
          setData(await enrichMatchupsWithCreatorRankInfo(rowsForEnrich))
        } catch (e) {
          console.warn('[HomePage] creator rank enrich failed', e)
        }
      })()
    }, { timeoutMs: 1200 })
  }

  const fetchMatchupsRef = useRef(fetchMatchups)
  fetchMatchupsRef.current = fetchMatchups

  useEffect(() => {
    const on = () => {
      invalidateMainFeaturedFeedCache()
      void fetchMatchupsRef.current()
    }
    window.addEventListener('vics:matchup-banner-highlight:updated', on)
    return () => window.removeEventListener('vics:matchup-banner-highlight:updated', on)
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const goPage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCreate = () => { user ? openCreateDrawer() : openLoginModal() }

  const feedMatchupIds = useMemo(() => data.map((m) => m.id).filter(Boolean), [data])

  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
      {/* ── 앰비언트 배경 오라 ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute top-0 right-0 h-[440px] w-[440px] rounded-full bg-gradient-radial from-fuchsia-300/10 via-violet-200/5 to-transparent blur-3xl" />
        <div className="absolute top-1/2 -left-20 h-[360px] w-[360px] rounded-full bg-gradient-radial from-pink-300/8 via-rose-200/4 to-transparent blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-[320px] w-[320px] rounded-full bg-gradient-radial from-cyan-300/7 via-teal-200/3 to-transparent blur-3xl" />
      </div>

      <MatchupsFeedLnbDesktopAside {...lnbProps} />

      {/* ══ 메인 콘텐츠 ══ */}
      <div className="min-w-0">
        {/* 데스크탑: 제목(중앙) + 최신순/인기순(우측) */}
        <div className="relative hidden lg:block mb-6 min-h-[3rem]">
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-black leading-none bg-gradient-to-r from-fuchsia-600 via-violet-500 to-pink-500 bg-clip-text text-transparent tracking-tight">
              지금 뜨는 1VS1 매치업
            </h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400/80">LIVE BATTLES</p>
          </div>
          <div
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 inline-flex rounded-2xl p-1 border border-fuchsia-200/55 bg-gradient-to-br from-white/90 to-fuchsia-50/80 shadow-sm shadow-fuchsia-200/20"
            role="tablist"
            aria-label="정렬"
          >
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sortBy === s.id}
                onClick={() => { setPage(1); setSortBy(s.id) }}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                  sortBy === s.id
                    ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-300/40'
                    : 'text-fuchsia-800/75 hover:bg-fuchsia-50/80'
                )}
              >
                <span aria-hidden>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 모바일: 카테고리 토글 + 제목 + 정렬 */}
        <div className="lg:hidden mb-4">
          {/* 모바일 페이지 타이틀 */}
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-pink-500 shadow-[0_3px_12px_-2px_rgba(168,85,247,0.5)]">
              <span className="text-sm">⚔️</span>
            </span>
            <div>
              <h2 className="text-sm font-black leading-none bg-gradient-to-r from-fuchsia-600 via-violet-500 to-pink-500 bg-clip-text text-transparent">
                지금 뜨는 1VS1 매치업
              </h2>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-fuchsia-400/80">LIVE BATTLES</p>
            </div>
          </div>
          {/* 필터 + 정렬 툴바 */}
          <div className="flex items-center gap-2">
            <MatchupsFeedLnbMobileTrigger
              activeCategoryLabel={activeCategoryLabel}
              onOpen={() => setLnbOpen(true)}
            />
            <div className="relative ml-auto">
              <button
                onClick={() => setSortOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-fuchsia-200/55 bg-gradient-to-br from-white to-fuchsia-50/80 text-xs font-bold text-fuchsia-800/80 shadow-sm"
              >
                {SORT_OPTIONS.find((s) => s.id === sortBy)?.icon} {SORT_OPTIONS.find((s) => s.id === sortBy)?.label}
                <ChevronDown size={12} className={cn('transition-transform', sortOpen && 'rotate-180')} />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 py-1 rounded-xl border border-fuchsia-200/50 bg-gradient-to-b from-white to-fuchsia-50/90 shadow-lg shadow-fuchsia-200/30 min-w-[120px]">
                    {SORT_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setPage(1); setSortBy(s.id); setSortOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors',
                          sortBy === s.id
                            ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white'
                            : 'text-fuchsia-800/75 hover:bg-fuchsia-50/80'
                        )}
                      >
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── 피드 (모바일: 스냅·한 장면 / 웹: 컴팩트 목록 스크롤) ── */}
        <MatchupEngagementProvider matchupIds={feedMatchupIds}>
          <div className="overflow-y-auto overscroll-contain max-h-[calc(100vh-16rem)] sm:max-h-[calc(100vh-14rem)] snap-y snap-mandatory lg:overflow-visible lg:max-h-none lg:snap-none">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="snap-center snap-always py-3 lg:snap-align-none lg:py-2">
                    <div className="w-full max-w-full lg:max-w-2xl mx-auto">
                      <FeedCardSkeleton />
                    </div>
                  </div>
                ))
              : data.length > 0
              ? data.map((m, i) => (
                  <div
                    key={m.id}
                    className="snap-center snap-always py-3 lg:snap-align-none lg:py-2.5 min-h-[min(72vh,400px)] lg:min-h-0 flex items-center justify-center w-full animate-fade-in-feed-stagger"
                    style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                  >
                    <div className="w-full max-w-full lg:max-w-2xl mx-auto">
                      <FeedCard
                        matchup={m}
                        listBadge={filter === 'active'}
                        listBadgeVariant={m._feedListBadgeVariant}
                        eagerMedia={page === 1 && i < 2}
                        onVoteUpdate={fetchMatchups}
                      />
                    </div>
                  </div>
                ))
              : (
                <div className="py-16 animate-fade-in-feed">
                  <EmptyFeed onCreateClick={handleCreate} />
                </div>
              )}
          </div>
        </MatchupEngagementProvider>

        {/* ── 3-5. 하단 페이지네이션 ── */}
        {!loading && data.length > 0 && (
          <div className="mt-8 pb-24 sm:pb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-fuchsia-100/70 bg-gradient-to-br from-white to-fuchsia-50/40 shadow-[0_2px_12px_-4px_rgba(168,85,247,0.15)]">
              <Pagination current={page} total={totalPages} onPage={goPage} />
            </div>
          </div>
        )}
      </div>

      <MatchupsFeedLnbMobileDrawer open={lnbOpen} onClose={() => setLnbOpen(false)} {...lnbProps} />
    </div>
  )
}

// ── 빈 피드 ───────────────────────────────────────────────────────────
function EmptyFeed({ onCreateClick }) {
  return (
    <div className="py-16 text-center rounded-2xl border border-fuchsia-100/60 bg-gradient-to-br from-white via-fuchsia-50/30 to-violet-50/20 shadow-[0_4px_24px_-8px_rgba(168,85,247,0.1)]">
      <p className="text-5xl mb-3">⚔️</p>
      <p className="text-base font-black bg-gradient-to-r from-fuchsia-700 to-violet-600 bg-clip-text text-transparent mb-1">
        매치업이 없어요.
      </p>
      <p className="text-sm text-fuchsia-400/80 whitespace-pre-line mb-6">
        {'아직 매치업을 만들지 않으셨나요?\n지금 당신의 경쟁을 만들어보세요!'}
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-pink-500 text-white text-sm font-black rounded-xl shadow-[0_4px_16px_-4px_rgba(168,85,247,0.5)] hover:shadow-[0_6px_20px_-4px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 active:scale-95 transition-all"
      >
        <Plus size={15} strokeWidth={2.5} /> 매치업 만들어보기 ✨
      </button>
    </div>
  )
}

// ── 3-5. 페이지네이션 (힙한 원형 디자인) ──────────────────────────────
function Pagination({ current, total, onPage }) {
  const WINDOW = 5
  const half   = Math.floor(WINDOW / 2)
  let start    = Math.max(1, current - half)
  let end      = Math.min(total, start + WINDOW - 1)
  if (end - start + 1 < WINDOW) start = Math.max(1, end - WINDOW + 1)
  const pages  = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-fuchsia-100 text-fuchsia-600/70 hover:border-fuchsia-400 hover:text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={18} />
      </button>
      {start > 1 && (
        <>
          <PaginationBtn page={1} current={current} onClick={onPage} />
          {start > 2 && <span className="text-gray-300 text-sm px-1">…</span>}
        </>
      )}
      {pages.map((p) => <PaginationBtn key={p} page={p} current={current} onClick={onPage} />)}
      {end < total && (
        <>
          {end < total - 1 && <span className="text-gray-300 text-sm px-1">…</span>}
          <PaginationBtn page={total} current={current} onClick={onPage} />
        </>
      )}
      <button
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-fuchsia-100 text-fuchsia-600/70 hover:border-fuchsia-400 hover:text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function PaginationBtn({ page, current, onClick }) {
  const active = page === current
  return (
    <button
      onClick={() => onClick(page)}
      className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-black transition-all ${
        active
          ? 'bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white shadow-[0_4px_14px_-2px_rgba(168,85,247,0.5)] scale-110'
          : 'border-2 border-fuchsia-100 text-fuchsia-700/70 hover:border-fuchsia-400 hover:text-fuchsia-700'
      }`}
    >
      {page}
    </button>
  )
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────
function FeedCardSkeleton() {
  return (
    <div className="relative border border-fuchsia-100/60 bg-gradient-to-br from-white via-fuchsia-50/30 to-white rounded-2xl p-4 lg:p-4 space-y-3 animate-pulse w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-fuchsia-200 via-violet-200 to-pink-200 rounded-t-2xl" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-5 bg-fuchsia-100/80 rounded-lg" />
        <div className="flex-1 h-4 bg-fuchsia-100/60 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:gap-3 lg:max-w-xl lg:mx-auto w-full">
        <div className="aspect-square bg-fuchsia-100/60 rounded-xl" />
        <div className="aspect-square bg-violet-100/60 rounded-xl" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="w-24 h-4 bg-fuchsia-100/60 rounded" />
        <div className="w-20 h-7 bg-fuchsia-100/80 rounded-xl" />
      </div>
    </div>
  )
}
