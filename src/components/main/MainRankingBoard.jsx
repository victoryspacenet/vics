import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatNumber } from '../../lib/utils'

export function MainRankingBoard() {
  const [activeTab, setActiveTab] = useState('all')
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRankings()
  }, [activeTab])

  const fetchRankings = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, points, total_matchups')
        .order('points', { ascending: false })
        .limit(5)
      setRankings(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const TABS = [
    { id: 'all', label: '전체' },
    { id: 'weekly', label: '주간' },
    { id: 'monthly', label: '월간' },
  ]
  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-[#1a2332] rounded-xl border border-white/10 overflow-hidden">
      <div className="flex border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'text-white border-b-2 border-emerald-500' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-12 px-4 py-2 text-xs text-white/50 border-b border-white/10">
        <span className="col-span-1">순위</span>
        <span className="col-span-6">닉네임</span>
        <span className="col-span-2 text-right">포인트</span>
        <span className="col-span-3 text-right">게시물</span>
      </div>
      <div>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-5 h-4 bg-white/10 rounded" />
                <div className="w-8 h-8 bg-white/10 rounded-full" />
                <div className="flex-1 h-4 bg-white/10 rounded" />
              </div>
            ))
          : rankings.map((profile, idx) => (
              <div
                key={profile.id}
                className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5 last:border-0"
              >
                <span className="col-span-1 text-sm font-bold">
                  {idx < 3 ? MEDALS[idx] : <span className="text-white/40 text-xs">{idx + 1}</span>}
                </span>
                <div className="col-span-6 flex items-center gap-2 min-w-0">
                  <img
                    src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.nickname}`}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs font-medium truncate">{profile.nickname}</span>
                </div>
                <span className="col-span-2 text-right text-xs font-bold">{formatNumber(profile.points || 0)}</span>
                <span className="col-span-3 text-right text-xs text-white/50">{profile.total_matchups || 0}</span>
              </div>
            ))}
      </div>
      {rankings.length === 0 && !loading && (
        <div className="py-8 text-center text-xs text-white/40">아직 랭킹 데이터가 없어요</div>
      )}
    </div>
  )
}
