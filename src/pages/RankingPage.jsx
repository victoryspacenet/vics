import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronDown, TrendingUp, TrendingDown, Minus,
  ChevronRight, Flame, Plus, Menu, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { safeMediaUrl } from '../lib/sanitize'
import { getCachedRanking, setCachedRanking } from '../lib/rankingCache'
import { useAuthStore } from '../store/authStore'
import { formatNumber, cn } from '../lib/utils'
import { useUIStore } from '../store/uiStore'
import { RankingCelebrationModal } from '../components/ranking/RankingCelebrationModal'
import { Avatar } from '../components/ui/Avatar'
import { FeaturedBadgeSpan } from '../components/ui/FeaturedBadge'
import { TierBadge } from '../components/ui/TierBadge'
import {
  getInitialMobileTabCategoryIds,
  readMobileTabCache,
  writeMobileTabCache,
  fetchTopMobileTabCategoryIds,
} from '../lib/rankingMobileTabs'
import { getRankingCategoryNavItems } from '../lib/categoryAdminStorage'
import { getRankingEligibleProfileIds, RANKING_ELIGIBLE_CACHE_TAG } from '../lib/rankingEligibleProfiles'
import { fetchCreatorRankMapForIds, EMPTY_TIER_RANK_INFO } from '../lib/creatorRankSnapshot'
import {
  clearRankingCelebrationSeenThisLogin,
  markRankingCelebrationSeenThisLogin,
  platformHasRankingCelebrationContext,
  profileHasRankingEngagement,
  shouldOfferRankingCelebration,
} from '../lib/rankingCelebrationEligibility'
import { attachCompetitionRanksForPage } from '../lib/rankingCompetitionRank'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

const PERIOD_OPTIONS = [
  { id: 'weekly',  label: '이번 주' },
  { id: 'monthly', label: '이번 달' },
  { id: 'all',     label: '전체'    },
]
const TYPE_OPTIONS = [
  { id: 'creator', label: '👑 The Champion', sub: '매치업 생성자' },
  { id: 'voter',   label: '🔮 The Oracle',   sub: '매치업 투표자' },
]
const CREATOR_SORT_OPTIONS = [
  { id: 'points',   label: '포인트'     },
  { id: 'votes',    label: '투표받은 수' },
]
const VOTER_SORT_OPTIONS = [
  { id: 'points',   label: '포인트'     },
  { id: 'hitrate',  label: '적중률순'   },
]

/** 랭킹 행에 티어 스냅샷(_tierRankInfo) 포함 — 캐시 키 버전 */
const RANKING_ROWS_CACHE_VER = 't3'

/** 랭킹 LNB·드로어 — 바탕 흰색 */
const MZ_SB =
  'rounded-2xl border border-gray-100 bg-white shadow-sm'

const LNB_ROW_ON =
  'bg-gradient-to-r from-pink-200/90 via-fuchsia-200/85 to-violet-200/90 text-fuchsia-950 font-black shadow-sm shadow-pink-200/30 border border-white/70'
const LNB_ROW_OFF =
  'text-pink-700/90 hover:text-fuchsia-800 hover:bg-pink-50/90 hover:shadow-sm'

// ── 드롭다운 컴포넌트 ────────────────────────────────────────────────
function Dropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border border-pink-200 bg-white text-fuchsia-900 shadow-sm shadow-pink-100/50 hover:bg-pink-50 hover:border-pink-300 transition-colors"
      >
        {selected?.label || label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 rounded-xl border border-pink-200 bg-white shadow-lg shadow-pink-200/40 z-[60] min-w-[120px] overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                value === opt.id
                  ? 'bg-gradient-to-r from-pink-200 to-fuchsia-200 text-fuchsia-950'
                  : 'text-gray-700 bg-white hover:bg-pink-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 변동 배지 ────────────────────────────────────────────────────────
function ChangeBadge({ change }) {
  if (change === 'NEW') return <span className="px-1.5 py-0.5 text-[9px] font-black bg-blue-100 text-blue-600 rounded-full">NEW</span>
  if (!change || change === 0) return <Minus size={10} className="text-gray-300" />
  if (change > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-black text-emerald-500">
      <TrendingUp size={10} />{change}
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-black text-red-400">
      <TrendingDown size={10} />{Math.abs(change)}
    </span>
  )
}

// ── 적중률 계산 (The Oracle) ────────────────────────────────────────
function calcHitRate(hits, total) {
  if (!total || total === 0) return null
  return Math.round(((hits || 0) / total) * 100)
}

// ── TOP 3 포디움 ─────────────────────────────────────────────────────
function Podium({ users, category, typeTab, sortBy, categories }) {
  if (!users || users.filter(Boolean).length < 1) return null
  const [second, first, third] = [users[1], users[0], users[2]]
  const catLabel = categories.find((c) => c.id === category)
  const typeOpt = TYPE_OPTIONS.find((t) => t.id === typeTab)

  return (
    <div className="bg-gradient-to-b from-violet-50/90 via-fuchsia-50/50 to-amber-50/70 rounded-3xl border border-violet-200/40 ring-1 ring-amber-100/50 px-4 pt-5 pb-0 mb-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-5">
        <Flame size={15} className="text-amber-500" />
        <p className="text-sm font-black text-[#22282E]">
          TOP 3 {typeOpt?.label || ''}{catLabel && catLabel.id !== 'all' ? ` ${catLabel.label}` : ''} 랭커
        </p>
      </div>
      <div className="flex items-end justify-center gap-1">
        <PodiumCard user={second} rank={second?._displayRank ?? 2} typeTab={typeTab} sortBy={sortBy} />
        <PodiumCard user={first}  rank={first?._displayRank ?? 1} typeTab={typeTab} sortBy={sortBy} />
        <PodiumCard user={third}  rank={third?._displayRank ?? 3} typeTab={typeTab} sortBy={sortBy} />
      </div>
    </div>
  )
}

function PodiumCard({ user: u, rank, typeTab, sortBy }) {
  if (!u) return <div className="flex-1" />
  const cfg   = {
    1: { base: 'h-24',   gradient: 'from-amber-400 to-yellow-500', ring: 'ring-2 ring-amber-400', av: 'w-16 h-16', medal: '🥇', textColor: 'text-amber-600' },
    2: { base: 'h-16',   gradient: 'from-slate-300 to-gray-400',   ring: 'ring-2 ring-gray-300',  av: 'w-12 h-12', medal: '🥈', textColor: 'text-slate-500' },
    3: { base: 'h-12',   gradient: 'from-orange-300 to-amber-500', ring: 'ring-2 ring-orange-300', av: 'w-12 h-12', medal: '🥉', textColor: 'text-orange-500' },
  }[rank]

  const isCreator = typeTab === 'creator'
  const statLabel = isCreator
    ? (sortBy === 'points' ? `${formatNumber(u.points || 0)}P` : `${formatNumber(u.total_votes_received || 0)}표`)
    : (sortBy === 'points' ? `${formatNumber(u.points || 0)}P` : calcHitRate(u.vote_hits, u.vote_total) !== null ? `적중률 ${calcHitRate(u.vote_hits, u.vote_total)}%` : '-')

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-xl">{cfg.medal}</span>
      <div className={`${cfg.av} rounded-full overflow-hidden ${cfg.ring} shadow-md flex-shrink-0`}>
        {u.avatar_url
          ? <img src={safeMediaUrl(u.avatar_url)} alt={u.nickname} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <span className="font-black text-gray-500 text-base">{u.nickname?.[0]?.toUpperCase()}</span>
            </div>
        }
      </div>
      <p className="text-xs font-black text-[#22282E] text-center truncate w-full px-1 flex items-center justify-center gap-0.5">
        <span className="truncate">{u.nickname}</span>
        <FeaturedBadgeSpan badgeId={u.featured_badge} />
      </p>
      <TierBadge
        profile={u}
        rankInfo={u._tierRankInfo ?? { ...EMPTY_TIER_RANK_INFO }}
        variant="compact"
        className="!text-[9px]"
      />
      <p className={`text-xs font-black ${cfg.textColor}`}>{statLabel}</p>
      <div className={`w-full ${cfg.base} bg-gradient-to-b ${cfg.gradient} rounded-t-xl flex items-start justify-center pt-2`}>
        <span className="text-xs font-black text-white/90">{rank}위</span>
      </div>
    </div>
  )
}

// ── 순위 행 스켈레톤 ───────────────────────────────────────────────────
function RankRowSkeleton() {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-violet-100/40 last:border-0">
      <div className="w-7 sm:w-8 h-5 bg-gray-100 rounded flex-shrink-0" />
      <div className="flex items-center gap-2 flex-[2] min-w-0">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="h-3.5 w-20 bg-gray-100 rounded" />
          <div className="h-2.5 w-14 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="flex-1 hidden sm:block">
        <div className="h-3 w-10 bg-gray-100 rounded mx-auto" />
      </div>
      <div className="flex-1 hidden md:block">
        <div className="h-3 w-8 bg-gray-100 rounded mx-auto" />
      </div>
      <div className="flex-1 flex justify-end">
        <div className="h-3 w-12 bg-gray-100 rounded" />
      </div>
      <div className="w-8 h-4 bg-gray-100 rounded flex-shrink-0" />
    </div>
  )
}

// ── 순위 테이블 행 ───────────────────────────────────────────────────
function RankRow({ entry, rank, isMe, typeTab, sortBy }) {
  const isCreator = typeTab === 'creator'
  const hitRate = calcHitRate(entry.vote_hits, entry.vote_total)

  const creatorStat = entry.total_votes_received || 0
  const oracleP = entry.oracle_points || 0

  return (
    <div className={cn(
      'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-violet-100/45 last:border-0 transition-colors',
      isMe ? 'bg-lime-50/80 border-l-[3px] border-l-lime-400' : 'hover:bg-violet-50/45'
    )}>
      <div className="w-7 sm:w-8 text-center flex-shrink-0">
        {rank <= 3
          ? <span className="text-base">{['🥇','🥈','🥉'][rank - 1]}</span>
          : <span className="text-xs font-black text-gray-400 tabular-nums">{rank}</span>
        }
      </div>

      <div className="flex items-center gap-2 flex-[2] min-w-0">
        <div className={`w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ${
          rank <= 3 ? (typeTab === 'creator' ? 'ring-2 ring-amber-400 ring-offset-1' : 'ring-2 ring-violet-400 ring-offset-1') : 'ring-2 ring-gray-100'
        }`}>
          {entry.avatar_url
            ? <img src={safeMediaUrl(entry.avatar_url)} alt={entry.nickname} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-[11px] font-black text-gray-500">{entry.nickname?.[0]?.toUpperCase()}</span>
              </div>
          }
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-xs font-black truncate flex items-center gap-0.5 min-w-0 ${isMe ? 'text-lime-700' : 'text-[#22282E]'}`}>
              {isMe && <span className="text-lime-500 mr-1 text-[9px] shrink-0">나</span>}
              <span className="truncate">{entry.nickname}</span>
              <FeaturedBadgeSpan badgeId={entry.featured_badge} />
            </p>
          </div>
          <TierBadge
            profile={entry}
            rankInfo={entry._tierRankInfo ?? { ...EMPTY_TIER_RANK_INFO }}
            variant="compact"
            className="!text-[9px] mt-0.5"
          />
        </div>
      </div>

      {/* Creator: 투표받은 수 / Voter: 적중률 */}
      <div className="flex-1 text-center hidden sm:block">
        {isCreator
          ? <span className="text-xs font-bold text-gray-600">{formatNumber(creatorStat)}표</span>
          : hitRate !== null
            ? <span className={`text-xs font-black ${hitRate >= 70 ? 'text-emerald-500' : hitRate >= 50 ? 'text-[#22282E]' : 'text-gray-400'}`}>{hitRate}%</span>
            : <span className="text-[10px] text-gray-300">-</span>
        }
      </div>

      {/* Creator: 생성 수 / Voter: 적중P */}
      <div className="flex-1 text-center hidden md:block">
        {isCreator
          ? <span className="text-xs font-bold text-gray-500">{entry.total_matchups || 0}개</span>
          : <span className="text-xs font-bold text-violet-600">{formatNumber(oracleP)}P</span>
        }
      </div>

      {/* 상단 정렬 옵션에 연동된 값 컬럼 */}
      <div className="flex-1 text-right">
        {sortBy === 'points' && (
          <>
            <span className="text-xs font-black text-[#22282E] tabular-nums">{formatNumber(entry.points || 0)}</span>
            <span className="text-[9px] text-gray-400 ml-0.5">P</span>
          </>
        )}
        {sortBy === 'votes' && (
          <>
            <span className="text-xs font-black text-[#22282E] tabular-nums">{formatNumber(creatorStat)}</span>
            <span className="text-[9px] text-gray-400 ml-0.5">표</span>
          </>
        )}
        {sortBy === 'hitrate' && (
          hitRate !== null
            ? <span className={`text-xs font-black tabular-nums ${hitRate >= 70 ? 'text-emerald-500' : hitRate >= 50 ? 'text-[#22282E]' : 'text-gray-400'}`}>{hitRate}%</span>
            : <span className="text-[10px] text-gray-300">-</span>
        )}
      </div>

      <div className="w-8 flex items-center justify-end flex-shrink-0">
        <ChangeBadge change={entry._change} />
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export function RankingPage() {
  const { user, profile } = useAuthStore()
  const { openCreateDrawer, openLoginModal } = useUIStore()

  const [category,  setCategory]  = useState('all')
  const [period,    setPeriod]    = useState('weekly')
  const [typeTab,   setTypeTab]   = useState('creator')
  const [sortBy,    setSortBy]    = useState('points')
  const [lnbOpen,   setLnbOpen]   = useState(false)  // 모바일 LNB

  const [rankings,     setRankings]     = useState([])
  const [myRank,       setMyRank]       = useState(null)
  const [hallOfFameUsers, setHallOfFameUsers] = useState({ champion: [], oracle: [] })
  const [loading,      setLoading]      = useState(true)
  const [page,         setPage]         = useState(0)
  const [totalCount,   setTotalCount]   = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const celebrationAutoOpenRef = useRef(false)
  const [mobileTabCategoryIds, setMobileTabCategoryIds] = useState(getInitialMobileTabCategoryIds)
  const [catNavTick, setCatNavTick] = useState(0)

  const rankingCategories = useMemo(() => {
    void catNavTick
    try {
      return getRankingCategoryNavItems()
    } catch {
      return [{ id: 'all', icon: '🏆', label: '전체 랭킹' }]
    }
  }, [catNavTick])

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
    const ids = new Set(rankingCategories.map((c) => c.id))
    if (!ids.has(category)) setCategory('all')
  }, [rankingCategories, category])

  const PAGE_SIZE = 20

  // typeTab 변경 시 sortBy를 해당 트랙의 기본값으로 초기화
  useEffect(() => {
    setSortBy('points')
  }, [typeTab])

  useEffect(() => {
    setRankings([])
    setPage(0)
    setTotalCount(0)
    setMyRank(null)
  }, [category, period, typeTab, sortBy])

  useEffect(() => { loadRankings() }, [category, period, typeTab, sortBy, page])

  // 명예의 전당 (트랙별 TOP 3) — 공개 랭킹 후보만 (eligibleIds는 loadRankings·캐시와 공유)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const eligibleIds = await getRankingEligibleProfileIds()
        if (cancelled) return
        if (Array.isArray(eligibleIds) && eligibleIds.length === 0) {
          setHallOfFameUsers({ champion: [], oracle: [] })
          return
        }
        let baseCh = supabase
          .from('profiles')
          .select('id, nickname, avatar_url, points, total_votes_received, featured_badge')
          .order('total_votes_received', { ascending: false })
          .limit(3)
        let baseOr = supabase
          .from('profiles')
          .select('id, nickname, avatar_url, points, vote_hits, vote_total, hit_rate, featured_badge')
          .gte('vote_total', 1)
          .order('hit_rate', { ascending: false })
          .limit(3)
        if (eligibleIds?.length) {
          baseCh = baseCh.in('id', eligibleIds)
          baseOr = baseOr.in('id', eligibleIds)
        }
        const [creators, voters] = await Promise.all([baseCh, baseOr])
        if (cancelled) return
        setHallOfFameUsers({
          champion: creators.data || [],
          oracle: voters.data || [],
        })
      } catch (_) {
        if (cancelled) return
        const { data } = await supabase
          .from('profiles')
          .select('id, nickname, avatar_url, points, total_votes_received, featured_badge')
          .order('total_votes_received', { ascending: false })
          .limit(3)
        setHallOfFameUsers({ champion: data || [], oracle: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 모바일 가로 탭: 전체 매치업 누적 집계 상위 3 카테고리 (캐시는 KST 당일 단위) */
  useEffect(() => {
    if (readMobileTabCache()?.ids?.length === 3) return
    const validIds = rankingCategories.map((c) => c.id).filter((id) => id !== 'all')
    let cancelled = false
    ;(async () => {
      const ids = await fetchTopMobileTabCategoryIds(validIds)
      if (cancelled) return
      setMobileTabCategoryIds(ids)
      writeMobileTabCache(ids)
    })()
    return () => { cancelled = true }
  }, [rankingCategories])

  const mobileRankingTabIds = useMemo(
    () => ['all', ...mobileTabCategoryIds],
    [mobileTabCategoryIds]
  )

  // TOP 10 축하 모달: 당일 1회 · 플랫폼·본인 투표 활동 있을 때만
  useEffect(() => {
    if (!user?.id) celebrationAutoOpenRef.current = false
  }, [user?.id])

  useEffect(() => {
    if (!shouldOfferRankingCelebration({ user, profile, myRank, platformActive: true })) return
    if (celebrationAutoOpenRef.current) return

    let cancelled = false
    let timer = null

    ;(async () => {
      const platformActive = await platformHasRankingCelebrationContext()
      if (cancelled || !platformActive) return
      if (!shouldOfferRankingCelebration({ user, profile, myRank, platformActive })) return
      if (celebrationAutoOpenRef.current) return

      timer = setTimeout(() => {
        if (cancelled || celebrationAutoOpenRef.current) return
        celebrationAutoOpenRef.current = true
        markRankingCelebrationSeenThisLogin(user)
        setShowCelebration(true)
      }, 800)
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [myRank, user, profile])

  const loadRankings = async () => {
    const cacheKey = `ranking_${RANKING_ELIGIBLE_CACHE_TAG}_${RANKING_ROWS_CACHE_VER}_${category}_${typeTab}_${sortBy}_${page}`
    const cached = getCachedRanking(cacheKey)
    if (cached?.data) {
      const { rows, total } = cached.data
      setRankings(rows || [])
      let cachedMyRank = 'myRank' in cached.data ? cached.data.myRank : null
      if (cachedMyRank && user?.id && String(cachedMyRank.data?.id) !== String(user.id)) {
        cachedMyRank = null
      }
      setMyRank(cachedMyRank)
      setTotalCount(typeof total === 'number' ? total : 0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const eligibleIds = await getRankingEligibleProfileIds()
      /** RPC 배포되어 후보 목록만 있을 때: 리스트 비면 랭킹 없음 */
      if (Array.isArray(eligibleIds) && eligibleIds.length === 0) {
        setRankings([])
        setTotalCount(0)
        setMyRank(null)
        setCachedRanking(cacheKey, { rows: [], myRank: null, total: 0 })
        return
      }

      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const isCreator = typeTab === 'creator'
      const orderCol = sortBy === 'votes' ? 'total_votes_received' : sortBy === 'hitrate' ? 'hit_rate' : 'points'
      const selectCols = 'id, nickname, avatar_url, points, total_matchups, total_votes_received, creator_wins, creator_win_streak, vote_hits, vote_total, oracle_points, hit_rate, featured_badge'

      let query = supabase
        .from('profiles')
        .select(selectCols, { count: 'exact' })
        .order(orderCol, { ascending: false, nullsFirst: false })
        .range(from, to)

      if (eligibleIds?.length) query = query.in('id', eligibleIds)
      if (!isCreator && orderCol === 'hit_rate') query = query.gte('vote_total', 1)

      const { data, count } = await query
      const rows = data || []
      const total = count ?? 0

      let rowsWithTier = rows
      const tierPromise =
        rows.length > 0
          ? fetchCreatorRankMapForIds(rows.map((r) => String(r.id)))
          : Promise.resolve({})

      const [rawTier, rowsRanked] = await Promise.all([
        tierPromise,
        attachCompetitionRanksForPage(rows, { orderCol, eligibleIds, isCreator }),
      ])

      if (rows.length > 0) {
        const tierByLower = {}
        for (const [pid, info] of Object.entries(rawTier)) {
          tierByLower[String(pid).toLowerCase()] = info
        }
        rowsWithTier = rowsRanked.map((r) => {
          const idKey = String(r.id).toLowerCase()
          return {
            ...r,
            _tierRankInfo: tierByLower[idKey] ? { ...tierByLower[idKey] } : { ...EMPTY_TIER_RANK_INFO },
          }
        })
      } else {
        rowsWithTier = rowsRanked
      }

      setRankings(rowsWithTier)
      setTotalCount(total)

      const uidStr = user?.id ? String(user.id) : ''
      const userExcluded =
        Boolean(uidStr) && Boolean(eligibleIds?.length) && !eligibleIds.includes(uidStr)

      let savedMyRank = null
      if (user?.id && profile) {
        if (userExcluded) {
          savedMyRank = null
          setMyRank(null)
        } else {
          const myIdx = rowsWithTier.findIndex((r) => String(r.id) === uidStr)
          if (myIdx !== -1) {
            savedMyRank = {
              rank: rowsWithTier[myIdx]._displayRank ?? from + myIdx + 1,
              data: rowsWithTier[myIdx],
            }
          } else if (page === 0) {
            const myVal =
              profile[orderCol] ??
              (orderCol === 'hit_rate' && profile.vote_total > 0
                ? ((profile.vote_hits || 0) / (profile.vote_total || 1)) * 100
                : 0)
            let countQuery = supabase.from('profiles').select('id', { count: 'exact', head: true }).gt(orderCol, myVal)
            if (eligibleIds?.length) countQuery = countQuery.in('id', eligibleIds)
            if (!isCreator && orderCol === 'hit_rate') countQuery = countQuery.gte('vote_total', 1)
            const [{ count: above }, rawMyTier] = await Promise.all([
              countQuery,
              fetchCreatorRankMapForIds([uidStr]),
            ])
            let myTierInfo = { ...EMPTY_TIER_RANK_INFO }
            for (const [k, v] of Object.entries(rawMyTier)) {
              if (String(k).toLowerCase() === uidStr.toLowerCase()) {
                myTierInfo = { ...v }
                break
              }
            }
            savedMyRank = {
              rank: (above || 0) + 1,
              data: { ...profile, _change: null, _tierRankInfo: myTierInfo },
            }
          }
          if (savedMyRank) setMyRank(savedMyRank)
        }
      }

      setCachedRanking(cacheKey, { rows: rowsWithTier, myRank: savedMyRank, total })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => { user ? openCreateDrawer() : openLoginModal() }

  const activeCat = rankingCategories.find((c) => c.id === category)
  const top3      = [rankings[1], rankings[0], rankings[2]]

  // ── LNB 내용 (공통) ────────────────────────────────────────────────
  const LNBContent = () => (
    <div className="space-y-1">
      {/* 랭킹 센터 헤더 */}
      <div className="px-3 py-3 mb-1">
        <p className="text-xs font-black text-pink-400 uppercase tracking-widest">랭킹 센터</p>
      </div>

      {/* 전체 랭킹 */}
      <button
        onClick={() => { setCategory('all') }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
          category === 'all' ? LNB_ROW_ON : LNB_ROW_OFF
        }`}
      >
        <span>🏆</span>전체 랭킹
      </button>

      {/* 카테고리별 */}
      <div>
        <p className="px-3 py-2 text-[10px] font-black text-pink-400 uppercase tracking-widest flex items-center gap-1">
          <ChevronRight size={10} />카테고리별
        </p>
        {rankingCategories.filter((c) => c.id !== 'all').map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setCategory(cat.id) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
              category === cat.id ? LNB_ROW_ON : LNB_ROW_OFF
            }`}
            style={
              cat.pointColor && category !== cat.id
                ? { borderLeft: `3px solid ${cat.pointColor}` }
                : undefined
            }
          >
            {cat.iconImageUrl ? (
              <img src={cat.iconImageUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
            ) : cat.icon ? (
              <span className="shrink-0 text-base leading-none">{cat.icon}</span>
            ) : null}
            <span className="min-w-0 truncate">{cat.label}</span>
            {category === cat.id && <ChevronRight size={12} className="ml-auto shrink-0" />}
          </button>
        ))}
      </div>

      {/* 명예의 전당 (트랙별 TOP 3) */}
      <div className="mt-4 pt-4 border-t border-pink-100/60">
        <p className="px-3 py-2 text-[10px] font-black text-pink-400 uppercase tracking-widest flex items-center gap-1">
          <Flame size={10} className="text-orange-400" />명예의 전당
        </p>
        {hallOfFameUsers?.champion?.length > 0 || hallOfFameUsers?.oracle?.length > 0 ? (
          <div className="space-y-3">
            <div>
              <p className="px-3 py-1 text-[9px] font-bold text-amber-600">👑 Champion</p>
              {(hallOfFameUsers.champion || []).map((u, i) => (
                <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-amber-50/50 transition-colors">
                  <span className="text-xs font-black text-amber-500 w-5">{['🥇','🥈','🥉'][i]}</span>
                  <Avatar src={u.avatar_url} alt={u.nickname} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-fuchsia-900/80 truncate flex items-center gap-0.5">
                      <span className="truncate">{u.nickname || '사용자'}</span>
                      <FeaturedBadgeSpan badgeId={u.featured_badge} />
                    </p>
                    <span className="text-[10px] text-fuchsia-400/90">{formatNumber(u.total_votes_received || 0)}표</span>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="px-3 py-1 text-[9px] font-bold text-violet-600">🔮 Oracle</p>
              {(hallOfFameUsers.oracle || []).map((u, i) => (
                <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-violet-50/50 transition-colors">
                  <span className="text-xs font-black text-violet-500 w-5">{['🥇','🥈','🥉'][i]}</span>
                  <Avatar src={u.avatar_url} alt={u.nickname} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-fuchsia-900/80 truncate flex items-center gap-0.5">
                      <span className="truncate">{u.nickname || '사용자'}</span>
                      <FeaturedBadgeSpan badgeId={u.featured_badge} />
                    </p>
                    <span className="text-[10px] text-fuchsia-400/90">{calcHitRate(u.vote_hits, u.vote_total) !== null ? `${calcHitRate(u.vote_hits, u.vote_total)}% 적중` : '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="px-3 text-xs text-fuchsia-400/90">데이터 로딩 중…</p>
        )}
      </div>

      {/* 매치업 생성 버튼 */}
      <div className="pt-4">
        <button
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] text-sm font-black rounded-2xl hover:shadow-md hover:shadow-lime-200 active:scale-95 transition-all"
        >
          <Plus size={15} />매치업 생성
        </button>
      </div>
    </div>
  )

  return (
    <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>

      {/* ── 페이지 타이틀 (모바일) ── */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
            <span className="text-base">🏆</span>
          </div>
          <h1 className="text-lg font-black text-[#22282E]">RANKING</h1>
        </div>
        <button onClick={() => setLnbOpen(true)}
          className="p-2 rounded-xl border border-pink-100/70 bg-gradient-to-br from-white to-pink-50/50 text-fuchsia-700 hover:bg-white shadow-sm shadow-pink-100/40">
          <Menu size={18} />
        </button>
      </div>

      {/* ── 모바일 카테고리 가로 스크롤 탭 (전체 + 3개만, LNB는 전체 목록) ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none lg:hidden">
        {mobileRankingTabIds.map((id) => {
          const cat = rankingCategories.find((c) => c.id === id)
          if (!cat) return null
          return (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border transition-all',
              category === cat.id
                ? LNB_ROW_ON
                : 'border-pink-100/80 bg-white/90 text-pink-700/90 shadow-sm hover:bg-pink-50/80 hover:shadow-md'
            )}
            style={
              cat.pointColor && category !== cat.id
                ? { borderLeft: `3px solid ${cat.pointColor}` }
                : undefined
            }
            >
              {cat.iconImageUrl ? (
                <img src={cat.iconImageUrl} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
              ) : cat.icon ? (
                <span className="shrink-0 text-sm leading-none">{cat.icon}</span>
              ) : null}
              <span className="truncate">{cat.label}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">

        {/* ════════════════════════════════════════
            LNB (데스크탑 고정 사이드바)
        ════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className={`p-3 sticky top-20 ${MZ_SB}`}>
            <LNBContent />
          </div>
        </aside>

        {/* ════════════════════════════════════════
            메인 콘텐츠
        ════════════════════════════════════════ */}
        <div className="min-w-0">

          {/* 섹션 헤더 */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-black text-[#22282E] flex items-center gap-2">
              {activeCat?.id === 'all' ? (
                <>
                  {activeCat.icon} {activeCat.label}
                </>
              ) : (
                `${activeCat?.label || '전체'} 랭킹`
              )}
              <span className="text-xs font-bold text-gray-400">· {TYPE_OPTIONS.find((t) => t.id === typeTab)?.label}</span>
              <span className="text-[10px] font-medium text-gray-400">· 일 1회 업데이트</span>
            </h2>
            {/* 드롭다운 필터 3종 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Dropdown
                label="기간"
                options={PERIOD_OPTIONS}
                value={period}
                onChange={setPeriod}
              />
              <Dropdown
                label="트랙"
                options={TYPE_OPTIONS}
                value={typeTab}
                onChange={setTypeTab}
              />
              <Dropdown
                label="정렬"
                options={typeTab === 'creator' ? CREATOR_SORT_OPTIONS : VOTER_SORT_OPTIONS}
                value={sortBy}
                onChange={setSortBy}
              />
            </div>
          </div>

          {/* TOP 3 포디움 */}
          {rankings.length >= 3 && (
            <Podium users={top3} category={category} typeTab={typeTab} sortBy={sortBy} categories={rankingCategories} />
          )}

          {/* 순위 테이블 (LNB와 별도 — 일반 카드) */}
          <div className="rounded-2xl border border-violet-100/80 bg-white/95 shadow-sm shadow-violet-100/20 overflow-hidden mb-4">

            {/* 테이블 헤더 */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-violet-100/35 border-b border-violet-200/40 text-[10px] font-black text-violet-600/80 uppercase tracking-wider">
              <div className="w-7 sm:w-8 text-center flex-shrink-0">#</div>
              <div className="flex-[2]">유저</div>
              <div className="flex-1 text-center hidden sm:block">
                {typeTab === 'creator' ? '투표받은 수' : '적중률'}
              </div>
              <div className="flex-1 text-center hidden md:block">
                {typeTab === 'creator' ? '생성' : '적중P'}
              </div>
              <div className="flex-1 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">
                {sortBy === 'points' ? '포인트' : sortBy === 'votes' ? '투표받은 수' : '적중률'}
              </div>
              <div className="w-8 text-right flex-shrink-0">변동</div>
            </div>

            {loading && rankings.length === 0
              ? Array.from({ length: 10 }).map((_, i) => <RankRowSkeleton key={i} />)
              : (
                <>
                  {rankings.map((entry) => (
                    <RankRow
                      key={entry.id}
                      entry={entry}
                      rank={entry._displayRank ?? 0}
                      isMe={entry.id === user?.id}
                      typeTab={typeTab}
                      sortBy={sortBy}
                    />
                  ))}
                </>
              )}

            {loading && (
              <div className="py-6 flex items-center justify-center gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#22282E] rounded-full animate-spin" />
                <span className="text-xs">불러오는 중…</span>
              </div>
            )}
            {rankings.length === 0 && !loading && (
              <div className="py-14 text-center">
                <p className="text-3xl mb-2">🏆</p>
                <p className="text-sm font-bold text-gray-400">아직 랭킹 데이터가 없어요</p>
              </div>
            )}
          </div>

          {/* ── 페이지네이션 ── */}
          {totalCount > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(totalCount / PAGE_SIZE)
            const getPageNums = () => {
              const pages = []
              const delta = 2
              const left = Math.max(0, page - delta)
              const right = Math.min(totalPages - 1, page + delta)
              if (left > 0) { pages.push(0); if (left > 1) pages.push('…') }
              for (let i = left; i <= right; i++) pages.push(i)
              if (right < totalPages - 1) { if (right < totalPages - 2) pages.push('…'); pages.push(totalPages - 1) }
              return pages
            }
            const goTo = (p) => {
              setPage(p)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
            return (
              <div className="flex items-center justify-center gap-1.5 mt-4 mb-2 flex-wrap">
                <button
                  onClick={() => goTo(page - 1)}
                  disabled={page === 0 || loading}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-violet-200 bg-white text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-50 transition-colors"
                >
                  ← 이전
                </button>
                {getPageNums().map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goTo(p)}
                      disabled={loading}
                      className={cn(
                        'w-8 h-8 rounded-xl text-xs font-black border transition-colors',
                        p === page
                          ? 'bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-200 border-fuchsia-300 text-fuchsia-900 shadow-sm'
                          : 'border-violet-100 bg-white text-gray-600 hover:bg-violet-50'
                      )}
                    >
                      {p + 1}
                    </button>
                  )
                )}
                <button
                  onClick={() => goTo(page + 1)}
                  disabled={page >= totalPages - 1 || loading}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-violet-200 bg-white text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-50 transition-colors"
                >
                  다음 →
                </button>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ════════════════════════════════════════
          내 랭킹 Sticky Bar (하단 고정)
      ════════════════════════════════════════ */}
      {user && myRank && (
        <div className={cn('fixed bottom-16 left-0 right-0 z-30 mx-auto px-3 pointer-events-none lg:bottom-4', LAYOUT_CONTENT_MAX_WIDTH_CLASS)}>
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-lime-200 rounded-2xl shadow-xl shadow-lime-100/50 px-4 py-3 flex items-center gap-3">
            {/* 내 위치 */}
            <div className="flex-shrink-0 text-center">
              <p className="text-[9px] text-gray-400 font-bold">내 순위</p>
              <p className="text-lg font-black text-lime-600 leading-none">{myRank.rank}<span className="text-xs font-bold text-gray-400 ml-0.5">위</span></p>
            </div>
            <div className="w-px h-10 bg-lime-100 flex-shrink-0" />

            {/* 아바타 + 정보 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-lime-300 flex-shrink-0">
                {profile?.avatar_url
                  ? <img src={safeMediaUrl(profile.avatar_url)} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-lime-100 flex items-center justify-center">
                      <span className="text-xs font-black text-lime-600">{profile?.nickname?.[0]?.toUpperCase()}</span>
                    </div>
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-lime-700 truncate flex items-center gap-0.5">
                  <span className="truncate">{profile?.nickname}</span>
                  <FeaturedBadgeSpan badgeId={profile?.featured_badge} />
                </p>
                <p className="text-[10px] text-gray-500">
                  {formatNumber(profile?.points || 0)}P
                  {typeTab === 'creator'
                    ? (profile?.total_votes_received > 0 && <span className="ml-2 text-amber-500 font-bold">{formatNumber(profile.total_votes_received)}표</span>)
                    : calcHitRate(profile?.vote_hits, profile?.vote_total) !== null && (
                        <span className="ml-2 text-violet-500 font-bold">적중률 {calcHitRate(profile.vote_hits, profile.vote_total)}%</span>
                      )
                  }
                </p>
              </div>
            </div>

            {/* 상위 n명과 격차 */}
            {myRank.rank > 1 && rankings[myRank.rank - 2] && (
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className="text-[9px] text-gray-400">위 순위와의 격차</p>
                <p className="text-xs font-black text-orange-500">
                  -{formatNumber((rankings[myRank.rank - 2]?.points || 0) - (profile?.points || 0))}P
                </p>
              </div>
            )}

            {/* TOP 10이면 축하 카드 재표시 버튼 */}
            {myRank.rank <= 10 && profileHasRankingEngagement(profile) && (
              <button
                onClick={() => {
                  if (user) clearRankingCelebrationSeenThisLogin(user)
                  setShowCelebration(true)
                }}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,#a855f7,#ec4899)', boxShadow: '0 2px 12px rgba(168,85,247,0.4)' }}
              >
                🎉 카드
              </button>
            )}

          </div>
        </div>
      )}

      {/* ── 모바일 LNB 드로어 ── */}
      {lnbOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gradient-to-br from-fuchsia-900/25 via-violet-900/20 to-pink-900/25 backdrop-blur-md backdrop-saturate-150"
            onClick={() => setLnbOpen(false)}
            aria-hidden
          />
          <div
            className={`fixed top-0 left-0 bottom-0 z-50 w-[min(18rem,90vw)] max-w-[18rem] shadow-2xl shadow-gray-200/35 overflow-y-auto rounded-none rounded-r-2xl ${MZ_SB}`}
            style={{ animation: 'fade-in-up 0.25s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-pink-100/60">
              <p className="font-black text-fuchsia-600">🏆 랭킹 센터</p>
              <button type="button" onClick={() => setLnbOpen(false)} className="p-1.5 rounded-xl text-pink-400 hover:bg-white/80 transition-colors">
                <X size={18} className="text-pink-300" />
              </button>
            </div>
            <div className="p-3">
              <LNBContent />
            </div>
          </div>
        </>
      )}

      {/* ── TOP 10 축하 모달 ── */}
      {showCelebration && myRank && profile && profileHasRankingEngagement(profile) && (
        <RankingCelebrationModal
          rank={myRank.rank}
          nickname={profile?.nickname}
          avatar_url={profile?.avatar_url}
          points={profile?.points}
          period={period}
          typeTab={typeTab}
          sortBy={sortBy}
          userId={user?.id ?? null}
          top1={rankings[0] || null}
          profile={profile}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  )
}
