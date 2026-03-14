import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Edit2, Trophy, Target, Swords,
  CheckCircle2, XCircle, Clock, ChevronRight,
  ChevronLeft, Plus, Flame, Users, ArrowRight, Zap, Gift,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { formatNumber, calcPercent, getLevel, getLevelProgress, LEVELS } from '../lib/utils'

const CREATED_SORT   = [
  { id: 'latest',   label: '최신순' },
  { id: 'rate',     label: '득표율순' },
  { id: 'deadline', label: '마감임박순' },
]
const CREATED_FILTER = [
  { id: 'all',    label: '전체' },
  { id: 'active', label: '진행 중' },
  { id: 'ended',  label: '종료됨' },
]
const CREATED_PAGE_SIZE = 8
const VOTED_PAGE_SIZE   = 8
const VOTED_FILTER = [
  { id: 'all',   label: '전체' },
  { id: 'win',   label: '승리(적중)' },
  { id: 'lose',  label: '패배(아쉬움)' },
  { id: 'live',  label: '진행중' },
]
const VOTE_POINTS = 10  // 투표당 지급 포인트

export function MyPage() {
  const { user, profile } = useAuthStore()
  const { openCreateDrawer, openLoginModal } = useUIStore()

  const [activeTab,        setActiveTab]        = useState('created')
  const [sortCreated,      setSortCreated]       = useState('latest')
  const [filterCreated,    setFilterCreated]     = useState('all')
  const [createdPage,      setCreatedPage]       = useState(1)
  const [filterVoted,      setFilterVoted]       = useState('all')
  const [votedPage,        setVotedPage]         = useState(1)
  const [createdMatchups,  setCreatedMatchups]   = useState([])
  const [votedMatchups,    setVotedMatchups]     = useState([])
  const [stats,            setStats]             = useState(null)
  const [loading,          setLoading]           = useState(true)
  const [chartPeriod,      setChartPeriod]       = useState('weekly')  // 'weekly' | 'monthly'
  const createdListRef = useRef(null)
  const votedListRef   = useRef(null)

  if (!user) return <Navigate to="/" />

  useEffect(() => { fetchData() }, [user])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: created } = await supabase
        .from('matchups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setCreatedMatchups(created || [])

      const { data: votes } = await supabase
        .from('votes')
        .select('side, matchup_id, created_at, matchups(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setVotedMatchups(votes || [])

      const { data: rankData } = await supabase
        .from('profiles')
        .select('id')
        .order('points', { ascending: false })
      const rank = rankData?.findIndex((p) => p.id === user.id) + 1

      setStats({ rank: rank || '-' })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const sortedCreated = [...createdMatchups].sort((a, b) => {
    if (sortCreated === 'latest')   return new Date(b.created_at) - new Date(a.created_at)
    if (sortCreated === 'deadline') {
      const da = a.expires_at ? new Date(a.expires_at) : Infinity
      const db = b.expires_at ? new Date(b.expires_at) : Infinity
      return da - db
    }
    const rateA = a.total_votes > 0 ? Math.max(a.left_votes, a.right_votes) / a.total_votes : 0
    const rateB = b.total_votes > 0 ? Math.max(b.left_votes, b.right_votes) / b.total_votes : 0
    return rateB - rateA
  })

  const filteredCreated = sortedCreated.filter((m) => {
    if (filterCreated === 'active') return m.status === 'active'
    if (filterCreated === 'ended')  return m.status !== 'active'
    return true
  })
  const totalCreatedPages = Math.max(1, Math.ceil(filteredCreated.length / CREATED_PAGE_SIZE))
  const pagedCreated      = filteredCreated.slice(
    (createdPage - 1) * CREATED_PAGE_SIZE,
    createdPage * CREATED_PAGE_SIZE,
  )

  const goCreatedPage = (p) => {
    setCreatedPage(p)
    createdListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleFilterChange = (id) => {
    setFilterCreated(id)
    setCreatedPage(1)
  }

  // ── 투표 탭 계산 ──────────────────────────────────────────────────
  const votesWithResult = votedMatchups.filter((v) => {
    const m = v.matchups
    return m && m.total_votes > 0 && m.status !== 'active'
  })
  const votedWins  = votesWithResult.filter((v) => {
    const m = v.matchups
    const winner = m.left_votes >= m.right_votes ? 'left' : 'right'
    return v.side === winner
  }).length
  const voteWinRate = votesWithResult.length > 0
    ? Math.round((votedWins / votesWithResult.length) * 100)
    : 0

  const filteredVoted = votedMatchups.filter((v) => {
    const m = v.matchups
    if (!m) return false
    const isActive = m.status === 'active'
    const winner   = m.left_votes >= m.right_votes ? 'left' : 'right'
    const myWin    = v.side === winner && m.total_votes > 0 && !isActive
    if (filterVoted === 'win')  return !isActive && m.total_votes > 0 && myWin
    if (filterVoted === 'lose') return !isActive && m.total_votes > 0 && !myWin
    if (filterVoted === 'live') return isActive
    return true
  })
  const totalVotedPages = Math.max(1, Math.ceil(filteredVoted.length / VOTED_PAGE_SIZE))
  const pagedVoted      = filteredVoted.slice(
    (votedPage - 1) * VOTED_PAGE_SIZE,
    votedPage * VOTED_PAGE_SIZE,
  )
  const goVotedPage = (p) => {
    setVotedPage(p)
    votedListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const handleVotedFilterChange = (id) => {
    setFilterVoted(id)
    setVotedPage(1)
  }

  const points   = profile?.points || 0
  const levelObj = getLevel(points)
  const progress = getLevelProgress(points)
  const nextLevel = LEVELS[Math.min(levelObj.level, LEVELS.length - 1)]
  const winRate  = profile && (profile.wins + profile.losses) > 0
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : 0
  const totalMatchups = createdMatchups.length + votedMatchups.length

  // 활동통계 차트 데이터 (주간 7일 / 월간 4주)
  const chartData = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    // 생성한 매치업 임의 값 (물결 패턴, 실제 데이터가 없을 때 시각적 참고용)
    const demoCreated = (n) => Array.from({ length: n }, (_, i) =>
      Math.max(0, Math.round(Math.sin(i * 0.7) * 2 + Math.cos(i * 0.5) * 1.5 + 3))
    )
    if (chartPeriod === 'weekly') {
      const labels = []
      const created = []
      const voted = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        labels.push(d.getMonth() + 1 + '/' + d.getDate())
        const dayStart = new Date(d)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(d)
        dayEnd.setHours(23, 59, 59, 999)
        const realCreated = createdMatchups.filter((m) => {
          const t = new Date(m.created_at).getTime()
          return t >= dayStart.getTime() && t <= dayEnd.getTime()
        }).length
        created.push(realCreated > 0 ? realCreated : demoCreated(7)[6 - i])
        voted.push(votedMatchups.filter((v) => {
          const t = new Date(v.created_at).getTime()
          return t >= dayStart.getTime() && t <= dayEnd.getTime()
        }).length)
      }
      return { labels, created, voted }
    } else {
      const labels = []
      const created = []
      const voted = []
      const demo = demoCreated(4)
      for (let i = 0; i <= 3; i++) {
        const weekEnd = new Date(now)
        weekEnd.setDate(weekEnd.getDate() - i * 7)
        const weekStart = new Date(weekEnd)
        weekStart.setDate(weekStart.getDate() - 6)
        weekStart.setHours(0, 0, 0, 0)
        weekEnd.setHours(23, 59, 59, 999)
        labels.push(`${i + 1}주`)
        const realCreated = createdMatchups.filter((m) => {
          const t = new Date(m.created_at).getTime()
          return t >= weekStart.getTime() && t <= weekEnd.getTime()
        }).length
        created.push(realCreated > 0 ? realCreated : demo[i])
        voted.push(votedMatchups.filter((v) => {
          const t = new Date(v.created_at).getTime()
          return t >= weekStart.getTime() && t <= weekEnd.getTime()
        }).length)
      }
      return { labels, created, voted }
    }
  }, [chartPeriod, createdMatchups, votedMatchups])

  return (
    <div className="max-w-screen-lg mx-auto">

      {/* ══ 프로필 헤더 ══ */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

          {/* 아바타 */}
          <div className="shrink-0">
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-[#22282E] ring-offset-2 overflow-hidden bg-gray-100">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={profile?.nickname} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <span className="text-3xl font-black text-gray-500">
                        {profile?.nickname?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                }
              </div>
              <Link
                to="/mypage/edit"
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Edit2 size={20} className="text-white" />
              </Link>
            </div>
          </div>

          {/* 닉네임 + 이메일 + 바이오 */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
              <h1 className="text-2xl font-black text-[#22282E]">{profile?.nickname || '사용자'}</h1>
              <span className="text-lg">{levelObj.emoji}</span>
            </div>
            <p className="text-sm text-gray-400 mb-2">{user.email}</p>
            {profile?.bio && (
              <p className="text-sm text-gray-500 max-w-sm line-clamp-2 mb-3">{profile.bio}</p>
            )}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Link
                to="/mypage/edit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
              >
                <Edit2 size={13} /> 프로필 수정
              </Link>
              <Link
                to="/mypage/ranking-gallery"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full transition-colors"
                style={{
                  background: 'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(236,72,153,0.1))',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: '#7c3aed',
                }}
              >
                🏆 랭킹 히스토리
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══ My 레벨 ══ */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-base font-black text-[#22282E] mb-4">My 레벨</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center shrink-0">
            <CircularLevelRing
              level={levelObj.level}
              progressPercent={progress}
              emoji={levelObj.emoji}
            />
            <div className="text-center mt-3">
              <p className="text-sm font-bold text-[#22282E]">{levelObj.emoji} {levelObj.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-black text-[#22282E]">{formatNumber(points)}</span>
                {nextLevel && <span className="text-gray-400"> / {formatNumber(nextLevel.min)} P</span>}
              </p>
              {nextLevel && (
                <p className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-sm font-bold">
                  <span className="text-amber-500">✨</span>
                  다음 레벨까지 {formatNumber(Math.max(0, nextLevel.min - points))} P 남음
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full sm:w-auto">
            <SideStatBox icon="🏅" label="랭킹" value={stats?.rank ? `${stats.rank}위` : '-'} color="text-amber-600" />
            <SideStatBox icon="📊" label="승률" value={`${winRate}%`} color="text-blue-600" />
            <SideStatBox icon="🏆" label="승리" value={`${profile?.wins || 0}승`} color="text-green-600" />
            <SideStatBox icon="⚔️" label="총 매치업" value={`${totalMatchups}전`} color="text-violet-600" />
          </div>
        </div>
      </div>

      {/* ══ 활동통계 물결그래프 ══ */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-[#22282E]">활동통계</h3>
          <div className="flex gap-1 bg-gray-100 rounded-full p-1">
            {[
              { id: 'weekly', label: '주간' },
              { id: 'monthly', label: '월간' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setChartPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                  chartPeriod === p.id ? 'bg-[#22282E] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <ActivityWaveChart data={chartData} />
      </div>

      {/* ══ 메인 그리드: 콘텐츠 ══ */}
      <div className="grid grid-cols-1 gap-6 items-start">

        {/* ── 메인 컬럼 ── */}
        <div>
          {/* 탭 */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5 min-w-0">
            {[
              { id: 'created', label: '내가 만든 매치업', count: createdMatchups.length },
              { id: 'voted',   label: '내가 투표한 매치업', count: votedMatchups.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all min-w-0 ${
                  activeTab === tab.id
                    ? 'bg-white text-[#22282E] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {!loading && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    activeTab === tab.id ? 'bg-[#22282E] text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── 내가 만든 매치업 ── */}
          {activeTab === 'created' && (
            <div ref={createdListRef}>

              {/* 요약 배너 */}
              <div className="bg-gradient-to-r from-[#22282E] to-gray-700 rounded-2xl p-4 mb-4 text-white">
                <p className="text-sm text-white/70 mb-0.5">{profile?.nickname || '사용자'}님은 지금까지</p>
                <p className="text-lg font-black flex items-center gap-2">
                  <Flame size={18} className="text-orange-400" />
                  {createdMatchups.length}개의 매치업을 이끌었습니다!
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/60">
                  <span>진행 중 {createdMatchups.filter(m => m.status === 'active').length}개</span>
                  <span>·</span>
                  <span>종료됨 {createdMatchups.filter(m => m.status !== 'active').length}개</span>
                  <span>·</span>
                  <span>총 {formatNumber(createdMatchups.reduce((s, m) => s + (m.total_votes || 0), 0))}표 획득</span>
                </div>
              </div>

              {/* 새 매치업 생성 버튼 */}
              <button
                onClick={() => user ? openCreateDrawer() : openLoginModal()}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white border-2 border-dashed border-gray-200 rounded-2xl hover:border-lime-400 hover:bg-lime-50 group transition-all mb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-lime-400 to-emerald-400 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Plus size={18} className="text-white stroke-[2.5]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-[#22282E]">새로운 매치업 생성</p>
                    <p className="text-xs text-gray-400">아직 당신의 안목을 기다리는 매치업이 많아요!</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-lime-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 필터 탭 + 정렬 */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 min-w-0 flex-wrap">
                  {CREATED_FILTER.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleFilterChange(f.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                        filterCreated === f.id
                          ? 'bg-[#22282E] text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {f.label}
                      {f.id !== 'all' && (
                        <span className={`ml-1 text-[9px] ${filterCreated === f.id ? 'text-white/70' : 'text-gray-400'}`}>
                          {f.id === 'active'
                            ? createdMatchups.filter(m => m.status === 'active').length
                            : createdMatchups.filter(m => m.status !== 'active').length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                  {CREATED_SORT.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSortCreated(s.id); setCreatedPage(1) }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all ${
                        sortCreated === s.id
                          ? 'bg-white text-[#22282E] shadow-sm'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 매치업 카드 리스트 (세로 스크롤 + 스냅) */}
              {loading
                ? <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <FullCardSkeleton key={i} />)}
                  </div>
                : filteredCreated.length > 0
                ? <>
                    <div
                      className="space-y-4"
                      style={{ scrollSnapType: 'y proximity' }}
                    >
                      {pagedCreated.map((m) => (
                        <CreatedMatchupFullCard key={m.id} matchup={m} />
                      ))}
                    </div>
                    {/* 페이지네이션 */}
                    {totalCreatedPages > 1 && (
                      <CreatedPagination
                        current={createdPage}
                        total={totalCreatedPages}
                        onPage={goCreatedPage}
                      />
                    )}
                  </>
                : <EmptyState
                    emoji="🥊"
                    title={filterCreated === 'active' ? '진행 중인 매치업이 없어요' : filterCreated === 'ended' ? '종료된 매치업이 없어요' : '아직 만든 매치업이 없어요'}
                    desc="첫 번째 매치업을 만들어 대결을 시작해보세요!"
                  />
              }
            </div>
          )}

          {/* ── 내가 투표한 매치업 ── */}
          {activeTab === 'voted' && (
            <div ref={votedListRef}>

              {/* 안목 요약 배너 */}
              <div className="relative bg-gradient-to-r from-violet-600 to-pink-500 rounded-2xl p-4 mb-4 text-white overflow-hidden">
                {/* 배경 장식 */}
                <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5" />
                <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/5" />
                <p className="text-sm text-white/80 mb-0.5 relative z-10">{profile?.nickname || '사용자'}님은 대중의 선택을</p>
                <p className="text-xl font-black flex items-center gap-2 relative z-10">
                  <CheckCircle2 size={20} className="text-lime-300" />
                  {voteWinRate}% 확률로 맞히고 있어요!
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/70 relative z-10">
                  <span>총 {votedMatchups.length}번 투표</span>
                  <span>·</span>
                  <span>적중 {votedWins}번</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Gift size={11} />
                    {formatNumber(votedMatchups.length * VOTE_POINTS)}P 누적 획득
                  </span>
                </div>
              </div>

              {/* 핫 매치업 투표 유도 버튼 */}
              <Link
                to="/matchups"
                className="flex items-center justify-between w-full px-4 py-3.5 bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl mb-4 group hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Zap size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">지금 핫한 매치업 투표하러 가기</p>
                    <p className="text-[10px] text-white/70">투표할 때마다 {VOTE_POINTS}P 획득!</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-white/70 group-hover:translate-x-1 transition-transform" />
              </Link>

              {/* 필터 탭 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 mb-4 overflow-x-auto scrollbar-hide">
                {VOTED_FILTER.map((f) => {
                  const count = f.id === 'all'  ? votedMatchups.length
                              : f.id === 'win'  ? votedMatchups.filter(v => { const m = v.matchups; if (!m || m.status === 'active') return false; const w = m.left_votes >= m.right_votes ? 'left' : 'right'; return v.side === w && m.total_votes > 0 }).length
                              : f.id === 'lose' ? votedMatchups.filter(v => { const m = v.matchups; if (!m || m.status === 'active') return false; const w = m.left_votes >= m.right_votes ? 'left' : 'right'; return v.side !== w && m.total_votes > 0 }).length
                              : votedMatchups.filter(v => v.matchups?.status === 'active').length
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleVotedFilterChange(f.id)}
                      className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                        filterVoted === f.id
                          ? 'bg-[#22282E] text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {f.id === 'win' ? '🎯' : f.id === 'lose' ? '💧' : f.id === 'live' ? '⏳' : null}
                      {f.label}
                      <span className={`text-[9px] px-1 rounded-full ${
                        filterVoted === f.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-400'
                      }`}>{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* 카드 리스트 */}
              {loading
                ? <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <FullCardSkeleton key={i} />)}
                  </div>
                : filteredVoted.length > 0
                ? <>
                    <div className="space-y-4" style={{ scrollSnapType: 'y proximity' }}>
                      {pagedVoted.map((v, idx) => (
                        <VotedMatchupFullCard
                          key={v.matchup_id}
                          vote={v}
                          matchup={v.matchups}
                          pointsEarned={VOTE_POINTS}
                        />
                      ))}
                    </div>
                    {totalVotedPages > 1 && (
                      <CreatedPagination
                        current={votedPage}
                        total={totalVotedPages}
                        onPage={goVotedPage}
                      />
                    )}
                  </>
                : <EmptyState
                    emoji={filterVoted === 'win' ? '🎯' : filterVoted === 'lose' ? '💧' : filterVoted === 'live' ? '⏳' : '🗳️'}
                    title={
                      filterVoted === 'win'  ? '아직 적중한 매치업이 없어요'  :
                      filterVoted === 'lose' ? '아직 아쉬운 결과가 없어요'    :
                      filterVoted === 'live' ? '진행 중인 투표가 없어요'       :
                      '아직 투표한 매치업이 없어요'
                    }
                    desc="피드에서 매치업에 투표하고 포인트를 획득해보세요!"
                  />
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 원형 SVG 레벨 링 ────────────────────────────────────────────────
function CircularLevelRing({ level, progressPercent, emoji }) {
  const radius        = 50
  const circumference = 2 * Math.PI * radius
  const dashOffset    = circumference - (progressPercent / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90" viewBox="0 0 128 128">
        {/* 배경 링 */}
        <circle
          cx="64" cy="64" r={radius}
          fill="transparent" stroke="#e5e7eb" strokeWidth="9"
        />
        {/* 진행 링 */}
        <circle
          cx="64" cy="64" r={radius}
          fill="transparent"
          stroke="#22282E"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl leading-none">{emoji}</span>
        <span className="text-xs text-gray-400 font-semibold">Lv.</span>
        <span className="text-3xl font-black text-[#22282E] leading-tight">{level}</span>
      </div>
    </div>
  )
}

// ── 내가 만든 매치업 풀카드 (세로 리스트) ───────────────────────────
function CreatedMatchupFullCard({ matchup: m }) {
  const isActive   = m.status === 'active'
  const isComplete = m.right_type != null
  const hasVotes   = (m.total_votes || 0) > 0
  const winner     = m.left_votes > m.right_votes ? 'left' : 'right'

  const leftThumb  = m.left_thumbnail_url  || (m.left_type  === 'image' ? m.left_url  : null)
  const rightThumb = m.right_thumbnail_url || (m.right_type === 'image' ? m.right_url : null)
  const { left, right } = calcPercent(m.left_votes, m.right_votes)

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
      style={{ scrollSnapAlign: 'start' }}
    >
      {/* 카드 헤더: 상태 + 제목 */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* 상태 배지 */}
          {isActive ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              진행 중
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black">
              ✓ 종료
            </span>
          )}
          <h3 className="text-sm font-black text-[#22282E] truncate">{m.title}</h3>
        </div>
        {/* 도전자 대기 중 */}
        {!isComplete && (
          <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
            도전자 대기중
          </span>
        )}
      </div>

      {/* 콘텐츠: 좌우 썸네일 + VS */}
      <div className="px-4 pb-3">
        <div className="relative grid grid-cols-2 gap-2">
          {/* A측 */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50">
            {leftThumb
              ? <img src={leftThumb} alt="A" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-3">
                  <p className="text-xs font-bold text-gray-600 text-center line-clamp-4">{m.left_text}</p>
                </div>
            }
            {/* A 레이블 */}
            {m.left_label && (
              <div className="absolute bottom-1.5 left-1.5">
                <span className="text-[9px] font-black text-white bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md block max-w-[90%] truncate">
                  {m.left_label}
                </span>
              </div>
            )}
            {/* A WIN 뱃지 */}
            {isComplete && hasVotes && !isActive && winner === 'left' && (
              <div className="absolute top-1.5 right-1.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                  <CheckCircle2 size={9} /> WIN
                </span>
              </div>
            )}
          </div>

          {/* 중앙 VS 뱃지 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-10 h-10 rounded-full bg-[#22282E] border-2 border-white shadow-xl flex items-center justify-center">
              <span className="text-white text-[11px] font-black">VS</span>
            </div>
          </div>

          {/* B측 */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50">
            {isComplete
              ? rightThumb
                ? <img src={rightThumb} alt="B" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-bl from-pink-50 to-red-100 flex items-center justify-center p-3">
                    <p className="text-xs font-bold text-gray-600 text-center line-clamp-4">{m.right_text}</p>
                  </div>
              : <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">⏳</span>
                  <p className="text-[10px] text-gray-400 font-bold text-center px-2">도전자를 기다리는 중</p>
                </div>
            }
            {/* B 레이블 */}
            {isComplete && m.right_label && (
              <div className="absolute bottom-1.5 right-1.5">
                <span className="text-[9px] font-black text-white bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md block max-w-[90%] truncate">
                  {m.right_label}
                </span>
              </div>
            )}
            {/* B WIN 뱃지 */}
            {isComplete && hasVotes && !isActive && winner === 'right' && (
              <div className="absolute top-1.5 left-1.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                  <CheckCircle2 size={9} /> WIN
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 투표 바 (진행 중일 때만) */}
      {hasVotes && isComplete && (
        <div className="px-4 pb-2">
          <div className="flex justify-between text-[10px] font-black mb-1">
            <span className="text-blue-500">{m.left_label || 'A'} {left}%</span>
            <span className="text-gray-400">{formatNumber(m.total_votes)}표</span>
            <span className="text-red-400">{right}% {m.right_label || 'B'}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
            <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-full" style={{ width: `${left}%` }} />
            <div className="bg-gradient-to-l from-red-400 to-red-300 h-full" style={{ width: `${right}%` }} />
          </div>
        </div>
      )}

      {/* 카드 하단: 참여자 + CTA */}
      <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users size={13} className="text-gray-400" />
          {isActive
            ? <span><span className="font-black text-[#22282E]">{formatNumber(m.total_votes || 0)}명</span> 실시간 참여 중</span>
            : <span>최종 <span className="font-black text-[#22282E]">{formatNumber(m.total_votes || 0)}명</span> 참여</span>
          }
        </div>
        <Link
          to={`/matchup/${m.id}`}
          className="inline-flex items-center gap-1 text-xs font-black text-[#22282E] hover:text-lime-600 transition-colors"
        >
          {isActive ? '현황 보기' : '결과 보기'}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}

// ── 내가 만든 매치업 페이지네이션 ────────────────────────────────────
function CreatedPagination({ current, total, onPage }) {
  const WINDOW = 5
  const half   = Math.floor(WINDOW / 2)
  let start    = Math.max(1, current - half)
  let end      = Math.min(total, start + WINDOW - 1)
  if (end - start + 1 < WINDOW) start = Math.max(1, end - WINDOW + 1)
  const pages  = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <div className="flex items-center justify-center gap-2 mt-6 mb-2">
      <button
        onClick={() => onPage(current - 1)} disabled={current === 1}
        className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:border-[#22282E] hover:text-[#22282E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={16} />
      </button>
      {start > 1 && (
        <>
          <PageBtn page={1} current={current} onClick={onPage} />
          {start > 2 && <span className="text-gray-300 text-sm">…</span>}
        </>
      )}
      {pages.map((p) => <PageBtn key={p} page={p} current={current} onClick={onPage} />)}
      {end < total && (
        <>
          {end < total - 1 && <span className="text-gray-300 text-sm">…</span>}
          <PageBtn page={total} current={current} onClick={onPage} />
        </>
      )}
      <button
        onClick={() => onPage(current + 1)} disabled={current === total}
        className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:border-[#22282E] hover:text-[#22282E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

function PageBtn({ page, current, onClick }) {
  return (
    <button
      onClick={() => onClick(page)}
      className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold transition-all ${
        page === current
          ? 'bg-[#22282E] text-white shadow-sm scale-105'
          : 'border border-gray-200 text-gray-500 hover:border-[#22282E] hover:text-[#22282E]'
      }`}
    >
      {page}
    </button>
  )
}

// ── 내가 만든 매치업 카드 (2열 그리드 - 레거시 유지) ────────────────
function CreatedMatchupCard({ matchup: m }) {
  const isComplete = m.right_type != null
  const hasVotes   = m.total_votes > 0
  const winner     = m.left_votes > m.right_votes ? 'left' : 'right'
  const thumb      = m.left_thumbnail_url || (m.left_type === 'image' ? m.left_url : null)
  const { left, right } = calcPercent(m.left_votes, m.right_votes)

  return (
    <Link
      to={`/matchup/${m.id}`}
      className="block bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
    >
      {/* 썸네일 (aspect-video) */}
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {thumb
          ? <img src={thumb} alt={m.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-3">
              <span className="text-xs text-gray-400 text-center line-clamp-3">{m.title}</span>
            </div>
        }
        {/* 하단 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* 승패 뱃지 */}
        {isComplete && hasVotes && (
          <span className={`absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full ${
            winner === 'left'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            {winner === 'left' ? '✓ 승리' : '✗ 패배'}
          </span>
        )}
        {/* 도전자 대기 중 뱃지 */}
        {!isComplete && (
          <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-amber-900">
            ⏳ 대기중
          </span>
        )}

        {/* 제목 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
          <p className="text-white text-xs font-bold line-clamp-2 leading-snug drop-shadow">
            {m.title}
          </p>
        </div>
      </div>

      {/* 카드 바디 */}
      <div className="px-3 py-2.5">
        {isComplete && hasVotes ? (
          <>
            {/* 투표율 */}
            <div className="flex justify-between text-[10px] font-black mb-1">
              <span className="text-blue-500">{left}%</span>
              <span className="text-gray-400">{formatNumber(m.total_votes)}표</span>
              <span className="text-red-400">{right}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-full" style={{ width: `${left}%` }} />
              <div className="bg-gradient-to-l from-red-400 to-red-300 h-full" style={{ width: `${right}%` }} />
            </div>
          </>
        ) : (
          <p className="text-[10px] text-gray-400">{formatDate(m.created_at)}</p>
        )}
      </div>
    </Link>
  )
}

// ── 내가 투표한 매치업 풀카드 ───────────────────────────────────────
function VotedMatchupFullCard({ vote, matchup: m, pointsEarned }) {
  if (!m) return null

  const isActive  = m.status === 'active'
  const hasVotes  = (m.total_votes || 0) > 0
  const winner    = m.left_votes >= m.right_votes ? 'left' : 'right'
  const myWin     = !isActive && hasVotes && vote.side === winner
  const myLose    = !isActive && hasVotes && vote.side !== winner
  const myLabel   = vote.side === 'left' ? (m.left_label || 'A') : (m.right_label || 'B')

  const leftThumb  = m.left_thumbnail_url  || (m.left_type  === 'image' ? m.left_url  : null)
  const rightThumb = m.right_thumbnail_url || (m.right_type === 'image' ? m.right_url : null)
  const { left, right } = calcPercent(m.left_votes, m.right_votes)

  // 마감까지 남은 시간
  const timeLeft = (() => {
    if (!isActive || !m.expires_at) return null
    const diff = new Date(m.expires_at) - new Date()
    if (diff <= 0) return null
    const h = Math.floor(diff / 3600000)
    const min = Math.floor((diff % 3600000) / 60000)
    if (h > 24) return `${Math.floor(h / 24)}일 후 마감`
    if (h > 0)  return `${h}시간 ${min}분 후 마감`
    return `${min}분 후 마감`
  })()

  // 상태 배지
  const statusBadge = isActive
    ? { label: '진행중 ⏳', cls: 'bg-amber-50 text-amber-600 border-amber-100' }
    : myWin
    ? { label: '적중! 🎯', cls: 'bg-green-50 text-green-600 border-green-100' }
    : { label: '아쉬움 💧', cls: 'bg-blue-50 text-blue-500 border-blue-100' }

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
      style={{ scrollSnapAlign: 'start' }}
    >
      {/* 카드 헤더 */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
          <h3 className="text-sm font-black text-[#22282E] truncate">{m.title}</h3>
        </div>
        <span className="shrink-0 text-[10px] text-gray-400 whitespace-nowrap">
          내 선택: <span className="font-black text-[#22282E]">{myLabel}</span>
        </span>
      </div>

      {/* 썸네일 2분할 */}
      <div className="px-4 pb-3">
        <div className="relative grid grid-cols-2 gap-2">

          {/* A측 */}
          <div className={`relative aspect-square rounded-xl overflow-hidden bg-gray-50 ${vote.side === 'left' ? 'ring-2 ring-[#22282E]' : ''}`}>
            {leftThumb
              ? <img src={leftThumb} alt="A" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-3">
                  <p className="text-xs font-bold text-gray-600 text-center line-clamp-4">{m.left_text}</p>
                </div>
            }
            {/* MY PICK 오버레이 */}
            {vote.side === 'left' && (
              <div className="absolute inset-0 flex items-start justify-center pt-2">
                <span className="inline-flex items-center gap-0.5 bg-[#22282E] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                  ✓ MY PICK
                </span>
              </div>
            )}
            {/* 퍼센트 */}
            {hasVotes && (
              <div className="absolute bottom-1.5 left-1.5">
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-lg ${
                  !isActive && winner === 'left' ? 'bg-green-500 text-white' : 'bg-black/50 backdrop-blur-sm text-white'
                }`}>{left}%</span>
              </div>
            )}
            {/* 레이블 */}
            {m.left_label && (
              <div className="absolute bottom-1.5 right-1.5">
                <span className="text-[9px] font-black text-white bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md truncate block max-w-[80%]">
                  {m.left_label}
                </span>
              </div>
            )}
          </div>

          {/* 중앙 VS */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className={`w-10 h-10 rounded-full border-2 border-white shadow-xl flex items-center justify-center ${
              isActive ? 'bg-amber-500' : myWin ? 'bg-green-500' : 'bg-[#22282E]'
            }`}>
              <span className="text-white text-[11px] font-black">VS</span>
            </div>
          </div>

          {/* B측 */}
          <div className={`relative aspect-square rounded-xl overflow-hidden bg-gray-50 ${vote.side === 'right' ? 'ring-2 ring-[#22282E]' : ''}`}>
            {rightThumb
              ? <img src={rightThumb} alt="B" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-bl from-pink-50 to-red-100 flex items-center justify-center p-3">
                  <p className="text-xs font-bold text-gray-600 text-center line-clamp-4">{m.right_text}</p>
                </div>
            }
            {/* MY PICK 오버레이 */}
            {vote.side === 'right' && (
              <div className="absolute inset-0 flex items-start justify-center pt-2">
                <span className="inline-flex items-center gap-0.5 bg-[#22282E] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                  ✓ MY PICK
                </span>
              </div>
            )}
            {/* 퍼센트 */}
            {hasVotes && (
              <div className="absolute bottom-1.5 right-1.5">
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-lg ${
                  !isActive && winner === 'right' ? 'bg-green-500 text-white' : 'bg-black/50 backdrop-blur-sm text-white'
                }`}>{right}%</span>
              </div>
            )}
            {/* 레이블 */}
            {m.right_label && (
              <div className="absolute bottom-1.5 left-1.5">
                <span className="text-[9px] font-black text-white bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md truncate block max-w-[80%]">
                  {m.right_label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 투표 바 */}
        {hasVotes && (
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] font-black mb-1">
              <span className={!isActive && winner === 'left' ? 'text-green-500' : 'text-blue-400'}>
                {m.left_label || 'A'} {left}%
              </span>
              <span className="text-gray-400">{formatNumber(m.total_votes)}명 참여</span>
              <span className={!isActive && winner === 'right' ? 'text-green-500' : 'text-red-400'}>
                {right}% {m.right_label || 'B'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-full" style={{ width: `${left}%` }} />
              <div className="bg-gradient-to-l from-red-400 to-red-300 h-full" style={{ width: `${right}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* 카드 하단 */}
      <div className="px-4 py-3 border-t border-gray-50 space-y-2">
        {/* 포인트 / 카운트다운 */}
        {!isActive && (
          <div className="flex items-center gap-1.5 text-xs">
            <Gift size={12} className="text-violet-400" />
            <span className="text-violet-600 font-black">보상: +{pointsEarned}P 획득 완료</span>
            {myWin && <span className="text-green-500 font-bold ml-1">· 안목 적중 보너스!</span>}
          </div>
        )}
        {isActive && timeLeft && (
          <div className="flex items-center gap-1.5 text-xs">
            <Clock size={12} className="text-amber-500" />
            <span className="text-amber-600 font-bold">📢 결과 발표까지 {timeLeft}</span>
          </div>
        )}
        {isActive && !timeLeft && (
          <div className="flex items-center gap-1.5 text-xs">
            <Clock size={12} className="text-amber-500 animate-pulse" />
            <span className="text-amber-600 font-bold">실시간 투표 진행 중</span>
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">
              {isActive
                ? <span>실시간 <span className="font-black text-[#22282E]">{formatNumber(m.total_votes || 0)}명</span> 참여 중</span>
                : <span>최종 <span className="font-black text-[#22282E]">{formatNumber(m.total_votes || 0)}명</span> 참여</span>
              }
            </span>
          </div>
          <Link
            to={`/matchup/${m.id}`}
            className="inline-flex items-center gap-1 text-xs font-black text-[#22282E] hover:text-violet-600 transition-colors"
          >
            {isActive ? '현황 보기' : '결과 보기'}
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── 내가 투표한 매치업 행 (레거시) ──────────────────────────────────
function VotedMatchupRow({ vote, matchup: m }) {
  if (!m) return null
  const isActive  = m.status === 'active'
  const hasVotes  = m.total_votes > 0
  const winner    = m.left_votes >= m.right_votes ? 'left' : 'right'
  const myWin     = vote.side === winner
  const myLabel   = vote.side === 'left' ? (m.left_label || 'A') : (m.right_label || 'B')
  const thumb     = m.left_thumbnail_url || (m.left_type === 'image' ? m.left_url : null)

  return (
    <Link
      to={`/matchup/${m.id}`}
      className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-all duration-200 group"
    >
      {/* 썸네일 */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        {thumb
          ? <img src={thumb} alt={m.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <span className="text-[8px] text-gray-400 text-center px-1 line-clamp-3">{m.title}</span>
            </div>
        }
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        {m.category && (
          <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{m.category}</p>
        )}
        <p className="text-sm font-bold text-[#22282E] truncate">{m.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-gray-500">나의 선택:</span>
          <span className="text-xs font-black text-[#22282E]">{myLabel}</span>
          {!isActive && hasVotes && (
            myWin
              ? <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-green-600">
                  <CheckCircle2 size={10} /> 승리
                </span>
              : <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-red-500">
                  <XCircle size={10} /> 패배
                </span>
          )}
          {isActive && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-gray-400">
              <Clock size={10} /> 진행중
            </span>
          )}
        </div>
      </div>

      {/* 결과 뱃지 */}
      <div className="shrink-0">
        {!isActive && hasVotes ? (
          <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl ${
            myWin ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-500 border border-red-100'
          }`}>
            {myWin ? '✓ 승' : '✗ 패'}
          </span>
        ) : isActive ? (
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
            진행중
          </span>
        ) : (
          <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
        )}
      </div>
    </Link>
  )
}

// ── 활동통계 물결그래프 (단일 차트) ────────────────────────────────────
function ActivityWaveChart({ data }) {
  const { labels, created, voted } = data
  const W = 420
  const H = 150
  const pad = { top: 12, right: 12, bottom: 28, left: 28 }
  const w = W - pad.left - pad.right
  const h = H - pad.top - pad.bottom
  const maxVal = Math.max(1, ...created, ...voted)
  const n = labels.length
  const x = (i) => pad.left + (i / (n - 1 || 1)) * w
  const y = (val) => pad.top + h - (val / maxVal) * h

  // Y축 눈금 (0 ~ maxVal, 최대 6개)
  const yTicks = (() => {
    const step = maxVal <= 5 ? 1 : Math.ceil(maxVal / 5)
    const ticks = []
    for (let v = 0; v <= maxVal; v += step) ticks.push(v)
    if (ticks[ticks.length - 1] !== maxVal) ticks.push(maxVal)
    return [...new Set(ticks)].sort((a, b) => a - b)
  })()

  const smoothPath = (vals) => {
    if (n === 0) return ''
    let d = `M ${x(0)} ${y(vals[0])}`
    for (let i = 1; i < n; i++) {
      const cx = (x(i - 1) + x(i)) / 2
      d += ` C ${cx} ${y(vals[i - 1])}, ${cx} ${y(vals[i])}, ${x(i)} ${y(vals[i])}`
    }
    return d
  }
  const areaPath = (vals) => {
    const line = smoothPath(vals)
    return `${line} L ${x(n - 1)} ${pad.top + h} L ${x(0)} ${pad.top + h} Z`
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> 생성한 매치업
        </span>
        <span className="text-[10px] font-bold text-violet-600 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-500" /> 투표한 매치업
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="gradient-created" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="gradient-voted" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* Y축 눈금선 & 숫자 */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              y1={y(tick)}
              x2={pad.left + w}
              y2={y(tick)}
              stroke="#e5e7eb"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
            <text
              x={pad.left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#9ca3af"
              fontWeight="600"
            >
              {tick}
            </text>
          </g>
        ))}
        {/* Y축 세로선 */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + h} stroke="#d1d5db" strokeWidth="1" />
        {/* 차트 영역 */}
        <path d={areaPath(created)} fill="url(#gradient-created)" />
        <path d={smoothPath(created)} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={areaPath(voted)} fill="url(#gradient-voted)" />
        <path d={smoothPath(voted)} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-medium pl-7">
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  )
}

// ── 유틸 컴포넌트들 ────────────────────────────────────────────────
function MiniStat({ icon, label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-sm font-black text-[#22282E]">{value}</p>
      <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
    </div>
  )
}

function SideStatBox({ icon, label, value, color }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xl mb-0.5">{icon}</p>
      <p className={`text-base font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
    </div>
  )
}

function EmptyState({ emoji, title, desc }) {
  return (
    <div className="py-16 text-center bg-white border border-gray-100 rounded-2xl">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-sm font-bold text-[#22282E] mb-1">{title}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-video bg-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-2 bg-gray-100 rounded-full" />
        <div className="h-1.5 bg-gray-100 rounded-full w-3/4" />
      </div>
    </div>
  )
}

function FullCardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden animate-pulse">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-14 h-5 bg-gray-100 rounded-full" />
        <div className="flex-1 h-4 bg-gray-100 rounded" />
      </div>
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square bg-gray-100 rounded-xl" />
          <div className="aspect-square bg-gray-100 rounded-xl" />
        </div>
      </div>
      <div className="px-4 py-3 border-t border-gray-50 flex justify-between">
        <div className="w-24 h-4 bg-gray-100 rounded" />
        <div className="w-16 h-4 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3.5 border border-gray-100 rounded-2xl animate-pulse">
      <div className="w-16 h-16 bg-gray-100 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  )
}
