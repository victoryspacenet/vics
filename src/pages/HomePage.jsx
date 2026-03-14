import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, TrendingUp, Plus, ChevronDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { FeedCard } from '../components/matchup/FeedCard'
import { RankingBoard } from '../components/matchup/RankingBoard'

// ── LNB 카테고리 ───────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',    label: '전체 매치',  icon: '⚽' },
  { id: '패션',   label: '패션 대결',  icon: '👗' },
  { id: '밸런스', label: '밸런스 게임', icon: '⚖️' },
  { id: '댄스',   label: '댄스 챌린지', icon: '💃' },
  { id: '맛집',   label: '맛집 대결',  icon: '🍔' },
]

const FILTERS = [
  { id: 'active', label: '진행중인 투표' },
  { id: 'mine',   label: '내가 올린 매치' },
]

const SORT_OPTIONS = [
  { id: 'newest',  label: '최신순', icon: '🔃' },
  { id: 'popular', label: '인기순', icon: '🔥' },
]

const PAGE_SIZE = 12

export function HomePage({ refreshRef }) {
  const [category,   setCategory]   = useState('all')
  const [filter,     setFilter]     = useState('active')
  const [sortBy,     setSortBy]     = useState('newest')
  const [sortOpen,   setSortOpen]   = useState(false)
  const [data,       setData]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [lnbOpen,    setLnbOpen]    = useState(false)
  const { openCreateDrawer, openLoginModal } = useUIStore()
  const { user } = useAuthStore()

  useEffect(() => { fetchMatchups() }, [category, filter, sortBy])
  useEffect(() => { if (refreshRef) refreshRef.current = fetchMatchups }, [])
  useEffect(() => { setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [category, filter, sortBy])

  const fetchMatchups = async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('matchups')
        .select('*, profiles:user_id(id, nickname, avatar_url, points)')
        .eq('status', 'active')

      if (category !== 'all') q = q.eq('category', category)
      if (filter === 'mine' && user?.id) q = q.eq('user_id', user.id)

      const { data: base } = await q.not('right_type', 'is', null).limit(100)
      const pool = base || []
      const sorted = sortBy === 'popular'
        ? [...pool].sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0))
        : [...pool].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setData(sorted)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totalPages  = Math.max(1, Math.ceil(data.length / PAGE_SIZE))
  const pagedItems  = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const goPage      = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const handleCreate = () => { user ? openCreateDrawer() : openLoginModal() }

  const LNBContent = () => (
    <div className="space-y-1">
      <div className="px-3 py-2 mb-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">⚽ 카테고리</p>
      </div>
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          onClick={() => { setCategory(c.id); setLnbOpen(false) }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
            category === c.id ? 'bg-[#22282E] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>{c.icon}</span>{c.label}
        </button>
      ))}
      <div className="pt-4 mt-4 border-t border-gray-100">
        <p className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">📍 필터</p>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setLnbOpen(false) }}
            disabled={f.id === 'mine' && !user}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
              filter === f.id ? 'bg-[#22282E] text-white' : 'text-gray-600 hover:bg-gray-100'
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
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_260px] gap-5 items-start">
      {/* ══ LNB (데스크탑) ══ */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <LNBContent />
        </div>
      </aside>

      {/* ══ 메인 콘텐츠 ══ */}
      <div className="min-w-0">
        {/* 모바일: 카테고리 토글 + 제목 + 정렬 */}
        <div className="lg:hidden flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setLnbOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-600"
          >
            ⚽ 카테고리 <ChevronDown size={14} />
          </button>
          <span className="flex-1 text-center text-sm font-bold text-[#22282E]">지금 뜨는 1VS1 매치업</span>
          <div className="relative ml-auto">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-600"
            >
              {SORT_OPTIONS.find((s) => s.id === sortBy)?.icon} {SORT_OPTIONS.find((s) => s.id === sortBy)?.label} <ChevronDown size={14} className={sortOpen ? 'rotate-180' : ''} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 py-1 bg-white rounded-xl border border-gray-200 shadow-lg min-w-[120px]">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSortBy(s.id); setSortOpen(false) }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                        sortBy === s.id ? 'bg-[#22282E] text-white' : 'text-gray-600 hover:bg-gray-100'
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

        {/* ── 피드 ── */}
        <div className="overflow-y-auto overscroll-contain max-h-[calc(100vh-16rem)] sm:max-h-[calc(100vh-14rem)] snap-y snap-mandatory">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="snap-center snap-always py-3">
                  <FeedCardSkeleton />
                </div>
              ))
            : pagedItems.length > 0
            ? pagedItems.map((m, i) => (
                <div
                  key={m.id}
                  className="snap-center snap-always py-3 min-h-[min(75vh,420px)] flex items-center"
                >
                  <FeedCard
                    matchup={m}
                    listBadge
                    onVoteUpdate={fetchMatchups}
                  />
                </div>
              ))
            : <div className="py-16"><EmptyFeed onCreateClick={handleCreate} /></div>
          }
        </div>

        {/* ── 3-5. 하단 페이지네이션 (원형 버튼) ── */}
        {!loading && pagedItems.length > 0 && (
          <div className="mt-8 pb-24 sm:pb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Pagination current={page} total={totalPages} onPage={goPage} />
            </div>
          </div>
        )}
      </div>

      {/* 모바일 LNB 드로어 */}
      {lnbOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setLnbOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 z-50 w-[min(18rem,90vw)] max-w-[18rem] bg-white shadow-xl overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="font-black text-[#22282E]">⚽ 카테고리 & 필터</p>
              <button onClick={() => setLnbOpen(false)} className="p-2 rounded-xl hover:bg-gray-100">✕</button>
            </div>
            <LNBContent />
          </div>
        </>
      )}

      {/* ══ 랭킹 사이드바 (XL) ══ */}
      <aside className="hidden xl:block sticky top-24 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <TrendingUp size={14} className="text-red-500" />
            <h2 className="text-sm font-black text-[#22282E]">실시간 핫 랭킹</h2>
            <span className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-red-500 font-bold">LIVE</span>
            </span>
          </div>
          <RankingBoard />
        </div>
      </aside>
    </div>
  )
}

// ── 빈 피드 ───────────────────────────────────────────────────────────
function EmptyFeed({ onCreateClick }) {
  const emoji = '🆕'
  const title = '매치업이 없어요.'
  const desc = '아직 매치업을 만들지 않으셨나요?\n지금 당신의 대결을 만들어보세요!'
  const cta = '매치업 만들어보기 ✨'
  return (
    <div className="py-16 text-center rounded-2xl bg-white border border-gray-100">
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
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-5 bg-gray-100 rounded-lg" />
        <div className="flex-1 h-4 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="aspect-square bg-gray-100 rounded-xl" />
        <div className="aspect-square bg-gray-100 rounded-xl" />
      </div>
      <div className="flex items-center justify-between">
        <div className="w-24 h-4 bg-gray-100 rounded" />
        <div className="w-20 h-7 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
