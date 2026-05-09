import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UserProfileBlockLink } from '../ui/UserProfileLink'
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

const TYPE_TABS = [
  { id: 'creator', label: '👑 The Champion', hint: '(매치업 생성)', sub: '매치업 생성자' },
  { id: 'voter', label: '🔮 The Oracle', hint: '(매치업 투표)', sub: '매치업 투표자' },
]

const CREATOR_SORT = [
  { id: 'votes', label: '투표받은 수' },
  { id: 'points', label: '포인트' },
]

const VOTER_SORT = [
  { id: 'hitrate', label: '적중률' },
  { id: 'points', label: '포인트' },
]

function calcHitRate(hits, total) {
  if (!total || total === 0) return null
  return Math.round(((hits || 0) / total) * 100)
}

export function MainRankingBoard() {
  const [mode, setMode] = useState('all')
  const [typeTab, setTypeTab] = useState('creator')
  const [sortBy, setSortBy] = useState({ creator: 'votes', voter: 'hitrate' })
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  const currentSort = sortBy[typeTab] ?? (typeTab === 'creator' ? 'votes' : 'hitrate')
  const sortTabs = typeTab === 'creator' ? CREATOR_SORT : VOTER_SORT
  const cols = getRankColumns(mode === 'season')

  const cacheKey = `main_${mode}_${typeTab}_${currentSort}`

  useEffect(() => {
    const cached = getCachedRanking(cacheKey)
    if (cached?.data) {
      setRankings(cached.data)
      setLoading(false)
      return
    }
    fetchRankings()
  }, [typeTab, sortBy, mode])

  const fetchRankings = async () => {
    setLoading(true)
    try {
      const isCreator = typeTab === 'creator'
      const orderCol =
        isCreator
          ? (currentSort === 'votes' ? cols.total_votes_received : cols.points)
          : (currentSort === 'hitrate' ? cols.hit_rate : cols.points)
      const selectCols = `id, nickname, avatar_url, points, season_points, total_matchups, total_votes_received, season_total_votes_received, vote_hits, vote_total, season_vote_hits, season_vote_total, hit_rate, season_hit_rate, featured_badge`

      let query = supabase
        .from('profiles')
        .select(selectCols)
        .order(orderCol, { ascending: false, nullsFirst: false })
        .limit(5)

      if (!isCreator) query = query.gte(cols.vote_total, 1)

      const { data } = await query
      const list = data || []
      setRankings(list)
      setCachedRanking(cacheKey, list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const MEDALS = ['🥇', '🥈', '🥉']
  const isCreator = typeTab === 'creator'

  // Champion: 1열=정렬기준값, 2열=게시물
  // Oracle: 1열=정렬기준값, 2열=투표수
  const col1Label = isCreator
    ? (currentSort === 'votes' ? '투표받은 수' : '포인트')
    : (currentSort === 'hitrate' ? '적중률' : '포인트')
  const col2Label = isCreator ? '게시물' : '투표수'

  const getCol1 = (p) => {
    if (isCreator) {
      const val = currentSort === 'votes' ? (p[cols.total_votes_received] ?? p.total_votes_received) : (p[cols.points] ?? p.points)
      return formatNumber(val || 0)
    }
    if (currentSort === 'hitrate') {
      const rate = p[cols.hit_rate] ?? p.hit_rate ?? calcHitRate(p[cols.vote_hits] ?? p.vote_hits, p[cols.vote_total] ?? p.vote_total)
      return `${rate ?? 0}%`
    }
    return formatNumber((p[cols.points] ?? p.points) || 0)
  }
  const getCol2 = (p) => {
    if (isCreator) return p.total_matchups || 0
    return formatNumber((p[cols.vote_total] ?? p.vote_total) || 0)
  }

  const { number: seasonNum } = getCurrentSeason()

  return (
    <div className="bg-gradient-to-b from-white via-emerald-50/15 to-teal-50/10 rounded-2xl border border-emerald-200/70 shadow-sm shadow-emerald-200/25 ring-1 ring-teal-100/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-50/50 via-white/70 to-teal-50/35 border-b border-emerald-200/55">
        <div className="flex gap-1">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                mode === tab.id ? 'bg-emerald-100 text-emerald-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {mode === 'season' && (
          <span className="text-[10px] text-gray-400">S{seasonNum}</span>
        )}
      </div>
      <div className="flex border-b border-teal-100/90 bg-gradient-to-r from-white/80 via-emerald-50/20 to-cyan-50/25">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeTab(tab.id)}
            className={`flex-1 py-3 px-1 text-xs font-medium transition-colors ${
              typeTab === tab.id
                ? 'text-[#22282E] border-b-2 border-emerald-500 shadow-[0_1px_0_0_rgba(16,185,129,0.35)]'
                : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
            }`}
          >
            <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 leading-tight">
              <span>{tab.label}</span>
              <span className="text-[10px] sm:text-[11px] text-gray-500 font-semibold">{tab.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex gap-1 px-3 py-2 bg-gradient-to-r from-slate-50/40 via-emerald-50/25 to-teal-50/30 border-b border-cyan-100/80 justify-end">
        {sortTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSortBy((prev) => ({ ...prev, [typeTab]: tab.id }))}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${
              currentSort === tab.id ? 'bg-emerald-100 text-emerald-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-12 px-4 py-2 text-xs text-emerald-700/80 font-semibold border-b border-emerald-200/60 bg-gradient-to-r from-emerald-50/45 via-white/50 to-teal-50/35">
        <span className="col-span-1">순위</span>
        <span className="col-span-6">닉네임</span>
        <span className="col-span-2 text-right">{col1Label}</span>
        <span className="col-span-3 text-right">{col2Label}</span>
      </div>
      <div>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-5 h-4 bg-gray-200 rounded" />
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 h-4 bg-gray-200 rounded" />
              </div>
            ))
          : rankings.map((profile, idx) => (
              <UserProfileBlockLink
                key={profile.id}
                userId={profile.id}
                className="grid grid-cols-12 px-4 py-3 items-center border-b border-emerald-100/70 last:border-0 hover:bg-emerald-50/50 hover:border-emerald-200/40 transition-colors animate-fade-in-stagger"
                style={{ '--stagger-delay': `${idx * 42}ms` }}
              >
                <span className="col-span-1 text-sm font-bold">
                  {idx < 3 ? MEDALS[idx] : <span className="text-gray-400 text-xs">{idx + 1}</span>}
                </span>
                <div className="col-span-6 flex items-center gap-2 min-w-0">
                  <img
                    src={safeMediaUrl(profile.avatar_url) || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeForUrl(profile.nickname || '')}`}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs font-medium truncate text-[#22282E]">{profile.nickname}</span>
                  <FeaturedBadgeSpan badgeId={profile.featured_badge} className="translate-y-px shrink-0" />
                </div>
                <span className="col-span-2 text-right text-xs font-bold">{getCol1(profile)}</span>
                <span className="col-span-3 text-right text-xs text-gray-500">{getCol2(profile)}</span>
              </UserProfileBlockLink>
            ))}
      </div>
      {rankings.length === 0 && !loading && (
        <div className="py-8 text-center text-xs text-gray-400">아직 랭킹 데이터가 없어요</div>
      )}
      <Link
        to="/ranking"
        className="block py-3 text-center text-sm font-bold text-emerald-600 hover:text-emerald-500 border-t border-emerald-200/70 bg-gradient-to-b from-emerald-50/30 to-white/60 hover:from-emerald-50/50 transition-colors"
      >
        전체 랭킹 보기 →
      </Link>
    </div>
  )
}
