import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UserProfileBlockLink } from '../ui/UserProfileLink'
import { ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'
import { FeaturedBadgeSpan } from '../ui/FeaturedBadge'
import { FoundingMemberBadge } from '../profile/FoundingMemberBadge'
import { TierBadge } from '../ui/TierBadge'
import { formatNumber } from '../../lib/utils'
import { getCachedRanking, setCachedRanking } from '../../lib/rankingCache'
import { getRankingEligibleProfileIds, RANKING_ELIGIBLE_CACHE_TAG } from '../../lib/rankingEligibleProfiles'
import { enrichProfileRowsWithTierSnapshot, EMPTY_TIER_RANK_INFO } from '../../lib/creatorRankSnapshot'
import { attachCompetitionRanksInMemory } from '../../lib/rankingCompetitionRank'

const HOME_SIDEBAR_RANK_TIER_VER = 't2'

const TABS = [
  { id: 'all', label: '전체' },
  { id: 'weekly', label: '주간' },
  { id: 'monthly', label: '월간' },
]

const MEDALS = ['🥇', '🥈', '🥉']

export function RankingBoard() {
  const [activeTab, setActiveTab] = useState('all')
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const CACHE_KEY = `home_sidebar_points_${RANKING_ELIGIBLE_CACHE_TAG}_${HOME_SIDEBAR_RANK_TIER_VER}`

  useEffect(() => {
    const cached = getCachedRanking(CACHE_KEY)
    if (cached?.data) {
      setRankings(cached.data)
      setLoading(false)
      return
    }
    fetchRankings()
  }, [activeTab])

  const fetchRankings = async () => {
    setLoading(true)
    try {
      const eligibleIds = await getRankingEligibleProfileIds()
      if (Array.isArray(eligibleIds) && eligibleIds.length === 0) {
        setRankings([])
        setCachedRanking(CACHE_KEY, [])
        return
      }

      let qb = supabase
        .from('profiles')
        .select(
          'id, nickname, avatar_url, points, total_matchups, creator_wins, vote_total, vote_hits, hit_rate, featured_badge, founding_member_number'
        )
        .order('points', { ascending: false })
        .limit(10)
      if (eligibleIds?.length) qb = qb.in('id', eligibleIds)

      const { data } = await qb
      const enriched = await enrichProfileRowsWithTierSnapshot(data || [])
      const list = attachCompetitionRanksInMemory(enriched, 'points')
      setRankings(list)
      setCachedRanking(CACHE_KEY, list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const displayedRankings = expanded ? rankings : rankings.slice(0, 3)

  return (
    <div className="overflow-hidden bg-gradient-to-b from-white/25 via-transparent to-teal-50/20">
      {/* 탭 */}
      <div className="flex border-b border-violet-200/35 bg-white/15">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-violet-950 border-b-2 border-violet-600'
                : 'text-violet-500/70 hover:text-violet-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 헤더 */}
      <div className="grid grid-cols-12 px-4 py-2 text-xs text-violet-500/75 border-b border-violet-200/30">
        <span className="col-span-1">#</span>
        <span className="col-span-7">닉네임</span>
        <span className="col-span-2 text-right">포인트</span>
        <span className="col-span-2 text-right">게시물</span>
      </div>

      {/* 리스트 */}
      <div>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-5 h-4 bg-violet-100/80 rounded" />
                <div className="w-8 h-8 bg-fuchsia-100/70 rounded-full" />
                <div className="flex-1 h-4 bg-teal-100/60 rounded" />
              </div>
            ))
          : displayedRankings.map((profile, idx) => (
              <UserProfileBlockLink
                key={profile.id}
                userId={profile.id}
                className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/35 transition-colors"
              >
                <span className="col-span-1 text-sm font-bold">
                  {(profile._displayRank ?? idx + 1) <= 3
                    ? MEDALS[(profile._displayRank ?? idx + 1) - 1]
                    : <span className="text-gray-400 text-xs">{profile._displayRank ?? idx + 1}</span>}
                </span>
                <div className="col-span-7 flex items-center gap-2 min-w-0">
                  <Avatar src={profile.avatar_url} alt={profile.nickname} size="xs" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="text-xs font-medium text-[#22282E] truncate">
                        {profile.nickname}
                      </span>
                      <FeaturedBadgeSpan profile={profile} rankInfo={profile._tierRankInfo} className="translate-y-px shrink-0" />
                      <FoundingMemberBadge profile={profile} size={11} />
                    </div>
                    <TierBadge
                      profile={profile}
                      rankInfo={profile._tierRankInfo ?? { ...EMPTY_TIER_RANK_INFO }}
                      variant="compact"
                      className="text-[10px] px-1.5 py-0"
                    />
                  </div>
                </div>
                <span className="col-span-2 text-right text-xs font-bold text-[#22282E]">
                  {formatNumber(profile.points || 0)}
                </span>
                <span className="col-span-2 text-right text-xs text-gray-400">
                  {profile.total_matchups || 0}
                </span>
              </UserProfileBlockLink>
            ))
        }
      </div>

      {/* 더보기 */}
      {rankings.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 flex items-center justify-center gap-1 text-xs text-violet-500/75 hover:text-violet-950 hover:bg-white/30 transition-colors border-t border-violet-200/30"
        >
          {expanded ? '접기' : '10위까지 보기'}
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      {rankings.length === 0 && !loading && (
        <div className="py-8 text-center text-xs text-gray-400">
          아직 랭킹 데이터가 없어요
        </div>
      )}
    </div>
  )
}
