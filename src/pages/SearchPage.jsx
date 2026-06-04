import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ArrowLeft, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { MATCHUP_CREATOR_PROFILE_FIELDS, EMPTY_TIER_RANK_INFO } from '../lib/creatorRankSnapshot'
import { storedCategoryValuesForFilter } from '../lib/matchupCategoryAliases'
import { MainMatchupCard } from '../components/main/MainMatchupCard'
import { MainCardSkeleton } from '../components/main/MainCardSkeleton'

/** 카테고리 설정이 없을 때 사용할 기본 목록 (id → label) */
const DEFAULT_CAT_OPTIONS = [
  { value: 'eternal_quest', label: '영원한 난제' },
  { value: 'romance',       label: '연애' },
  { value: 'relationships', label: '인간관계' },
  { value: 'work_life',     label: '직장&갓생' },
  { value: 'balance_game',  label: '밸런스게임' },
  { value: 'food_gourmet',  label: '맛집&맛식' },
  { value: 'fashion',       label: '패션' },
]

const PAGE_SIZE = 12

const SORT_OPTIONS = [
  { id: 'latest',   label: '최신순',    col: 'created_at', asc: false },
  { id: 'votes',    label: '투표많은순', col: 'total_votes', asc: false },
  { id: 'oldest',   label: '오래된순',  col: 'created_at', asc: true  },
]

export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialQ = searchParams.get('q') || ''
  const [inputValue, setInputValue]   = useState(initialQ)
  const [query, setQuery]             = useState(initialQ)
  const [sortId, setSortId]           = useState('latest')
  const [results, setResults]         = useState([])
  const [totalCount, setTotalCount]   = useState(0)
  const [loading, setLoading]         = useState(false)
  const [page, setPage]               = useState(0)

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const doSearch = useCallback(async (q, sort, p) => {
    if (!q.trim()) {
      setResults([])
      setTotalCount(0)
      return
    }
    setLoading(true)
    try {
      const sortOpt = SORT_OPTIONS.find((s) => s.id === sort) || SORT_OPTIONS[0]
      const embed = `*, profiles:user_id(${MATCHUP_CREATOR_PROFILE_FIELDS}), right_profiles:right_user_id(${MATCHUP_CREATOR_PROFILE_FIELDS})`
      const qLower = q.trim().toLowerCase()
      /** PostgREST or() 안에서 쉼표·따옴표와 충돌하지 않도록 ilike 패턴을 큰따옴표로 감쌈 */
      const ilikePatternQuoted = `"${`%${q.trim()}%`.replace(/"/g, '""')}"`

      // 카테고리 목록을 Supabase에서 직접 가져와 최신 상태로 사용
      let catList = DEFAULT_CAT_OPTIONS
      try {
        const { data: cfgRow } = await supabase
          .from('category_admin_config')
          .select('data')
          .eq('id', 'default')
          .maybeSingle()
        const remote = cfgRow?.data?.activeCategories
        if (Array.isArray(remote) && remote.length > 0) {
          catList = remote.map((c) => ({ value: c.id, label: c.label || c.slug || c.id }))
        }
      } catch {
        // 실패 시 기본 목록 유지
      }

      // 검색어와 label이 일치하는 카테고리 ID 수집 + 레거시 별칭 확장
      const matchedCategoryIds = [
        ...new Set(
          catList
            .filter((c) => c.value && c.label?.toLowerCase().includes(qLower))
            .flatMap((c) => storedCategoryValuesForFilter(c.value))
        ),
      ]

      // 텍스트 ilike 3종 OR (선택) category.in — 한 쿼리로 합쳐 서버에서 count + range
      const orParts = [
        `title.ilike.${ilikePatternQuoted}`,
        `left_label.ilike.${ilikePatternQuoted}`,
        `right_label.ilike.${ilikePatternQuoted}`,
      ]
      if (matchedCategoryIds.length > 0) {
        orParts.push(`category.in.(${matchedCategoryIds.join(',')})`)
      }

      const from = p * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('matchups')
        .select(embed, { count: 'exact' })
        .eq('status', 'active')
        .or(orParts.join(','))
        .order(sortOpt.col, { ascending: sortOpt.asc, nullsFirst: false })
        .order('id', { ascending: true })

      const { data, error, count } = await query.range(from, to)
      if (error) throw error

      const rows = (data || []).map((m) => ({
        ...m,
        _creatorRankInfo: { ...EMPTY_TIER_RANK_INFO },
      }))
      setResults(rows)
      setTotalCount(typeof count === 'number' ? count : 0)
    } catch (err) {
      console.error('[SearchPage]', err)
      setResults([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [])

  // URL q 파라미터 변경 시 재검색
  useEffect(() => {
    const q = searchParams.get('q') || ''
    setInputValue(q)
    setQuery(q)
    setPage(0)
  }, [searchParams])

  useEffect(() => {
    doSearch(query, sortId, page)
  }, [query, sortId, page, doSearch])

  const handleSubmit = (e) => {
    e.preventDefault()
    const q = inputValue.trim()
    if (!q) return
    setPage(0)
    setSearchParams({ q })
  }

  const handleSort = (id) => {
    setSortId(id)
    setPage(0)
  }

  const goTo = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPageNums = () => {
    const pages = []
    const delta = 2
    const left  = Math.max(0, page - delta)
    const right = Math.min(totalPages - 1, page + delta)
    if (left > 0) { pages.push(0); if (left > 1) pages.push('…') }
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPages - 1) { if (right < totalPages - 2) pages.push('…'); pages.push(totalPages - 1) }
    return pages
  }

  return (
    <div className="min-h-screen text-[#22282E] -mx-4 -my-6 px-4 py-6 pb-24 sm:pb-8">

      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-1 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
          aria-label="뒤로"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-black text-[#22282E]">카테고리&amp;매치업 검색</h1>
      </div>

      {/* ── 검색 입력 ── */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="카테고리&매치업 제목으로 검색..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl border-2 border-violet-200 bg-white text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-300/30 transition-all"
            autoFocus
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => { setInputValue(''); setSearchParams({}); setResults([]); setTotalCount(0) }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      {/* ── 정렬 + 결과 수 ── */}
      {query.trim() && !loading && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm font-bold text-gray-500">
            <span className="text-violet-700 font-black">"{query}"</span> 검색 결과{' '}
            <span className="text-[#22282E]">{totalCount.toLocaleString()}건</span>
          </p>
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={13} className="text-gray-400" />
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSort(s.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-bold transition-colors',
                  sortId === s.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 결과 목록 ── */}
      <div className="space-y-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-3"><MainCardSkeleton /></div>
            ))
          : results.length > 0
          ? results.map((m, i) => (
              <div
                key={`${m.id}-${page}`}
                className="py-3 animate-fade-in-feed-stagger"
                style={{ '--stagger-delay': `${Math.min(i, 11) * 40}ms` }}
              >
                <MainMatchupCard matchup={m} variant="hot" />
              </div>
            ))
          : query.trim() && !loading && (
              <div className="py-20 text-center">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-base font-black text-gray-600 mb-1">검색 결과가 없어요</p>
                <p className="text-sm text-gray-400">다른 키워드로 검색해보세요</p>
              </div>
            )
        }

        {/* 초기 상태 (검색어 없음) */}
        {!query.trim() && !loading && (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">🥊</p>
            <p className="text-base font-black text-gray-600 mb-1">카테고리&amp;매치업을 검색해보세요</p>
            <p className="text-sm text-gray-400">제목으로 검색할 수 있어요</p>
          </div>
        )}
      </div>

      {/* ── 페이지네이션 ── */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-violet-200 bg-white text-violet-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-50 transition-colors"
          >
            ← 이전
          </button>
          {getPageNums().map((p, i) =>
            p === '…' ? (
              <span key={`el-${i}`} className="px-1.5 text-xs text-gray-400 select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => goTo(p)}
                className={cn(
                  'w-8 h-8 rounded-xl text-xs font-black border transition-colors',
                  p === page
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-sm'
                    : 'border-violet-100 bg-white text-gray-600 hover:bg-violet-50'
                )}
              >
                {p + 1}
              </button>
            )
          )}
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-violet-200 bg-white text-violet-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-50 transition-colors"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}
