import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown, TrendingUp, TrendingDown, Minus,
  ChevronRight, Flame, Plus, Menu, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { formatNumber, getLevel } from '../lib/utils'
import { useUIStore } from '../store/uiStore'
import { RankingCelebrationModal } from '../components/ranking/RankingCelebrationModal'
import { Avatar } from '../components/ui/Avatar'
import { LevelBadge } from '../components/ui/LevelBadge'

// ── 상수 ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',    label: '전체 랭킹', icon: '🏆', lnbLabel: '전체 랭킹' },
  { id: '패션',   label: '패션',      icon: '👗' },
  { id: '맛집',   label: '맛집',      icon: '🍔' },
  { id: '게임',   label: '게임',      icon: '🎮' },
  { id: 'IT/테크', label: 'IT/테크',  icon: '💻' },
  { id: '연예인', label: '연예인',    icon: '⭐' },
  { id: 'OOTD',   label: 'OOTD',     icon: '📸' },
  { id: '스포츠', label: '스포츠',    icon: '⚽' },
]

const PERIOD_OPTIONS = [
  { id: 'weekly',  label: '이번 주' },
  { id: 'monthly', label: '이번 달' },
  { id: 'all',     label: '전체'    },
]
const TYPE_OPTIONS = [
  { id: 'creator', label: '매치업 생성' },
  { id: 'voter',   label: '매치업 투표' },
]
const SORT_OPTIONS = [
  { id: 'points',   label: '포인트순'  },
  { id: 'winrate',  label: '승률순'    },
]

// ── 승률 계산 ────────────────────────────────────────────────────────
function calcWinRate(wins, losses) {
  const total = (wins || 0) + (losses || 0)
  if (!total) return null
  return Math.round(((wins || 0) / total) * 100)
}

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
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-gray-400 transition-colors whitespace-nowrap"
      >
        {selected?.label || label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-[120px] overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                value === opt.id
                  ? 'bg-[#22282E] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
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

// ── TOP 3 포디움 ─────────────────────────────────────────────────────
function Podium({ users, category }) {
  if (!users || users.filter(Boolean).length < 1) return null
  const [second, first, third] = [users[1], users[0], users[2]]
  const catLabel = CATEGORIES.find((c) => c.id === category)

  return (
    <div className="bg-gradient-to-b from-amber-50 via-white to-white rounded-3xl border border-amber-100 px-4 pt-5 pb-0 mb-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-5">
        <Flame size={15} className="text-amber-500" />
        <p className="text-sm font-black text-[#22282E]">
          TOP 3{catLabel && catLabel.id !== 'all' ? ` ${catLabel.icon} ${catLabel.label}` : ''} 랭커
        </p>
      </div>
      <div className="flex items-end justify-center gap-1">
        {/* 2위 */}
        <PodiumCard user={second} rank={2} />
        {/* 1위 */}
        <PodiumCard user={first}  rank={1} />
        {/* 3위 */}
        <PodiumCard user={third}  rank={3} />
      </div>
    </div>
  )
}

function PodiumCard({ user: u, rank }) {
  if (!u) return <div className="flex-1" />
  const wr    = calcWinRate(u.wins, u.losses)
  const lv    = getLevel(u.points || 0)
  const cfg   = {
    1: { base: 'h-24',   gradient: 'from-amber-400 to-yellow-500', ring: 'ring-2 ring-amber-400', av: 'w-16 h-16', medal: '🥇', textColor: 'text-amber-600' },
    2: { base: 'h-16',   gradient: 'from-slate-300 to-gray-400',   ring: 'ring-2 ring-gray-300',  av: 'w-12 h-12', medal: '🥈', textColor: 'text-slate-500' },
    3: { base: 'h-12',   gradient: 'from-orange-300 to-amber-500', ring: 'ring-2 ring-orange-300', av: 'w-12 h-12', medal: '🥉', textColor: 'text-orange-500' },
  }[rank]

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-xl">{cfg.medal}</span>
      <div className={`${cfg.av} rounded-full overflow-hidden ${cfg.ring} shadow-md flex-shrink-0`}>
        {u.avatar_url
          ? <img src={u.avatar_url} alt={u.nickname} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <span className="font-black text-gray-500 text-base">{u.nickname?.[0]?.toUpperCase()}</span>
            </div>
        }
      </div>
      <p className="text-xs font-black text-[#22282E] text-center truncate w-full px-1">{u.nickname}</p>
      <p className="text-[10px] text-gray-400">{lv.emoji} {lv.name}</p>
      {wr !== null && <p className={`text-xs font-black ${cfg.textColor}`}>승률 {wr}%</p>}
      <div className={`w-full ${cfg.base} bg-gradient-to-b ${cfg.gradient} rounded-t-xl flex items-start justify-center pt-2`}>
        <span className="text-xs font-black text-white/90">{rank}위</span>
      </div>
    </div>
  )
}

// ── 순위 테이블 행 ───────────────────────────────────────────────────
function RankRow({ entry, rank, isMe }) {
  const lv = getLevel(entry.points || 0)
  const wr = calcWinRate(entry.wins, entry.losses)
  const matchupCount = entry.total_matchups || 0

  return (
    <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
      isMe ? 'bg-lime-50/80 border-l-[3px] border-l-lime-400' : 'hover:bg-gray-50/80'
    }`}>
      {/* 순위 */}
      <div className="w-7 sm:w-8 text-center flex-shrink-0">
        {rank <= 3
          ? <span className="text-base">{['🥇','🥈','🥉'][rank - 1]}</span>
          : <span className="text-xs font-black text-gray-400 tabular-nums">{rank}</span>
        }
      </div>

      {/* 아바타 + 이름 */}
      <div className="flex items-center gap-2 flex-[2] min-w-0">
        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-100 flex-shrink-0">
          {entry.avatar_url
            ? <img src={entry.avatar_url} alt={entry.nickname} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-[11px] font-black text-gray-500">{entry.nickname?.[0]?.toUpperCase()}</span>
              </div>
          }
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-black truncate ${isMe ? 'text-lime-700' : 'text-[#22282E]'}`}>
            {isMe && <span className="text-lime-500 mr-1 text-[9px]">나</span>}
            {entry.nickname}
          </p>
          <p className="text-[9px] text-gray-400">{lv.emoji} {lv.name}</p>
        </div>
      </div>

      {/* 승률 */}
      <div className="flex-1 text-center hidden sm:block">
        {wr !== null
          ? <span className={`text-xs font-black ${wr >= 70 ? 'text-emerald-500' : wr >= 50 ? 'text-[#22282E]' : 'text-gray-400'}`}>
              {wr}%
            </span>
          : <span className="text-[10px] text-gray-300">-</span>
        }
      </div>

      {/* 매치업 수 */}
      <div className="flex-1 text-center hidden md:block">
        <span className="text-xs font-bold text-gray-500">{matchupCount}회</span>
      </div>

      {/* 포인트 */}
      <div className="flex-1 text-right">
        <span className="text-xs font-black text-[#22282E] tabular-nums">
          {formatNumber(entry.points || 0)}
        </span>
        <span className="text-[9px] text-gray-400 ml-0.5">P</span>
      </div>

      {/* 변동 */}
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
  const [hallOfFameUsers, setHallOfFameUsers] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [page,         setPage]         = useState(0)
  const [hasMore,      setHasMore]      = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)

  const loaderRef = useRef(null)
  const PAGE_SIZE = 20

  // 필터 변경 시 리셋
  useEffect(() => {
    setRankings([])
    setPage(0)
    setHasMore(true)
    setMyRank(null)
  }, [category, period, typeTab, sortBy])

  useEffect(() => { loadRankings() }, [category, period, typeTab, sortBy, page])

  // 무한 스크롤
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && hasMore && !loading) setPage((p) => p + 1) },
      { threshold: 0.1 }
    )
    if (loaderRef.current) obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loading])

  // 명예의 전당 (TOP 3 유저)
  useEffect(() => {
    supabase.from('profiles')
      .select('id, nickname, avatar_url, points')
      .order('points', { ascending: false })
      .limit(3)
      .then(({ data }) => setHallOfFameUsers(data || []))
  }, [])

  // TOP 10 축하 모달: 내 순위가 ≤ 10 일 때 세션 당 1회 표시
  useEffect(() => {
    if (!myRank || !user) return
    if (myRank.rank > 10) return
    const key = `vics_celebration_${user.id}_${period}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const t = setTimeout(() => setShowCelebration(true), 800)
    return () => clearTimeout(t)
  }, [myRank, user, period])

  const loadRankings = async () => {
    setLoading(true)
    try {
      const from = page * PAGE_SIZE
      const to   = from + PAGE_SIZE - 1
      const orderCol = sortBy === 'winrate' ? 'wins' : sortBy === 'matchups' ? 'total_matchups' : 'points'

      const { data } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, points, total_matchups, wins, losses')
        .order(orderCol, { ascending: false })
        .range(from, to)

      const rows = (data || []).map((r, i) => {
        const seed   = (r.points || 0) % 6
        const change = seed === 0 ? 'NEW' : seed === 1 ? 0 : seed === 2 ? 1 : seed === 3 ? -1 : seed === 4 ? 2 : -2
        return { ...r, _change: (from + i) < 3 ? 0 : change }
      })

      if (rows.length < PAGE_SIZE) setHasMore(false)
      if (page === 0) {
        setRankings(rows)
        // 내 순위 계산
        if (user?.id && profile) {
          const myIdx = rows.findIndex((r) => r.id === user.id)
          if (myIdx !== -1) {
            setMyRank({ rank: from + myIdx + 1, data: rows[myIdx] })
          } else {
            const { count } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .gt(orderCol, profile[orderCol] || 0)
            setMyRank({ rank: (count || 0) + 1, data: { ...profile, _change: null } })
          }
        }
      } else {
        setRankings((prev) => [...prev, ...rows])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => { user ? openCreateDrawer() : openLoginModal() }

  const activeCat = CATEGORIES.find((c) => c.id === category)
  const top3      = [rankings[1], rankings[0], rankings[2]]

  // ── LNB 내용 (공통) ────────────────────────────────────────────────
  const LNBContent = () => (
    <div className="space-y-1">
      {/* 랭킹 센터 헤더 */}
      <div className="px-3 py-3 mb-1">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">랭킹 센터</p>
      </div>

      {/* 전체 랭킹 */}
      <button
        onClick={() => { setCategory('all'); setLnbOpen(false) }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
          category === 'all'
            ? 'bg-[#22282E] text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <span>🏆</span>전체 랭킹
      </button>

      {/* 카테고리별 */}
      <div>
        <p className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <ChevronRight size={10} />카테고리별
        </p>
        {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setCategory(cat.id); setLnbOpen(false) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
              category === cat.id
                ? 'bg-[#22282E] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{cat.icon}</span>{cat.label}
            {category === cat.id && <ChevronRight size={12} className="ml-auto" />}
          </button>
        ))}
      </div>

      {/* 명예의 전당 (TOP 3 유저) */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <Flame size={10} className="text-orange-400" />명예의 전당
        </p>
        {hallOfFameUsers.length > 0
          ? hallOfFameUsers.map((u, i) => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <span className="text-xs font-black text-gray-400 flex-shrink-0 w-5">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <Avatar src={u.avatar_url} alt={u.nickname} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-700 truncate">{u.nickname || '사용자'}</p>
                  <div className="flex items-center gap-1">
                    <LevelBadge points={u.points || 0} variant="badge" className="text-[10px] px-1 py-0" />
                    <span className="text-[10px] text-gray-400">{formatNumber(u.points || 0)}P</span>
                  </div>
                </div>
              </div>
            ))
          : <p className="px-3 text-xs text-gray-400">데이터 로딩 중…</p>
        }
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
    <div className="max-w-screen-lg mx-auto">

      {/* ── 페이지 타이틀 (모바일) ── */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
            <span className="text-base">🏆</span>
          </div>
          <h1 className="text-lg font-black text-[#22282E]">RANKING</h1>
        </div>
        <button onClick={() => setLnbOpen(true)}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
          <Menu size={18} />
        </button>
      </div>

      {/* ── 모바일 카테고리 가로 스크롤 탭 ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none lg:hidden">
        {CATEGORIES.map((cat) => (
          <button key={cat.id} onClick={() => setCategory(cat.id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-full border transition-all ${
              category === cat.id
                ? 'bg-[#22282E] text-white border-[#22282E]'
                : 'bg-white text-gray-500 border-gray-200'
            }`}>
            <span>{cat.icon}</span>{cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">

        {/* ════════════════════════════════════════
            LNB (데스크탑 고정 사이드바)
        ════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sticky top-20">
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
              {activeCat?.icon} {activeCat?.id === 'all' ? '전체 랭킹' : `${activeCat?.label || '전체'} 랭킹`}
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
                label="유형"
                options={TYPE_OPTIONS}
                value={typeTab}
                onChange={setTypeTab}
              />
              <Dropdown
                label="정렬"
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={setSortBy}
              />
            </div>
          </div>

          {/* TOP 3 포디움 */}
          {rankings.length >= 3 && (
            <Podium users={top3} category={category} />
          )}

          {/* 순위 테이블 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

            {/* 테이블 헤더 */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
              <div className="w-7 sm:w-8 text-center flex-shrink-0">#</div>
              <div className="flex-[2]">유저</div>
              <div className="flex-1 text-center hidden sm:block">승률</div>
              <div className="flex-1 text-center hidden md:block">
                {typeTab === 'creator' ? '생성' : '투표'}
              </div>
              <div className="flex-1 text-right">포인트</div>
              <div className="w-8 text-right flex-shrink-0">변동</div>
            </div>

            {/* Top 3 행 */}
            {rankings.slice(0, 3).map((entry, i) => (
              <RankRow key={entry.id} entry={entry} rank={i + 1} isMe={entry.id === user?.id} />
            ))}

            {/* 4위~ */}
            {rankings.slice(3).map((entry, i) => (
              <RankRow key={entry.id} entry={entry} rank={i + 4} isMe={entry.id === user?.id} />
            ))}

            {loading && (
              <div className="py-6 flex items-center justify-center gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#22282E] rounded-full animate-spin" />
                <span className="text-xs">불러오는 중…</span>
              </div>
            )}
            {!hasMore && rankings.length > 0 && (
              <p className="py-4 text-center text-xs text-gray-400">전체 랭킹을 모두 불러왔어요 🏁</p>
            )}
            {rankings.length === 0 && !loading && (
              <div className="py-14 text-center">
                <p className="text-3xl mb-2">🏆</p>
                <p className="text-sm font-bold text-gray-400">아직 랭킹 데이터가 없어요</p>
              </div>
            )}
          </div>

          <div ref={loaderRef} className="h-4" />
        </div>
      </div>

      {/* ════════════════════════════════════════
          내 랭킹 Sticky Bar (하단 고정)
      ════════════════════════════════════════ */}
      {user && myRank && (
        <div className="fixed bottom-16 sm:bottom-4 left-0 right-0 z-30 px-3 max-w-screen-lg mx-auto pointer-events-none">
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
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-lime-100 flex items-center justify-center">
                      <span className="text-xs font-black text-lime-600">{profile?.nickname?.[0]?.toUpperCase()}</span>
                    </div>
                }
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-lime-700 truncate">{profile?.nickname}</p>
                <p className="text-[10px] text-gray-500">
                  {formatNumber(profile?.points || 0)}P
                  {calcWinRate(profile?.wins, profile?.losses) !== null && (
                    <span className="ml-2 text-emerald-500 font-bold">승률 {calcWinRate(profile.wins, profile.losses)}%</span>
                  )}
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
            {myRank.rank <= 10 && (
              <button
                onClick={() => {
                  if (user) sessionStorage.removeItem(`vics_celebration_${user.id}_${period}`)
                  setShowCelebration(true)
                }}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,#a855f7,#ec4899)', boxShadow: '0 2px 12px rgba(168,85,247,0.4)' }}
              >
                🎉 카드
              </button>
            )}

            <Link to="/mypage"
              className="flex-shrink-0 px-3 py-1.5 bg-lime-50 border border-lime-200 text-xs font-black text-lime-600 rounded-xl hover:bg-lime-100 transition-colors">
              상세
            </Link>
          </div>
        </div>
      )}

      {/* ── 모바일 LNB 드로어 ── */}
      {lnbOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setLnbOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 z-50 w-[min(18rem,90vw)] max-w-[18rem] bg-white shadow-2xl overflow-y-auto"
            style={{ animation: 'fade-in-up 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <p className="font-black text-[#22282E]">🏆 랭킹 센터</p>
              <button onClick={() => setLnbOpen(false)} className="p-1.5 rounded-xl hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-3">
              <LNBContent />
            </div>
          </div>
        </>
      )}

      {/* ── TOP 10 축하 모달 ── */}
      {showCelebration && myRank && (
        <RankingCelebrationModal
          rank={myRank.rank}
          nickname={profile?.nickname}
          avatar_url={profile?.avatar_url}
          points={profile?.points}
          period={period}
          top1={rankings[0] || null}
          profile={profile}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  )
}
