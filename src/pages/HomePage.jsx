import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, ChevronDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  MATCHUP_CREATOR_PROFILE_FIELDS,
  enrichMatchupsWithCreatorRankInfo,
} from '../lib/creatorRankSnapshot'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { FeedCard } from '../components/matchup/FeedCard'
import { cn } from '../lib/utils'
import { getFeedCategoryNavItems } from '../lib/categoryAdminStorage'
import { storedCategoryValuesForFilter } from '../lib/matchupCategoryAliases'

const FILTERS = [
  { id: 'active',   label: '투표진행중 매치업' },
  { id: 'completed', label: '투표완료 매치업' },
  { id: 'mine',     label: '내가 올린 매치업' },
]

const SORT_OPTIONS = [
  { id: 'newest',  label: '최신순', icon: '🔃' },
  { id: 'popular', label: '인기순', icon: '🔥' },
]

const PAGE_SIZE = 12

const VALID_FILTERS = ['active', 'completed', 'mine']

/** 다른 화면 갔다가 `/matchups`로 돌아와도 탭·필터가 유지되도록 (URL·sessionStorage) */
const MATCHUPS_CAT_STORAGE_KEY = 'vics_matchups_feed_category'
const MATCHUPS_CAT_URL_PARAM = 'cat'

function readInitialMatchupsCategory() {
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

/** 매치업 목록 LNB·드로어 — 바탕 흰색 */
const MZ_SB =
  'rounded-2xl border border-gray-100 bg-white shadow-sm'

/** LNB 행 — 비선택은 차가운 회색 대신 로즈·퓨시아 계열 */
const LNB_ROW_ON =
  'bg-gradient-to-r from-pink-200/90 via-fuchsia-200/85 to-violet-200/90 text-fuchsia-950 font-black shadow-sm shadow-pink-200/30 border border-white/70'
const LNB_ROW_OFF =
  'text-pink-700/90 hover:text-fuchsia-800 hover:bg-pink-50/90 hover:shadow-sm'

export function HomePage({ refreshRef }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')
  const filter = VALID_FILTERS.includes(filterParam) ? filterParam : 'active'

  const [category,   setCategory]   = useState(readInitialMatchupsCategory)
  const [sortBy,     setSortBy]     = useState('newest')
  const [sortOpen,   setSortOpen]   = useState(false)
  const [data,       setData]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [lnbOpen,    setLnbOpen]    = useState(false)
  const [catNavTick, setCatNavTick] = useState(0)
  const { openCreateDrawer, openLoginModal } = useUIStore()
  const { user } = useAuthStore()

  const feedCategories = useMemo(() => {
    void catNavTick
    try {
      return getFeedCategoryNavItems()
    } catch {
      return [{ id: 'all', icon: '✨', label: '전체 매치' }]
    }
  }, [catNavTick])

  const activeCategoryLabel = useMemo(
    () => feedCategories.find((c) => c.id === category)?.label ?? '전체 매치',
    [feedCategories, category]
  )

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
    const bump = () => setCatNavTick((t) => t + 1)
    window.addEventListener('vics_categories_changed', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener('vics_categories_changed', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  useEffect(() => {
    const ids = new Set(feedCategories.map((c) => c.id))
    if (!ids.has(category)) setCategory('all')
  }, [feedCategories, category])

  useEffect(() => { fetchMatchups() }, [category, filter, sortBy, user?.id])
  useEffect(() => { if (refreshRef) refreshRef.current = fetchMatchups }, [])
  useEffect(() => { setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [category, filter, sortBy])

  const fetchMatchups = async () => {
    setLoading(true)
    try {
      /** 비로그인 시 URL에 filter=mine 이 있어도 목록은 진행 중 매치업 기준으로 조회 */
      const queryFilter = filter === 'mine' && !user?.id ? 'active' : filter

      const embed = `*, profiles:user_id(${MATCHUP_CREATOR_PROFILE_FIELDS}), right_profiles:right_user_id(${MATCHUP_CREATOR_PROFILE_FIELDS})`
      let q = supabase
        .from('matchups')
        .select(embed)
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

      const { data: base } = await q.limit(100)
      const pool = base || []
      const sorted = sortBy === 'popular'
        ? [...pool].sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0))
        : [...pool].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setData(await enrichMatchupsWithCreatorRankInfo(sorted))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMatchupsRef = useRef(fetchMatchups)
  fetchMatchupsRef.current = fetchMatchups

  useEffect(() => {
    const on = () => {
      void fetchMatchupsRef.current()
    }
    window.addEventListener('vics:matchup-banner-highlight:updated', on)
    return () => window.removeEventListener('vics:matchup-banner-highlight:updated', on)
  }, [])

  const totalPages  = Math.max(1, Math.ceil(data.length / PAGE_SIZE))
  const pagedItems  = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const goPage      = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const handleCreate = () => { user ? openCreateDrawer() : openLoginModal() }

  const LNBContent = () => (
    <div className="space-y-1">
      <div className="px-3 py-2 mb-1">
        <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest">🌐 카테고리</p>
      </div>
      {feedCategories.map((c) => (
        <button
          key={c.id}
          onClick={() => { setCategory(c.id) }}
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
        <p className="px-3 py-2 text-[10px] font-black text-pink-400 uppercase tracking-widest">📍 필터</p>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setSearchParams((p) => { const n = new URLSearchParams(p); n.set('filter', f.id); return n }) }}
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
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] text-sm font-black rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition-all"
        >
          <Plus size={16} strokeWidth={2.5} />
          매치업 생성
        </button>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
      {/* ══ LNB (데스크탑) ══ */}
      <aside className="hidden lg:block">
        <div className={`sticky top-24 p-3 ${MZ_SB}`}>
          <LNBContent />
        </div>
      </aside>

      {/* ══ 메인 콘텐츠 ══ */}
      <div className="min-w-0">
        {/* 데스크탑: 제목(중앙) + 최신순/인기순(우측) */}
        <div className="relative hidden lg:block mb-5 min-h-[2.75rem]">
          <h2 className="text-lg font-black tracking-tight text-[#22282E] text-center w-full px-4 -translate-x-2">
            지금 뜨는 1VS1 매치업
          </h2>
          <div
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 inline-flex rounded-2xl p-1 border border-violet-200/55 bg-gradient-to-br from-white/90 to-fuchsia-50/80 shadow-sm shadow-violet-200/15"
            role="tablist"
            aria-label="정렬"
          >
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sortBy === s.id}
                onClick={() => setSortBy(s.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                  sortBy === s.id
                    ? 'bg-[#22282E] text-white shadow-md'
                    : 'text-violet-900/75 hover:bg-white/50'
                )}
              >
                <span aria-hidden>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 모바일: 카테고리 토글 + 제목 + 정렬 */}
        <div className="lg:hidden flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setLnbOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200/55 bg-gradient-to-br from-white/90 to-violet-50/85 text-sm font-bold text-violet-900/80 shadow-sm shadow-violet-200/20"
          >
            <span className="max-w-[42vw] truncate sm:max-w-none" title={activeCategoryLabel}>
              🌐 {activeCategoryLabel}
            </span>{' '}
            <ChevronDown size={14} className="shrink-0" />
          </button>
          <span className="flex-1 text-center text-sm font-bold text-[#22282E]">지금 뜨는 1VS1 매치업</span>
          <div className="relative ml-auto">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-200/55 bg-gradient-to-br from-white/90 to-fuchsia-50/80 text-sm font-bold text-violet-900/80 shadow-sm shadow-fuchsia-200/15"
            >
              {SORT_OPTIONS.find((s) => s.id === sortBy)?.icon} {SORT_OPTIONS.find((s) => s.id === sortBy)?.label} <ChevronDown size={14} className={sortOpen ? 'rotate-180' : ''} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 py-1 rounded-xl border border-violet-200/50 bg-gradient-to-b from-violet-50/98 to-fuchsia-50/90 shadow-lg shadow-violet-200/25 min-w-[120px]">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSortBy(s.id); setSortOpen(false) }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                        sortBy === s.id ? 'bg-[#22282E] text-white' : 'text-violet-900/75 hover:bg-white/50'
                      }`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── 피드 (모바일: 한 화면에 한 카드 느낌 / 웹: 뷰포트 비율에 맞춰 카드·썸네일 확대) ── */}
        <div className="overflow-y-auto overscroll-contain max-h-[calc(100vh-16rem)] sm:max-h-[calc(100vh-14rem)] lg:max-h-[calc(100vh-10rem)] xl:max-h-[calc(100vh-9.5rem)] snap-y snap-mandatory">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="snap-center snap-always py-3 lg:py-5">
                  <FeedCardSkeleton />
                </div>
              ))
            : pagedItems.length > 0
            ? pagedItems.map((m, i) => (
                <div
                  key={`${filter}-${category}-${sortBy}-${page}-${m.id}`}
                  className="snap-center snap-always py-3 lg:py-5 min-h-[min(72vh,400px)] lg:min-h-[min(82vh,560px)] xl:min-h-[min(85vh,680px)] flex items-center justify-center w-full animate-fade-in-feed-stagger"
                  style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                >
                  <div className="w-full max-w-full lg:max-w-[min(100%,52rem)] xl:max-w-[min(100%,56rem)] mx-auto">
                    <FeedCard
                      matchup={m}
                      listBadge
                      onVoteUpdate={fetchMatchups}
                    />
                  </div>
                </div>
              ))
            : (
              <div className="py-16 animate-fade-in-feed">
                <EmptyFeed onCreateClick={handleCreate} />
              </div>
            )
          }
        </div>

        {/* ── 3-5. 하단 페이지네이션 (원형 버튼) ── */}
        {!loading && pagedItems.length > 0 && (
          <div className="mt-8 pb-24 sm:pb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-100 bg-white/90 shadow-sm">
              <Pagination current={page} total={totalPages} onPage={goPage} />
            </div>
          </div>
        )}
      </div>

      {/* 모바일 LNB 드로어 */}
      {lnbOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gradient-to-br from-fuchsia-900/25 via-violet-900/20 to-pink-900/25 backdrop-blur-md backdrop-saturate-150"
            onClick={() => setLnbOpen(false)}
            aria-hidden
          />
          <div className={`fixed top-0 left-0 bottom-0 z-50 w-[min(18rem,90vw)] max-w-[18rem] shadow-xl shadow-gray-200/40 overflow-y-auto p-4 ${MZ_SB} rounded-none rounded-r-2xl`}>
            <div className="flex justify-between items-center mb-4">
              <p className="font-black text-fuchsia-600">🌐 카테고리 & 필터</p>
              <button type="button" onClick={() => setLnbOpen(false)} className="p-2 rounded-xl text-pink-400 hover:bg-white/80 transition-colors">✕</button>
            </div>
            <LNBContent />
          </div>
        </>
      )}
    </div>
  )
}

// ── 빈 피드 ───────────────────────────────────────────────────────────
function EmptyFeed({ onCreateClick }) {
  const emoji = '🆕'
  const title = '매치업이 없어요.'
  const desc = '아직 매치업을 만들지 않으셨나요?\n지금 당신의 경쟁을 만들어보세요!'
  const cta = '매치업 만들어보기 ✨'
  return (
    <div className="py-16 text-center rounded-2xl border border-gray-100 bg-white/90">
      <p className="text-5xl mb-3">{emoji}</p>
      <p className="text-base font-black text-[#22282E] mb-1">{title}</p>
      <p className="text-sm text-gray-400 whitespace-pre-line mb-6">{desc}</p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] text-sm font-black rounded-xl shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
      >
        <Plus size={15} strokeWidth={2.5} /> {cta}
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
        className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-400 hover:border-[#22282E] hover:text-[#22282E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
        className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-400 hover:border-[#22282E] hover:text-[#22282E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
        active ? 'bg-[#22282E] text-white shadow-lg scale-110' : 'border-2 border-gray-200 text-gray-500 hover:border-[#22282E] hover:text-[#22282E]'
      }`}
    >
      {page}
    </button>
  )
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────
function FeedCardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl lg:rounded-3xl p-4 lg:p-6 space-y-3 lg:space-y-4 animate-pulse max-w-full lg:max-w-[min(100%,52rem)] xl:max-w-[min(100%,56rem)] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 lg:w-12 h-5 lg:h-6 bg-gray-100 rounded-lg" />
        <div className="flex-1 h-4 lg:h-5 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:gap-4">
        <div className="aspect-square bg-gray-100 rounded-xl lg:rounded-2xl" />
        <div className="aspect-square bg-gray-100 rounded-xl lg:rounded-2xl" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="w-24 lg:w-32 h-4 lg:h-5 bg-gray-100 rounded" />
        <div className="w-20 lg:w-24 h-7 lg:h-9 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
