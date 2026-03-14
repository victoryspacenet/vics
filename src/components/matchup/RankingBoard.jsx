import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'
import { LevelBadge } from '../ui/LevelBadge'
import { formatNumber } from '../../lib/utils'

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

  useEffect(() => {
    fetchRankings()
  }, [activeTab])

  const fetchRankings = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('id, nickname, avatar_url, points, total_matchups')
        .order('points', { ascending: false })
        .limit(10)

      const { data } = await query
      setRankings(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const displayedRankings = expanded ? rankings : rankings.slice(0, 3)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b border-gray-100">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-[#22282E] border-b-2 border-[#22282E]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 헤더 */}
      <div className="grid grid-cols-12 px-4 py-2 text-xs text-gray-400 border-b border-gray-50">
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
                <div className="w-5 h-4 bg-gray-100 rounded" />
                <div className="w-8 h-8 bg-gray-100 rounded-full" />
                <div className="flex-1 h-4 bg-gray-100 rounded" />
              </div>
            ))
          : displayedRankings.map((profile, idx) => (
              <Link
                key={profile.id}
                to={`/profile/${profile.id}`}
                className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
              >
                <span className="col-span-1 text-sm font-bold">
                  {idx < 3 ? MEDALS[idx] : <span className="text-gray-400 text-xs">{idx + 1}</span>}
                </span>
                <div className="col-span-7 flex items-center gap-2 min-w-0">
                  <Avatar src={profile.avatar_url} alt={profile.nickname} size="xs" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-[#22282E] truncate block">
                      {profile.nickname}
                    </span>
                    <LevelBadge points={profile.points || 0} variant="badge" className="text-[10px] px-1.5 py-0" />
                  </div>
                </div>
                <span className="col-span-2 text-right text-xs font-bold text-[#22282E]">
                  {formatNumber(profile.points || 0)}
                </span>
                <span className="col-span-2 text-right text-xs text-gray-400">
                  {profile.total_matchups || 0}
                </span>
              </Link>
            ))
        }
      </div>

      {/* 더보기 */}
      {rankings.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-[#22282E] hover:bg-gray-50 transition-colors border-t border-gray-50"
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
