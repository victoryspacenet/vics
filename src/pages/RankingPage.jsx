import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronDown,
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
import { FoundingMemberBadge } from '../components/profile/FoundingMemberBadge'
import { TierBadge } from '../components/ui/TierBadge'
import {
  getInitialMobileTabCategoryIds,
  readMobileTabCache,
  writeMobileTabCache,
  fetchTopMobileTabCategoryIds,
} from '../lib/rankingMobileTabs'
import { getRankingCategoryNavItems } from '../lib/categoryAdminStorage'
import { getRankingEligibleProfileIds, RANKING_ELIGIBLE_CACHE_TAG } from '../lib/rankingEligibleProfiles'
import { getOracleRankingCandidateIds } from '../lib/rankingOracleCandidates'
import { fetchCreatorRankMapForIds, EMPTY_TIER_RANK_INFO } from '../lib/creatorRankSnapshot'
import {
  hasAutoShownRankingCelebrationPopup,
  markRankingCelebrationPopupSeen,
  platformHasRankingCelebrationContext,
  profileHasRankingEngagement,
  shouldOfferRankingCelebration,
} from '../lib/rankingCelebrationEligibility'
import { attachCompetitionRanksForPage } from '../lib/rankingCompetitionRank'
import {
  RANKING_PROFILE_SELECT,
  getRankingPageSortConfig,
  calcRankingHitRate,
  getRankingSortValue,
  applyRankingQueryFilters,
  getRankingOrderColFallback,
  isMissingTrackPointsColumnError,
  formatRankingPrimaryMetric,
  formatRankingSortGap,
} from '../lib/rankingPageSort'
import {
  fetchRankingLeaderboardPage,
  mapCategoryRankingRows,
  mapCategoryMyRank,
  isMissingCategoryRankingRpcError,
} from '../lib/rankingCategoryLeaderboard'
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

/** 명예의 전당 LNB — 트랙별 누적 P TOP 3 */
const HOF_CHAMPION_SORT = getRankingPageSortConfig('creator', 'points')
const HOF_ORACLE_SORT = getRankingPageSortConfig('voter', 'points')

const RANKING_ROWS_CACHE_VER = 't8-period-rank'
/** 웹(lg+) 랭킹 리스트·포디움 가로 폭 — 3열 테이블에 맞춤 */
const RANKING_LEADERBOARD_WIDTH_CLASS = 'w-full lg:max-w-2xl lg:mx-auto'

const MZ_SB =
  'rounded-2xl border border-amber-100/70 bg-gradient-to-b from-white via-amber-50/25 to-yellow-50/15 shadow-[0_4px_24px_-8px_rgba(251,191,36,0.14)]'

const LNB_ROW_ON =
  'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black shadow-[0_4px_14px_-2px_rgba(251,146,60,0.5)] ring-1 ring-white/30'
const LNB_ROW_OFF =
  'text-amber-800/80 hover:text-amber-900 hover:bg-amber-50/70 hover:shadow-sm'

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
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border border-amber-200/70 bg-gradient-to-br from-white to-amber-50/60 text-amber-900 shadow-sm shadow-amber-100/50 hover:bg-amber-50 hover:border-amber-300/70 transition-colors"
      >
        {selected?.label || label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 rounded-xl border border-amber-200/60 bg-gradient-to-b from-white to-amber-50/60 shadow-lg shadow-amber-200/30 z-[60] min-w-[120px] overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                value === opt.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  : 'text-amber-900/80 bg-transparent hover:bg-amber-50/80'
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

// ── 적중률 (The Oracle 보조 표시)
function calcHitRate(hits, total) {
  return calcRankingHitRate(hits, total)
}

// ── TOP 3 포디움 ─────────────────────────────────────────────────────
function Podium({ users, category, sortConfig, categories }) {
  if (!users || users.filter(Boolean).length < 1) return null
  const [second, first, third] = [users[1], users[0], users[2]]
  const catLabel = categories.find((c) => c.id === category)
  const typeOpt = TYPE_OPTIONS.find((t) => t.id === (sortConfig.isCreator ? 'creator' : 'voter'))

  return (
    <div className="relative bg-gradient-to-b from-amber-50/80 via-orange-50/50 to-rose-50/40 rounded-3xl border border-amber-200/50 shadow-[0_4px_24px_-8px_rgba(251,146,60,0.2)] px-4 pt-5 pb-0 mb-4 overflow-hidden">
      {/* 상단 골드 라인 */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-rose-400 rounded-t-3xl" />
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_4px_14px_-2px_rgba(251,146,60,0.55)]">
            <Flame size={17} className="text-white" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-base font-black leading-none bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              TOP 3 {typeOpt?.label || ''}{catLabel && catLabel.id !== 'all' ? ` ${catLabel.label}` : ''} 랭커
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/80">TOP RANKED</p>
          </div>
        </div>
        <span className="rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 shadow-sm">
          👑 TOP 3
        </span>
      </div>
      <div className="flex items-end justify-center gap-1">
        <PodiumCard user={second} podiumSlot={2} displayRank={second?._displayRank} sortConfig={sortConfig} />
        <PodiumCard user={first}  podiumSlot={1} displayRank={first?._displayRank} sortConfig={sortConfig} />
        <PodiumCard user={third}  podiumSlot={3} displayRank={third?._displayRank} sortConfig={sortConfig} />
      </div>
    </div>
  )
}

function PodiumCard({ user: u, podiumSlot, displayRank, sortConfig }) {
  if (!u) return <div className="flex-1" />
  const slot = [1, 2, 3].includes(podiumSlot) ? podiumSlot : 3
  const cfg   = {
    1: { base: 'h-24',   gradient: 'from-amber-400 to-yellow-500', ring: 'ring-2 ring-amber-400', av: 'w-16 h-16', medal: '🥇', textColor: 'text-amber-600' },
    2: { base: 'h-16',   gradient: 'from-slate-300 to-gray-400',   ring: 'ring-2 ring-gray-300',  av: 'w-12 h-12', medal: '🥈', textColor: 'text-slate-500' },
    3: { base: 'h-12',   gradient: 'from-orange-300 to-amber-500', ring: 'ring-2 ring-orange-300', av: 'w-12 h-12', medal: '🥉', textColor: 'text-orange-500' },
  }[slot]

  const statLabel = formatRankingPrimaryMetric(u, sortConfig, formatNumber)
  const rankLabel = displayRank != null && displayRank > 0 ? displayRank : slot

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
        <FeaturedBadgeSpan profile={u} rankInfo={u._tierRankInfo} />
        <FoundingMemberBadge profile={u} size={11} />
      </p>
      <TierBadge
        profile={u}
        rankInfo={u._tierRankInfo ?? { ...EMPTY_TIER_RANK_INFO }}
        variant="compact"
        className="!text-[9px]"
      />
      <p className={`text-xs font-black ${cfg.textColor}`}>{statLabel}</p>
      <div className={`w-full ${cfg.base} bg-gradient-to-b ${cfg.gradient} rounded-t-xl flex items-start justify-center pt-2`}>
        <span className="text-xs font-black text-white/90">{rankLabel}위</span>
      </div>
    </div>
  )
}

// ── 순위 행 스켈레톤 ───────────────────────────────────────────────────
function RankRowSkeleton() {
  return (
    <div className="grid grid-cols-12 items-center gap-2 px-3 sm:px-4 py-3 border-b border-amber-100/40 last:border-0 animate-pulse">
      <div className="col-span-1 h-5 bg-amber-100/60 rounded mx-auto w-6" />
      <div className="col-span-8 flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-full bg-amber-100/60 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="h-3.5 w-20 bg-amber-100/60 rounded" />
          <div className="h-2.5 w-14 bg-orange-100/50 rounded" />
        </div>
      </div>
      <div className="col-span-3 flex justify-end">
        <div className="h-3.5 w-12 bg-amber-100/60 rounded" />
      </div>
    </div>
  )
}

// ── 순위 테이블 행 ───────────────────────────────────────────────────
function RankRow({ entry, rank, isMe, typeTab, sortConfig }) {
  const primaryLabel = formatRankingPrimaryMetric(entry, sortConfig, formatNumber)
  const hitRate = sortConfig.kind === 'hit_rate' ? getRankingSortValue(entry, sortConfig) : null

  const isTop3 = rank <= 3
  const top3BgMap = {
    1: 'bg-gradient-to-r from-amber-50/90 to-yellow-50/60',
    2: 'bg-gradient-to-r from-slate-50/90 to-gray-50/60',
    3: 'bg-gradient-to-r from-orange-50/80 to-amber-50/50',
  }
  const top3BorderMap = {
    1: 'border-l-amber-400',
    2: 'border-l-slate-300',
    3: 'border-l-orange-400',
  }

  return (
    <div className={cn(
      'grid grid-cols-12 items-center gap-2 px-3 sm:px-4 py-3 border-b border-amber-100/40 last:border-0 transition-colors',
      isMe
        ? 'bg-lime-50/80 border-l-[3px] border-l-lime-400'
        : isTop3
          ? cn(top3BgMap[rank], 'border-l-[3px]', top3BorderMap[rank])
          : 'hover:bg-amber-50/40'
    )}>
      <div className="col-span-1 text-center flex-shrink-0">
        {rank <= 3
          ? <span className="text-base">{['🥇','🥈','🥉'][rank - 1]}</span>
          : <span className="text-xs font-black text-gray-400 tabular-nums">{rank}</span>
        }
      </div>

      <div className="col-span-8 flex items-center gap-2 min-w-0">
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
              <FeaturedBadgeSpan profile={entry} rankInfo={entry._tierRankInfo} />
              <FoundingMemberBadge profile={entry} size={11} />
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

      <div className="col-span-3 text-right">
        <span className={`text-xs font-black tabular-nums ${
          sortConfig.kind === 'hit_rate' && hitRate != null && hitRate >= 70 ? 'text-emerald-500'
            : sortConfig.kind === 'hit_rate' && hitRate != null && hitRate > 0 && hitRate < 50 ? 'text-gray-400'
              : 'text-[#22282E]'
        }`}>
          {primaryLabel}
        </span>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export function RankingPage() {
  const { user, profile } = useAuthStore()
  const { openCreateDrawer, openLoginModal } = useUIStore()

  const [category,  setCategory]  = useState('all')
  const [period,    setPeriod]    = useState('all')
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
  const sortConfig = useMemo(() => getRankingPageSortConfig(typeTab, sortBy), [typeTab, sortBy])

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
          .select('id, nickname, avatar_url, champion_points, featured_badge, founding_member_number')
          .order('champion_points', { ascending: false })
          .limit(3)
        let baseOr = supabase
          .from('profiles')
          .select('id, nickname, avatar_url, oracle_points, featured_badge, founding_member_number')
          .order('oracle_points', { ascending: false })
          .limit(3)
        const oracleIds = await getOracleRankingCandidateIds({ eligibleIds })
        if (oracleIds.length) baseOr = baseOr.in('id', oracleIds)
        else baseOr = baseOr.eq('id', '00000000-0000-0000-0000-000000000000')
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
        const [creators, voters] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, nickname, avatar_url, champion_points, featured_badge, founding_member_number')
            .order('champion_points', { ascending: false })
            .limit(3),
          supabase
            .from('profiles')
            .select('id, nickname, avatar_url, oracle_points, featured_badge, founding_member_number')
            .order('oracle_points', { ascending: false })
            .limit(3),
        ])
        if (cancelled) return
        setHallOfFameUsers({
          champion: creators.data || [],
          oracle: voters.data || [],
        })
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

  // TOP 10 축하 모달: 로그인 세션당 1회 · 플랫폼·본인 투표 활동 있을 때만
  useEffect(() => {
    if (!user?.id) celebrationAutoOpenRef.current = false
  }, [user?.id])

  useEffect(() => {
    if (!shouldOfferRankingCelebration({ user, profile, myRank, platformActive: true })) return
    if (celebrationAutoOpenRef.current) return

    let cancelled = false

    ;(async () => {
      if (await hasAutoShownRankingCelebrationPopup(user)) return
      if (cancelled || celebrationAutoOpenRef.current) return

      const platformActive = await platformHasRankingCelebrationContext()
      if (cancelled || !platformActive) return
      if (!shouldOfferRankingCelebration({ user, profile, myRank, platformActive })) return
      if (celebrationAutoOpenRef.current) return

      celebrationAutoOpenRef.current = true
      await markRankingCelebrationPopupSeen(user)
      if (cancelled) return
      setShowCelebration(true)
    })()

    return () => {
      cancelled = true
    }
  }, [myRank?.rank, myRank?.data?.id, user?.id, profile?.id, profile?.total_votes_received, profile?.vote_total])

  const loadRankings = async () => {
    const cacheKey = `ranking_${RANKING_ELIGIBLE_CACHE_TAG}_${RANKING_ROWS_CACHE_VER}_${category}_${period}_${typeTab}_${sortBy}_${page}`
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
      const from = page * PAGE_SIZE

      /** 카테고리·주/월 — point_transactions·votes 집계 RPC */
      if (category !== 'all' || period !== 'all') {
        try {
          const { total, rows, my_rank: rpcMyRank } = await fetchRankingLeaderboardPage({
            categoryId: category !== 'all' ? category : null,
            period,
            typeTab,
            sortBy,
            limit: PAGE_SIZE,
            offset: from,
            userId: user?.id || null,
          })
          const rowsRanked = mapCategoryRankingRows(rows, sortConfig)
          let rowsWithTier = rowsRanked
          if (rowsRanked.length > 0) {
            const rawTier = await fetchCreatorRankMapForIds(rowsRanked.map((r) => String(r.id)))
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
          }

          setRankings(rowsWithTier)
          setTotalCount(total)

          const uidStr = user?.id ? String(user.id) : ''
          const userExcluded =
            Boolean(uidStr) && Boolean(eligibleIds?.length) && !eligibleIds.includes(uidStr)

          let savedMyRank = null
          if (user?.id && profile && !userExcluded) {
            savedMyRank = mapCategoryMyRank(rpcMyRank, sortConfig)
            if (savedMyRank?.data?.id) {
              const rawMyTier = await fetchCreatorRankMapForIds([String(savedMyRank.data.id)])
              let myTierInfo = { ...EMPTY_TIER_RANK_INFO }
              for (const [k, v] of Object.entries(rawMyTier)) {
                if (String(k).toLowerCase() === uidStr.toLowerCase()) {
                  myTierInfo = { ...v }
                  break
                }
              }
              savedMyRank = {
                ...savedMyRank,
                data: { ...savedMyRank.data, _change: null, _tierRankInfo: myTierInfo },
              }
            }
            setMyRank(savedMyRank)
          } else {
            setMyRank(null)
          }

          setCachedRanking(cacheKey, { rows: rowsWithTier, myRank: savedMyRank, total })
          return
        } catch (catErr) {
          if (isMissingCategoryRankingRpcError(catErr)) {
            if (import.meta.env.DEV) {
              console.warn('[RankingPage] ranking leaderboard RPC missing — run supabase_ranking_category_leaderboard.sql')
            }
            setRankings([])
            setTotalCount(0)
            setMyRank(null)
            setCachedRanking(cacheKey, { rows: [], myRank: null, total: 0 })
            return
          }
          throw catErr
        }
      }

      /** RPC 배포되어 후보 목록만 있을 때: 리스트 비면 랭킹 없음 */
      if (Array.isArray(eligibleIds) && eligibleIds.length === 0) {
        setRankings([])
        setTotalCount(0)
        setMyRank(null)
        setCachedRanking(cacheKey, { rows: [], myRank: null, total: 0 })
        return
      }

      const to = from + PAGE_SIZE - 1
      const isCreator = typeTab === 'creator'
      const orderCol = sortConfig.orderCol

      let voterFilterIds = null
      if (!isCreator) {
        voterFilterIds = await getOracleRankingCandidateIds({
          hitrateOnly: sortConfig.kind === 'hit_rate',
          eligibleIds,
        })
        if (voterFilterIds.length === 0) {
          setRankings([])
          setTotalCount(0)
          setMyRank(null)
          setCachedRanking(cacheKey, { rows: [], myRank: null, total: 0 })
          return
        }
      }

      const buildListQuery = (col) => {
        let q = supabase
          .from('profiles')
          .select(RANKING_PROFILE_SELECT, { count: 'exact' })
          .order(col, { ascending: false, nullsFirst: false })
          .order('id', { ascending: true })
          .range(from, to)
        q = applyRankingQueryFilters(q, sortConfig)
        if (voterFilterIds?.length) q = q.in('id', voterFilterIds)
        else if (eligibleIds?.length) q = q.in('id', eligibleIds)
        return q
      }

      let { data, count, error } = await buildListQuery(orderCol)
      if (error && isMissingTrackPointsColumnError(error)) {
        const fallbackCol = getRankingOrderColFallback(sortConfig)
        if (import.meta.env.DEV) {
          console.warn('[RankingPage] track points column missing — fallback order:', fallbackCol)
        }
        ;({ data, count, error } = await buildListQuery(fallbackCol))
      }
      if (error) throw error
      const rows = data || []
      const total = count ?? 0

      let rowsWithTier = rows
      const tierPromise =
        rows.length > 0
          ? fetchCreatorRankMapForIds(rows.map((r) => String(r.id)))
          : Promise.resolve({})

      const [rawTier, rowsRanked] = await Promise.all([
        tierPromise,
        attachCompetitionRanksForPage(rows, { sortConfig, eligibleIds: voterFilterIds ?? eligibleIds, isCreator }),
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
            let myProfile = profile
            const { data: myRow } = await supabase
              .from('profiles')
              .select(RANKING_PROFILE_SELECT)
              .eq('id', uidStr)
              .maybeSingle()
            if (myRow) myProfile = { ...profile, ...myRow }

            const myVal = getRankingSortValue(myProfile, sortConfig)
            const excludedFromOracle =
              !isCreator &&
              voterFilterIds?.length &&
              !voterFilterIds.some((id) => String(id) === uidStr)

            if (!excludedFromOracle) {
              let countQuery = supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .gt(sortConfig.orderCol, myVal)
              countQuery = applyRankingQueryFilters(countQuery, sortConfig)
              const countFilterIds = voterFilterIds ?? eligibleIds
              if (countFilterIds?.length) countQuery = countQuery.in('id', countFilterIds)
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
                data: { ...myProfile, _change: null, _tierRankInfo: myTierInfo },
              }
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
  const top3      = rankings.slice(0, 3)
  const primaryColLabel =
    sortConfig.kind === 'votes' ? '투표받은 수'
      : sortConfig.kind === 'hit_rate' ? '적중률'
        : '포인트'
  const rankAboveMe = myRank?.rank > 1
    ? rankings.find((r) => (r._displayRank ?? 0) === myRank.rank - 1)
    : null
  const myRankProfile = myRank?.data || profile

  // ── LNB 내용 (공통) ────────────────────────────────────────────────
  const LNBContent = () => (
    <div className="space-y-1">
      {/* 랭킹 센터 헤더 */}
      <div className="px-3 py-3 mb-1 border-b border-amber-100/60">
        <p className="text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent uppercase tracking-widest">🏆 랭킹 센터</p>
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
        <p className="px-3 py-2 text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent uppercase tracking-widest flex items-center gap-1">
          <ChevronRight size={10} className="text-amber-500" />카테고리별
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
      <div className="mt-4 pt-4 border-t border-amber-100/60">
        <p className="px-3 py-2 text-[10px] font-black bg-gradient-to-r from-amber-500 to-rose-500 bg-clip-text text-transparent uppercase tracking-widest flex items-center gap-1">
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
                      <FeaturedBadgeSpan profile={u} rankInfo={u._tierRankInfo} />
                      <FoundingMemberBadge profile={u} size={11} />
                    </p>
                    <span className="text-[10px] text-fuchsia-400/90">
                      {formatRankingPrimaryMetric(u, HOF_CHAMPION_SORT, formatNumber)}
                    </span>
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
                      <FeaturedBadgeSpan profile={u} rankInfo={u._tierRankInfo} />
                      <FoundingMemberBadge profile={u} size={11} />
                    </p>
                    <span className="text-[10px] text-fuchsia-400/90">
                      {formatRankingPrimaryMetric(u, HOF_ORACLE_SORT, formatNumber)}
                    </span>
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
    <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto relative')}>
      {/* ── 앰비언트 배경 ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-[480px] w-[480px] rounded-full bg-gradient-radial from-amber-300/12 via-yellow-200/6 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-[360px] w-[360px] rounded-full bg-gradient-radial from-orange-300/9 via-rose-200/4 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[320px] w-[320px] rounded-full bg-gradient-radial from-violet-300/7 via-fuchsia-200/3 to-transparent blur-3xl" />
      </div>

      {/* ── 페이지 타이틀 (모바일) ── */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_4px_14px_-2px_rgba(251,146,60,0.55)]">
            <span className="text-base">🏆</span>
          </span>
          <div>
            <h1 className="text-lg font-black leading-none bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              RANKING
            </h1>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-500/80">LEADERBOARD</p>
          </div>
        </div>
        <button onClick={() => setLnbOpen(true)}
          className="p-2 rounded-xl border border-amber-200/70 bg-gradient-to-br from-white to-amber-50/60 text-amber-700 hover:bg-amber-50 shadow-sm shadow-amber-100/40 transition-colors">
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
                : 'border-amber-200/70 bg-white/90 text-amber-800/80 shadow-sm hover:bg-amber-50/70 hover:shadow-md'
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
        <div className={cn('min-w-0', RANKING_LEADERBOARD_WIDTH_CLASS)}>

          {/* 섹션 헤더 */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_4px_14px_-2px_rgba(251,146,60,0.5)] shrink-0">
                <span className="text-base">🏆</span>
              </span>
              <div>
                <h2 className="text-base font-black leading-none bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                  {activeCat?.id === 'all' ? '전체 랭킹' : `${activeCat?.label || '전체'} 랭킹`}
                  <span className="ml-2 text-xs font-bold text-amber-600/70">
                    · {TYPE_OPTIONS.find((t) => t.id === typeTab)?.label}
                  </span>
                </h2>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-500/70">일 1회 업데이트</p>
              </div>
            </div>
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
            <Podium users={top3} category={category} sortConfig={sortConfig} categories={rankingCategories} />
          )}

          {/* 순위 테이블 */}
          <div className="relative rounded-2xl border border-amber-200/60 bg-gradient-to-br from-white via-amber-50/25 to-white shadow-[0_4px_24px_-8px_rgba(251,146,60,0.18)] overflow-hidden mb-4">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-rose-400" />

            {/* 테이블 헤더 */}
            <div className="grid grid-cols-12 items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-amber-100/50 to-orange-100/30 border-b border-amber-200/40 text-[10px] font-black text-amber-700/80 uppercase tracking-wider mt-[3px]">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-8">유저</div>
              <div className="col-span-3 text-right">{primaryColLabel}</div>
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
                      sortConfig={sortConfig}
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
                <p className="text-4xl mb-3">🏆</p>
                <p className="text-sm font-black bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent mb-1">아직 랭킹 데이터가 없어요</p>
                <p className="text-xs text-amber-400/80">매치업에 참여하면 랭킹에 등록돼요!</p>
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
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-200/70 bg-white text-amber-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-50 transition-colors"
                >
                  ← 이전
                </button>
                {getPageNums().map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-amber-400/70 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goTo(p)}
                      disabled={loading}
                      className={cn(
                        'w-8 h-8 rounded-xl text-xs font-black border transition-colors',
                        p === page
                          ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 border-orange-400 text-white shadow-[0_4px_14px_-2px_rgba(251,146,60,0.45)] scale-110'
                          : 'border-amber-200/60 bg-white text-amber-800/70 hover:bg-amber-50'
                      )}
                    >
                      {p + 1}
                    </button>
                  )
                )}
                <button
                  onClick={() => goTo(page + 1)}
                  disabled={page >= totalPages - 1 || loading}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-200/70 bg-white text-amber-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-50 transition-colors"
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
          <div className="pointer-events-auto bg-gradient-to-r from-white via-lime-50/60 to-emerald-50/40 backdrop-blur-md border border-lime-200/80 rounded-2xl shadow-xl shadow-lime-200/40 px-4 py-3 flex items-center gap-3">
            {/* 내 위치 */}
            <div className="flex-shrink-0 text-center">
              <p className="text-[9px] text-lime-600/70 font-bold uppercase tracking-wide">내 순위</p>
              <p className="text-xl font-black leading-none bg-gradient-to-b from-lime-600 to-emerald-600 bg-clip-text text-transparent">
                {myRank.rank}<span className="text-xs font-bold text-gray-400 ml-0.5">위</span>
              </p>
            </div>
            <div className="w-px h-10 bg-gradient-to-b from-lime-200 to-emerald-200 flex-shrink-0" />

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
                  <FeaturedBadgeSpan profile={profile} rankInfo={profile._tierRankInfo} />
                  <FoundingMemberBadge profile={profile} size={11} />
                </p>
                <p className="text-[10px] text-gray-500">
                  {formatRankingPrimaryMetric(myRankProfile, sortConfig, formatNumber)}
                </p>
              </div>
            </div>

            {/* 상위 n명과 격차 */}
            {rankAboveMe && myRankProfile && (() => {
              const gapLabel = formatRankingSortGap(rankAboveMe, myRankProfile, sortConfig, formatNumber)
              if (!gapLabel) return null
              return (
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-[9px] text-gray-400">위 순위와의 격차</p>
                  <p className="text-xs font-black text-orange-500">-{gapLabel}</p>
                </div>
              )
            })()}

            {/* TOP 10이면 축하 카드 재표시 버튼 */}
            {myRank.rank <= 10 && profileHasRankingEngagement(profile) && (
              <button
                onClick={() => setShowCelebration(true)}
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
            className="fixed inset-0 z-40 bg-gradient-to-br from-amber-900/20 via-orange-900/15 to-rose-900/20 backdrop-blur-md backdrop-saturate-150"
            onClick={() => setLnbOpen(false)}
            aria-hidden
          />
          <div
            className={`fixed top-0 left-0 bottom-0 z-50 w-[min(18rem,90vw)] max-w-[18rem] shadow-2xl shadow-amber-200/30 overflow-y-auto rounded-none rounded-r-2xl ${MZ_SB}`}
            style={{ animation: 'fade-in-up 0.25s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-amber-100/60">
              <p className="font-black bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">🏆 랭킹 센터</p>
              <button type="button" onClick={() => setLnbOpen(false)} className="p-1.5 rounded-xl text-amber-400 hover:bg-amber-50 transition-colors font-bold">
                <X size={18} />
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
