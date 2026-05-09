import { useState, useEffect, useRef } from 'react'
import { UserProfileBlockLink } from '../ui/UserProfileLink'
import { ChevronDown, Crown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatNumber } from '../../lib/utils'
import { safeMediaUrl, encodeForUrl } from '../../lib/sanitize'
import { getCurrentSeason, getRankColumns } from '../../lib/season'
import { getCachedRanking, setCachedRanking } from '../../lib/rankingCache'
import { FeaturedBadgeSpan } from '../ui/FeaturedBadge'

const MODE_TABS = [
  { id: 'all', label: '전체' },
  { id: 'season', label: '시즌' },
]

const GOAT_TABS = [
  { id: 'all', label: '전체 Top10' },
  { id: 'monthly', label: '월간' },
  { id: 'weekly', label: '주간' },
]

/** 기간 탭 클릭 시 열리는 트랙 메뉴 (둘 중 하나만 선택) */
const GOAT_TRACK_MENU_OPTIONS = [
  { id: 'champion', title: 'The Champion', hint: '크리에이터 트랙' },
  { id: 'oracle', title: 'The Oracle', hint: '투표 트랙' },
]

function trackFilterTitle(trackFilter) {
  return trackFilter === 'oracle' ? 'The Oracle' : 'The Champion'
}

function mergeChampionOracleRows(championList, oracleList) {
  const c = (championList || []).map((r) => ({ ...r, goatTrack: 'champion' }))
  const o = (oracleList || []).map((r) => ({ ...r, goatTrack: 'oracle' }))
  return [...c, ...o]
}

/**
 * Goat 랭커 — The Champion / The Oracle 트랙별 전체 Top10 + 이번 달·이번 주 획득 P Top
 * (profiles_goat_period_leaderboard RPC, 서울 기준 주·월 경계; PT 없을 때만 프로필 전체/시즌 Top10 폴백)
 */
export function GoatRankingSection() {
  const [mode, setMode] = useState('all')
  const [activeTab, setActiveTab] = useState('all')
  const [trackFilter, setTrackFilter] = useState('champion')
  const [trackMenuOpenFor, setTrackMenuOpenFor] = useState(null)
  const [goatAll, setGoatAll] = useState([])
  const [goatMonthly, setGoatMonthly] = useState([])
  const [goatWeekly, setGoatWeekly] = useState([])
  const [loading, setLoading] = useState(true)
  const periodTabsRef = useRef(null)

  const cols = getRankColumns(mode === 'season')
  const pointsCol = cols.points

  const cacheKey = `goat_${mode}_v3`

  useEffect(() => {
    const cached = getCachedRanking(cacheKey)
    if (cached?.data) {
      const { all, monthly, weekly } = cached.data
      setGoatAll(all || [])
      setGoatMonthly(monthly || [])
      setGoatWeekly(weekly || [])
      setLoading(false)
      return
    }
    fetchGoatRankings()
  }, [mode])

  useEffect(() => {
    setTrackMenuOpenFor(null)
  }, [mode])

  useEffect(() => {
    if (!trackMenuOpenFor) return
    const onDown = (e) => {
      if (periodTabsRef.current && !periodTabsRef.current.contains(e.target)) {
        setTrackMenuOpenFor(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [trackMenuOpenFor])

  const fetchGoatRankings = async () => {
    setLoading(true)
    try {
      const useSeason = mode === 'season'
      const { data: lb, error } = await supabase.rpc('profiles_goat_period_leaderboard', {
        p_use_season: useSeason,
      })
      if (error) throw error
      let all = mergeChampionOracleRows(lb?.champion_overall_top10, lb?.oracle_overall_top10)
      if (!all.length) all = lb?.overall_top10 || []
      const monthly = mergeChampionOracleRows(lb?.champion_month_top7, lb?.oracle_month_top7)
      const weekly = mergeChampionOracleRows(lb?.champion_week_top3, lb?.oracle_week_top3)
      setGoatAll(all)
      setGoatMonthly(monthly)
      setGoatWeekly(weekly)
      setCachedRanking(cacheKey, { all, monthly, weekly })
    } catch (err) {
      console.error('[GoatRankingSection]', err)
      try {
        const orderCol = pointsCol === 'season_points' ? 'points' : pointsCol
        const baseSelect = 'id, nickname, avatar_url, points, total_matchups, featured_badge'
        const { data: allData, error: allErr } = await supabase
          .from('profiles')
          .select(`${baseSelect}, season_points`)
          .order(orderCol, { ascending: false })
          .limit(10)
        if (!allErr && allData?.length) {
          setGoatAll(allData)
          setGoatMonthly([])
          setGoatWeekly([])
          setCachedRanking(cacheKey, { all: allData, monthly: [], weekly: [] })
        }
      } catch (_) { /* noop */ }
    } finally {
      setLoading(false)
    }
  }

  const MEDALS = ['🥇', '🥈', '🥉']
  const rawRankings =
    activeTab === 'all' ? goatAll : activeTab === 'monthly' ? goatMonthly : goatWeekly

  const displayRankings = rawRankings.filter((p) => p.goatTrack === trackFilter)

  const { number: seasonNum } = getCurrentSeason()
  const pts = (p) => (mode === 'season' ? (p.season_points ?? p.points) : (p.points ?? 0))
  const hasAnyTabData = goatAll.length > 0 || goatMonthly.length > 0 || goatWeekly.length > 0

  const periodLabel = (p) => {
    if (!p.goatTrack || p.period_points == null) return `${formatNumber(pts(p))}pt`
    if (activeTab === 'all') {
      return `전체 +${formatNumber(p.period_points)}P`
    }
    const span = activeTab === 'weekly' ? '주' : '달'
    return `이번 ${span} +${formatNumber(p.period_points)}P`
  }

  const trackTitle = trackFilterTitle(trackFilter)

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown size={20} className="text-amber-500" />
          <h2 className="text-lg font-bold text-[#22282E] tracking-tight">🔥 HOT 랭커<span className="ml-1 text-sm font-medium text-slate-400">(현재 시점 강자)</span></h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                mode === tab.id ? 'bg-amber-100 text-amber-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {mode === 'season' && <span className="text-[10px] text-gray-400">S{seasonNum}</span>}
        </div>
      </div>
      <div
        className={`bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/25 rounded-2xl border border-amber-200/50 shadow-sm shadow-amber-100/40 overflow-visible ${!loading ? 'animate-fade-in-soft' : ''}`}
      >
        <div className="p-4 overflow-visible">
          <p className="text-[10px] text-gray-500 mb-2 text-right leading-snug">
            기간 탭을 누른 뒤 <span className="font-bold text-gray-600">The Champion</span> 또는{' '}
            <span className="font-bold text-gray-600">The Oracle</span>을 고르면 됩니다. 전체 Top10은 트랙별 획득
            P 합산, 월간·주간은 해당 기간 획득 P 기준입니다. 탭에 선택한 트랙이 함께 표시됩니다.
          </p>
          <div
            ref={periodTabsRef}
            className="relative z-20 mb-3 flex flex-wrap items-stretch justify-end gap-1"
          >
            {GOAT_TABS.map((tab) => {
              const open = trackMenuOpenFor === tab.id
              const isActive = activeTab === tab.id
              return (
                <div key={tab.id} className="relative">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="menu"
                    aria-label={`${tab.label}, ${trackTitle}`}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setTrackMenuOpenFor((cur) => (cur === tab.id ? null : tab.id))
                    }}
                    className={`flex h-full min-w-0 max-w-[9.25rem] items-center gap-1 rounded-lg px-2.5 py-1.5 text-left transition-colors sm:max-w-[11rem] ${
                      isActive
                        ? 'bg-amber-200/80 text-amber-950'
                        : 'bg-white/60 text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                      <span className="text-[11px] font-bold">{tab.label}</span>
                      <span
                        className={`truncate text-[9px] font-semibold leading-tight ${
                          isActive ? 'text-amber-900/90' : 'text-gray-500'
                        }`}
                      >
                        {trackTitle}
                      </span>
                    </span>
                    <ChevronDown
                      size={14}
                      className={`shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {open && (
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+4px)] min-w-[11.5rem] rounded-xl border border-amber-200/90 bg-white py-1 shadow-lg shadow-amber-900/10"
                    >
                      {GOAT_TRACK_MENU_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setTrackFilter(opt.id)
                            setTrackMenuOpenFor(null)
                          }}
                          className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-[11px] transition-colors hover:bg-amber-50 ${
                            trackFilter === opt.id ? 'bg-amber-50/80 font-bold text-amber-950' : 'text-gray-700'
                          }`}
                        >
                          <span>{opt.title}</span>
                          <span className="text-[10px] font-normal text-gray-500">{opt.hint}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 animate-pulse">
                  <div className="w-5 h-5 bg-gray-200 rounded" />
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="flex-1 h-4 bg-gray-200 rounded" />
                </div>
              ))
            ) : !hasAnyTabData ? (
              <div className="col-span-full py-8 text-center text-xs text-gray-400">아직 랭킹 데이터가 없어요</div>
            ) : !displayRankings.length ? (
              <div className="col-span-full py-8 text-center text-xs text-gray-400">
                선택한 트랙에는 이 기간 랭킹이 없어요. 다른 트랙이나 기간 탭을 눌러 보세요.
              </div>
            ) : (
              displayRankings.map((p, idx) => (
                <UserProfileBlockLink
                  key={`${p.id}-${p.goatTrack || 'all'}-${idx}`}
                  userId={p.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-gray-100 hover:border-amber-200/80 hover:shadow-sm transition-colors"
                >
                  <span className="text-sm font-bold shrink-0">
                    {idx < 3 ? MEDALS[idx] : <span className="text-amber-600/90 text-xs">#{idx + 1}</span>}
                  </span>
                  <img
                    src={safeMediaUrl(p.avatar_url) || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeForUrl(p.nickname || '')}`}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-yellow-400/50"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#22282E] flex items-center gap-1 min-w-0">
                      <span className="truncate">{p.nickname}</span>
                      <FeaturedBadgeSpan badgeId={p.featured_badge} className="translate-y-px shrink-0" />
                    </p>
                    <p className="text-[10px] text-gray-500">{periodLabel(p)}</p>
                  </div>
                </UserProfileBlockLink>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
