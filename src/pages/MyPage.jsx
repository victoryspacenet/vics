import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  Edit2, Trophy, Target, Swords,
  CheckCircle2, XCircle, Clock, ChevronRight,
  ChevronLeft, Plus, Flame, Users, ArrowRight, Zap, Gift, CalendarCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { formatNumber, calcPercent, cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'
import { sanitizeText, safeMediaUrl } from '../lib/sanitize'
import {
  getTier,
  getTierIndex,
  TIERS,
  TIER_MIN_HOLD_POINTS,
  profileHoldPoints,
} from '../lib/tiers'
import { TierBadge } from '../components/ui/TierBadge'
import { EMPTY_TIER_RANK_INFO } from '../lib/creatorRankSnapshot'
import { fetchMyPageListsBundle } from '../lib/myPageData'
import { VipPromoButton } from '../components/main/VipPromoButton'
import { VsBadge } from '../components/ui/VsBadge'
import { MatchupThumbFrame } from '../components/ui/MatchupThumbFrame'
import { POINTS_VOTER_DRAW, POINTS_VOTER_HIT, POINTS_VOTER_MISS } from '../lib/pointRewards'
import { getMyPageNeonShell } from '../lib/neonProfileTheme'
import { FandomBronzeStarBadge } from '../components/fandom/FandomBronzeStarBadge'
import { FoundingMemberBadge } from '../components/profile/FoundingMemberBadge'
import { fandomTierHasGoldProfileGlow, fandomTierHasSilverProfileGlow } from '../lib/fandomTiers'
import { isRankingBadgeActive, getRankingBadgeDays, getRankingBadgeRemainingDays } from '../lib/rankingBadge'
import { TendencyReportMyPageCard } from '../components/tendency/TendencyReportMyPageCard'

/** 전체 포인트 랭킹 순위 — TOP10은 랭킹 축하 모달과 동일 Gold·Silver·Bronze·TOP 10, 그 외 N위 */
function overallRankGradeLabel(rank) {
  const n = typeof rank === 'number' && Number.isFinite(rank) ? rank : Number(rank)
  if (!Number.isFinite(n) || n < 1) return null
  if (n === 1) return 'Gold'
  if (n === 2) return 'Silver'
  if (n === 3) return 'Bronze'
  if (n <= 10) return 'TOP 10'
  return `${n}위`
}

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
const VOTER_RESULT_POINTS = { win: POINTS_VOTER_HIT, lose: POINTS_VOTER_MISS, draw: POINTS_VOTER_DRAW }
const ATTENDANCE_POINTS = 10  // 출석 기본 포인트
const ATTENDANCE_STREAK_BONUS = 70 // 7일 연속 출석 시(매 7일마다) 보너스 — 7·14·21…일째

/** 섹션 카드 (MZ 파스텔) — 네온 테마 시에도 본문 카드는 가독성 위해 유지 */
const SECTION_CARD =
  'rounded-2xl border border-pink-200/55 bg-white/93 shadow-[0_6px_32px_-12px_rgba(244,114,182,0.25)] backdrop-blur-[2px]'
const LIST_CARD =
  'rounded-2xl border border-pink-100/45 bg-white/95 shadow-sm shadow-pink-100/20'

export function MyPage() {
  const { user, profile, fetchProfile, loading: authLoading } = useAuthStore()
  const { openCreateDrawer, openLoginModal, showToast } = useUIStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const [attendanceChecked, setAttendanceChecked] = useState(false)
  const [attendanceConsecutive, setAttendanceConsecutive] = useState(0)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [sortCreated,      setSortCreated]       = useState('latest')
  const [filterCreated,    setFilterCreated]     = useState('all')
  const [filterVoted,      setFilterVoted]       = useState('all')
  const [createdMatchups,  setCreatedMatchups]   = useState([])
  const [votedMatchups,    setVotedMatchups]     = useState([])
  const [stats,            setStats]             = useState(null)
  const [tierRankSnapshot, setTierRankSnapshot]   = useState(() => ({ ...EMPTY_TIER_RANK_INFO }))
  const [loading,          setLoading]           = useState(true)
  const [chartPeriod,      setChartPeriod]       = useState('weekly')  // 'weekly' | 'monthly'
  const createdListRef = useRef(null)
  const votedListRef   = useRef(null)

  const patchSearch = useCallback((updates) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') n.delete(k)
        else n.set(k, String(v))
      })
      return n
    }, { replace: true })
  }, [setSearchParams])

  const neonShell = useMemo(() => getMyPageNeonShell(profile), [profile])
  const goldProfileGlow = useMemo(
    () => fandomTierHasGoldProfileGlow(profile?.fandom_tier),
    [profile?.fandom_tier],
  )
  const silverProfileGlow = useMemo(
    () => fandomTierHasSilverProfileGlow(profile?.fandom_tier),
    [profile?.fandom_tier],
  )

  const fetchAttendanceStatus = async () => {
    if (!user) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('attendances')
        .select('checked_at')
        .eq('user_id', user.id)
        .eq('checked_at', today)
        .maybeSingle()
      setAttendanceChecked(!!data)
    } catch { /* attendances 테이블 없을 수 있음 */ }
  }

  const handleCheckAttendance = async () => {
    if (!user || attendanceChecked || attendanceLoading) return
    setAttendanceLoading(true)
    try {
      const { data, error } = await supabase.rpc('check_attendance')
      if (error) throw error
      if (data?.ok) {
        setAttendanceChecked(true)
        setAttendanceConsecutive(data.consecutive || 1)
        fetchProfile(user.id, { force: true })
        showToast(`출석 완료! +${data.points || ATTENDANCE_POINTS}P 획득 🎉`, 'success')
      } else {
        showToast(data?.error || '출석 체크에 실패했어요', 'error')
      }
    } catch (err) {
      showToast(err.message || '출석 체크에 실패했어요', 'error')
    } finally {
      setAttendanceLoading(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const bundle = await fetchMyPageListsBundle(user.id)
      setCreatedMatchups(bundle.createdMatchups)
      setVotedMatchups(bundle.votedMatchups)
      setTierRankSnapshot(bundle.tierRankSnapshot)
      setStats(bundle.stats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void fetchData()
    void fetchAttendanceStatus()
  }, [user])

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

  const filteredVoted = votedMatchups.filter((v) => {
    const m = v.matchups
    if (!m) return false
    const isActive = m.status === 'active'
    const isDraw   = (m.left_votes || 0) === (m.right_votes || 0)
    const winner   = isDraw ? null : (m.left_votes > m.right_votes ? 'left' : 'right')
    const myWin    = !isDraw && winner && v.side === winner && m.total_votes > 0 && !isActive
    const myLose   = !isDraw && m.total_votes > 0 && !isActive && v.side !== winner
    if (filterVoted === 'win')  return myWin
    if (filterVoted === 'lose') return myLose
    if (filterVoted === 'live') return isActive
    return true
  })
  const totalVotedPages = Math.max(1, Math.ceil(filteredVoted.length / VOTED_PAGE_SIZE))

  const activeTab = searchParams.get('tab') === 'voted' ? 'voted' : 'created'
  const rawCp = Math.max(1, parseInt(searchParams.get('cp') || '1', 10) || 1)
  const rawVp = Math.max(1, parseInt(searchParams.get('vp') || '1', 10) || 1)
  const createdPage = Math.min(rawCp, totalCreatedPages)
  const votedPage = Math.min(rawVp, totalVotedPages)

  const pagedCreated = filteredCreated.slice(
    (createdPage - 1) * CREATED_PAGE_SIZE,
    createdPage * CREATED_PAGE_SIZE,
  )
  const pagedVoted = filteredVoted.slice(
    (votedPage - 1) * VOTED_PAGE_SIZE,
    votedPage * VOTED_PAGE_SIZE,
  )

  const goCreatedPage = (p) => {
    patchSearch({ tab: 'created', cp: p })
    createdListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleFilterChange = (id) => {
    setFilterCreated(id)
    patchSearch({ cp: 1 })
  }

  // ── 투표 탭 계산 ──────────────────────────────────────────────────
  const votesWithResult = votedMatchups.filter((v) => {
    const m = v.matchups
    return m && m.total_votes > 0 && m.status !== 'active'
  })
  const votedWins  = votesWithResult.filter((v) => {
    const m = v.matchups
    const isDraw = (m.left_votes || 0) === (m.right_votes || 0)
    const winner = isDraw ? null : (m.left_votes > m.right_votes ? 'left' : 'right')
    return !isDraw && winner && v.side === winner
  }).length
  const voteWinRate = votesWithResult.length > 0
    ? Math.round((votedWins / votesWithResult.length) * 100)
    : 0
  const totalVotedPoints = useMemo(() => {
    return votedMatchups.reduce((sum, v) => {
      const m = v.matchups
      const isActive = m?.status === 'active'
      const hasVotes = (m?.total_votes || 0) > 0
      const isDraw = (m?.left_votes || 0) === (m?.right_votes || 0)
      const winner = isDraw ? null : ((m?.left_votes || 0) > (m?.right_votes || 0) ? 'left' : 'right')
      const myWin = !isActive && hasVotes && !isDraw && v.side === winner
      const pts =
        !isActive && hasVotes
          ? (isDraw ? VOTER_RESULT_POINTS.draw : myWin ? VOTER_RESULT_POINTS.win : VOTER_RESULT_POINTS.lose)
          : 0
      return sum + pts
    }, 0)
  }, [votedMatchups])

  const goVotedPage = (p) => {
    patchSearch({ tab: 'voted', vp: p })
    votedListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const handleVotedFilterChange = (id) => {
    setFilterVoted(id)
    patchSearch({ vp: 1 })
  }

  const points = profile?.points || 0
  const matchupTier = useMemo(
    () => getTier(profile || {}, tierRankSnapshot),
    [profile, tierRankSnapshot],
  )
  const tierHoldRingProgress = useMemo(() => {
    const id = matchupTier.id
    const i = getTierIndex(id)
    const curMin = TIER_MIN_HOLD_POINTS[id] ?? 0
    const pts = profileHoldPoints(profile || {})
    if (i >= TIERS.length - 1) return 100
    const nextId = TIERS[i + 1].id
    const nextMin = TIER_MIN_HOLD_POINTS[nextId] ?? curMin
    if (nextMin <= curMin) return 100
    return Math.min(100, Math.round(((pts - curMin) / (nextMin - curMin)) * 100))
  }, [matchupTier.id, profile])
  /** 만든 매치업(작성자 = 좌측) + 투표한 타인 매치업의 승·패를 합산한 총승률 (무승부·미종료 제외) */
  const combinedOutcome = useMemo(() => {
    if (!user?.id) return { wins: 0, losses: 0, rate: 0 }
    let wins = 0
    let losses = 0

    for (const m of createdMatchups) {
      if (m.status === 'active') continue
      if (m.right_type == null) continue
      const tv = m.total_votes || 0
      if (tv === 0) continue
      const lv = m.left_votes || 0
      const rv = m.right_votes || 0
      if (lv === rv) continue
      const winner = lv > rv ? 'left' : 'right'
      if (winner === 'left') wins += 1
      else losses += 1
    }

    for (const v of votedMatchups) {
      const m = v.matchups
      if (!m || m.user_id === user.id) continue
      if (m.status === 'active') continue
      const tv = m.total_votes || 0
      if (tv === 0) continue
      const lv = m.left_votes || 0
      const rv = m.right_votes || 0
      if (lv === rv) continue
      const winner = lv > rv ? 'left' : 'right'
      if (v.side === winner) wins += 1
      else losses += 1
    }

    const n = wins + losses
    const rate = n > 0 ? Math.round((wins / n) * 100) : 0
    return { wins, losses, rate }
  }, [user?.id, createdMatchups, votedMatchups])

  const totalMatchups = createdMatchups.length + votedMatchups.length

  // 활동통계 차트 데이터 (주간 7일 / 월간 4주)
  const chartData = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
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
        created.push(realCreated)
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
        created.push(realCreated)
        voted.push(votedMatchups.filter((v) => {
          const t = new Date(v.created_at).getTime()
          return t >= weekStart.getTime() && t <= weekEnd.getTime()
        }).length)
      }
      return { labels, created, voted }
    }
  }, [chartPeriod, createdMatchups, votedMatchups])

  if (authLoading) {
    return (
      <div
        className={cn(
          LAYOUT_CONTENT_MAX_WIDTH_CLASS,
          'mx-auto -mx-4 flex min-h-[45vh] flex-col items-center justify-center rounded-2xl px-4 py-16',
          neonShell.pageWrap,
        )}
      >
        <div
          className="h-10 w-10 border-2 border-pink-200 border-t-fuchsia-600 rounded-full animate-spin"
          aria-hidden
        />
        <p className="mt-4 text-sm font-bold text-fuchsia-800/70">세션 확인 중…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto -mx-4 rounded-2xl px-4 py-4 sm:py-6', neonShell.pageWrap)}>

      {/* ══ 프로필 헤더 ══ */}
      <div
        className={cn(
          neonShell.headerSection,
          !loading && goldProfileGlow && 'vics-fandom-gold-profile-header',
          !loading && silverProfileGlow && 'vics-fandom-silver-profile-header',
        )}
      >
        {loading ? (
          <ProfileHeaderSkeleton />
        ) : (
        <div className="flex w-full flex-col sm:flex-row items-center sm:items-start gap-6">

          {/* 아바타 — 모바일에서 닉네임과 동일 축으로 정확히 가운데 */}
          <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-start">
            <div className="relative group w-fit max-w-full">
              {goldProfileGlow ? (
                <div className="vics-fandom-gold-avatar-wrap">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-amber-100/80">
                    {profile?.avatar_url
                      ? <img src={safeMediaUrl(profile.avatar_url)} alt={profile?.nickname ?? ''} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-200 to-amber-500">
                          <span className="text-3xl font-black text-amber-900">
                            {profile?.nickname?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                    }
                  </div>
                </div>
              ) : silverProfileGlow ? (
                <div className="vics-fandom-silver-avatar-wrap">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-slate-100/70">
                    {profile?.avatar_url
                      ? <img src={safeMediaUrl(profile.avatar_url)} alt={profile?.nickname ?? ''} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                          <span className="text-3xl font-black text-slate-600">
                            {profile?.nickname?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                    }
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-offset-2 overflow-hidden bg-pink-100/50',
                    neonShell.avatarRing,
                  )}
                >
                  {profile?.avatar_url
                    ? <img src={safeMediaUrl(profile.avatar_url)} alt={profile?.nickname ?? ''} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-100 to-fuchsia-200">
                        <span className="text-3xl font-black text-fuchsia-700">
                          {profile?.nickname?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                  }
                </div>
              )}
              <Link
                to="/mypage/edit"
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Edit2 size={20} className="text-white" />
              </Link>
            </div>
          </div>

          {/* 닉네임 + 이메일 + 바이오 — 모바일에서 아바타와 동일 가로폭 기준 중앙 */}
          <div className="flex w-full min-w-0 flex-1 flex-col text-center sm:w-auto sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-1">
              <h1 className={cn('text-2xl font-black', neonShell.nicknameClass)}>
                {profile?.nickname || '사용자'}
              </h1>
              <FoundingMemberBadge profile={profile} variant="pill" />
              <FandomBronzeStarBadge tierId={profile?.fandom_tier} size={18} />
              <span className="text-lg" title={`매치업 등급 ${matchupTier.name}`}>{matchupTier.emoji}</span>
            </div>
            <p className={cn('text-sm mb-2', neonShell.subtextClass)}>{user.email}</p>
            {profile?.bio && (
              <p className={cn('text-sm max-w-sm line-clamp-2 mb-3', neonShell.bioClass)}>
                {sanitizeText(profile.bio)}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Link
                to="/mypage/edit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-fuchsia-800/85 border border-pink-200/70 rounded-full bg-white/70 hover:bg-pink-50/80 transition-colors"
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
        )}
      </div>

      <TendencyReportMyPageCard userId={user?.id} />

      {/* ══ My 레벨 ══ */}
      <div className={`${SECTION_CARD} p-5 mb-6`}>
        {loading ? (
          <ProfileLevelSkeleton />
        ) : (
        <>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_3px_12px_-2px_rgba(251,146,60,0.5)] shrink-0">
              <Trophy size={14} className="text-white" strokeWidth={2.5} />
            </span>
            <h2 className="text-base font-black leading-none bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">My 등급</h2>
          </div>
          <div className="flex items-center gap-2">
            <TierBadge profile={profile} rankInfo={tierRankSnapshot} variant="compact" />
            <VipPromoButton />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center shrink-0">
            <CircularTierRing
              tierEmoji={matchupTier.emoji}
              rankLabel={points > 0 ? overallRankGradeLabel(stats?.rank) : null}
              progressPercent={tierHoldRingProgress}
            />
            <div className="text-center mt-3">
              <p className="text-sm font-bold text-[#22282E]">
                {matchupTier.emoji} {matchupTier.name}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className={cn('font-black', neonShell.pointsAccent)}>{formatNumber(points)}</span>
                <span className="text-gray-400"> P</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full sm:w-auto">
            <SideStatBox variant="rank" icon="🏅" label="랭킹" value={typeof stats?.rank === 'number' ? `${stats.rank}위` : '-'} color="text-amber-600" />
            <SideStatBox variant="rate" icon="📊" label="총승률" value={`${combinedOutcome.rate}%`} color="text-sky-600" />
            <SideStatBox variant="wins" icon="🏆" label="총승리" value={`${combinedOutcome.wins}승`} color="text-emerald-600" />
            <SideStatBox variant="total" icon="⚔️" label="총 매치업" value={`${totalMatchups}전`} color="text-violet-600" />
          </div>
        </div>

        {/* ── TOP 10 기념 배지 현황 ── */}
        {isRankingBadgeActive(profile) && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60">
            <div className="relative shrink-0 flex items-center justify-center w-10 h-10">
              <span className="text-3xl leading-none">🏅</span>
              <span
                className="absolute inset-0 flex items-center justify-center font-black"
                style={{
                  fontSize: '10px',
                  color: '#111',
                  WebkitTextStroke: '2px #fff',
                  paintOrder: 'stroke fill',
                  textShadow: '0 0 4px rgba(255,255,255,0.9)',
                }}
              >
                {profile.ranking_badge_rank}위
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-800">
                TOP 10 기념 배지 ({getRankingBadgeDays(profile.ranking_badge_rank)}일) 이용 중
              </p>
              <p className="text-[11px] text-amber-600/80 mt-0.5">
                {profile.ranking_badge_rank}위 달성 · 만료까지 {getRankingBadgeRemainingDays(profile)}일 남음
              </p>
            </div>
            <Link
              to="/rewards"
              className="shrink-0 text-[11px] font-bold text-amber-700 hover:text-amber-900 transition-colors"
            >
              리워드 센터
            </Link>
          </div>
        )}
        </>
        )}
      </div>

      {/* ══ 출석 체크 ══ */}
      <div className={`${SECTION_CARD} p-5 mb-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 shadow-[0_2px_8px_-2px_rgba(20,184,166,0.5)] shrink-0">
              <CalendarCheck size={13} className="text-white" strokeWidth={2.5} />
            </span>
            <h3 className="text-sm font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">출석 체크</h3>
          </div>
          <span className="text-xs text-gray-400">일 1회 · +{ATTENDANCE_POINTS}P</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          {attendanceChecked ? (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50/70 border border-emerald-200/70 shadow-sm">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <span className="text-sm font-bold text-emerald-700">오늘 출석 완료!</span>
              {attendanceConsecutive > 1 && (
                <span className="text-xs font-bold text-teal-600">· {attendanceConsecutive}일 연속 🔥</span>
              )}
            </div>
          ) : (
            <button
              onClick={handleCheckAttendance}
              disabled={attendanceLoading}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:via-teal-600 hover:to-cyan-600 text-white text-sm font-bold shadow-[0_4px_16px_-4px_rgba(20,184,166,0.55)] hover:shadow-[0_6px_20px_-4px_rgba(20,184,166,0.7)] transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
            >
              {attendanceLoading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <CalendarCheck size={16} strokeWidth={2.5} />
              )}
              출석 체크하고 +{ATTENDANCE_POINTS}P 받기
            </button>
          )}
        </div>
      </div>

      {/* ══ 활동통계 물결그래프 ══ */}
      <div className={`${SECTION_CARD} p-5 mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-[0_2px_8px_-2px_rgba(168,85,247,0.45)] shrink-0">
              <Zap size={13} className="text-white" strokeWidth={2.5} />
            </span>
            <h3 className="text-sm font-black bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">활동통계</h3>
          </div>
          <div className="flex gap-1 bg-fuchsia-100/45 rounded-full p-1 border border-pink-100/40">
            {[
              { id: 'weekly', label: '주간' },
              { id: 'monthly', label: '월간' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setChartPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                  chartPeriod === p.id ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-sm' : 'text-fuchsia-800/60 hover:text-fuchsia-950'
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
          <div className="flex bg-white/60 rounded-xl p-1 mb-5 min-w-0 border border-pink-200/50 shadow-[inset_0_2px_6px_rgba(244,114,182,0.1)]">
            {[
              { id: 'created', label: '내가 만든 매치업', count: createdMatchups.length },
              { id: 'voted',   label: '내가 투표한 매치업', count: votedMatchups.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => patchSearch({ tab: tab.id })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all min-w-0 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-[0_2px_10px_-3px_rgba(192,38,211,0.45)]'
                    : 'text-fuchsia-700/65 hover:text-fuchsia-900'
                }`}
              >
                {tab.label}
                {!loading && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-pink-100/70 text-fuchsia-700/80'
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
              <div className="relative bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-500 rounded-2xl p-4 mb-4 text-white overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute -right-2 bottom-0 w-20 h-20 rounded-full bg-white/5" />
                <p className="text-sm text-white/75 mb-0.5 relative z-10">{profile?.nickname || '사용자'}님은 지금까지</p>
                <p className="text-lg font-black flex items-center gap-2 relative z-10">
                  <Flame size={18} className="text-amber-300" />
                  {createdMatchups.length}개의 매치업을 이끌었습니다!
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/70 relative z-10">
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
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white/80 border-2 border-dashed border-pink-200/70 rounded-2xl hover:border-emerald-400 hover:bg-lime-50/90 group transition-all mb-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-lime-400 to-emerald-400 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Plus size={18} className="text-white stroke-[2.5]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-[#22282E]">새로운 매치업 생성</p>
                    <p className="text-xs text-gray-400">아직 당신의 매치업을 기다리는 팬덤이 많아요!</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-lime-500 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 필터 탭 + 정렬 */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-1 bg-rose-100/45 rounded-full p-1 min-w-0 flex-wrap border border-pink-100/35">
                  {CREATED_FILTER.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleFilterChange(f.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                        filterCreated === f.id
                          ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-sm'
                          : 'text-fuchsia-800/65 hover:text-fuchsia-950'
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
                <div className="flex items-center gap-1 bg-cyan-50/80 rounded-full p-1 border border-cyan-100/50">
                  {CREATED_SORT.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSortCreated(s.id)
                        patchSearch({ cp: 1 })
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all ${
                        sortCreated === s.id
                          ? 'bg-white text-fuchsia-900 shadow-sm border border-pink-100/50'
                          : 'text-fuchsia-700/50 hover:text-fuchsia-900'
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
                    desc="첫 번째 매치업을 만들어 경쟁을 시작해보세요!"
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
                    {formatNumber(totalVotedPoints)}P 누적 획득
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
                    <p className="text-[10px] text-white/70">종료 후 결과에 따라 최대 {VOTER_RESULT_POINTS.win}P!</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-white/70 group-hover:translate-x-1 transition-transform" />
              </Link>

              {/* 필터 탭 */}
              <div className="flex items-center gap-1 bg-violet-100/40 rounded-full p-1 mb-4 overflow-x-auto scrollbar-hide border border-violet-100/50">
                {VOTED_FILTER.map((f) => {
                  const count = f.id === 'all'  ? votedMatchups.length
                              : f.id === 'win'  ? votedMatchups.filter(v => { const m = v.matchups; if (!m || m.status === 'active') return false; const draw = (m.left_votes || 0) === (m.right_votes || 0); const w = draw ? null : (m.left_votes > m.right_votes ? 'left' : 'right'); return !draw && w && v.side === w && m.total_votes > 0 }).length
                              : f.id === 'lose' ? votedMatchups.filter(v => { const m = v.matchups; if (!m || m.status === 'active') return false; const draw = (m.left_votes || 0) === (m.right_votes || 0); const w = draw ? null : (m.left_votes > m.right_votes ? 'left' : 'right'); return !draw && v.side !== w && m.total_votes > 0 }).length
                              : votedMatchups.filter(v => v.matchups?.status === 'active').length
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleVotedFilterChange(f.id)}
                      className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                        filterVoted === f.id
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-sm'
                          : 'text-violet-800/70 hover:text-violet-950'
                      }`}
                    >
                      {f.id === 'win' ? '🎯' : f.id === 'lose' ? '💧' : f.id === 'live' ? '⏳' : null}
                      {f.label}
                      <span className={`text-[9px] px-1 rounded-full ${
                        filterVoted === f.id ? 'bg-white/25 text-white' : 'bg-violet-200/70 text-violet-800/80'
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
                      {pagedVoted.map((v, idx) => {
                        const m = v.matchups
                        const isActive = m?.status === 'active'
                        const hasVotes = (m?.total_votes || 0) > 0
                        const isDraw = (m?.left_votes || 0) === (m?.right_votes || 0)
                        const winner = isDraw ? null : ((m?.left_votes || 0) > (m?.right_votes || 0) ? 'left' : 'right')
                        const myWin = !isActive && hasVotes && !isDraw && v.side === winner
                        const pts =
                          !isActive && hasVotes
                            ? (isDraw ? VOTER_RESULT_POINTS.draw : myWin ? VOTER_RESULT_POINTS.win : VOTER_RESULT_POINTS.lose)
                            : 0
                        return (
                          <VotedMatchupFullCard
                            key={v.matchup_id}
                            vote={v}
                            matchup={m}
                            pointsEarned={pts}
                          />
                        )
                      })}
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

// ── 원형 링: 다음 매치업 등급 최소 보유 P까지 진행 + 중앙 티어 이모지·랭킹 등급 ─────────
function CircularTierRing({ tierEmoji, rankLabel, progressPercent }) {
  const radius        = 50
  const circumference = 2 * Math.PI * radius
  const dashOffset    = circumference - (progressPercent / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90" viewBox="0 0 128 128">
        {/* 배경 링 */}
        <circle
          cx="64" cy="64" r={radius}
          fill="transparent" stroke="#fbcfe8" strokeWidth="9"
        />
        {/* 진행 링 — 현재 티어 보유 P 구간에서 다음 티어 최소 P까지 */}
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
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-2xl leading-none" aria-hidden>{tierEmoji}</span>
        {rankLabel ? (
          <span className="mt-0.5 text-[10px] font-black leading-tight tracking-tight text-[#22282E]">
            {rankLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ── 내가 만든 매치업 풀카드 (세로 리스트) ───────────────────────────
function CreatedMatchupFullCard({ matchup: m }) {
  const isActive   = m.status === 'active'
  const isComplete = m.right_type != null
  const hasVotes   = (m.total_votes || 0) > 0
  const isDraw     = (m.left_votes || 0) === (m.right_votes || 0)
  const winner     = isDraw ? 'draw' : (m.left_votes > m.right_votes ? 'left' : 'right')

  const leftThumb  = m.left_thumbnail_url  || (m.left_type  === 'image' ? m.left_url  : null)
  const rightThumb = m.right_thumbnail_url || (m.right_type === 'image' ? m.right_url : null)
  const { left, right } = calcPercent(m.left_votes, m.right_votes)

  return (
    <div
      className={`${LIST_CARD} overflow-hidden hover:shadow-[0_8px_28px_-8px_rgba(244,114,182,0.3)] hover:-translate-y-0.5 transition-all duration-200 relative`}
      style={{ scrollSnapAlign: 'start' }}
    >
      {/* 상단 색상 바 */}
      <div className={`h-[3px] w-full ${isActive ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400' : 'bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-400'}`} />

      {/* 카드 헤더: 상태 + 제목 */}
      <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* 상태 배지 */}
          {isActive ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-600 text-[10px] font-black border border-emerald-200/70 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              진행 중
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-slate-100 to-gray-100 text-gray-500 text-[10px] font-black border border-gray-200/70">
              ✓ 종료
            </span>
          )}
          <h3 className="text-sm font-black text-[#22282E] truncate">{m.title}</h3>
        </div>
        {/* 도전자 대기 중 */}
        {!isComplete && (
          <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 px-2 py-0.5 rounded-full border border-amber-200/70 shadow-sm">
            ⏳ 대기중
          </span>
        )}
      </div>

      {/* 콘텐츠: 좌우 썸네일 + VS */}
      <div className="px-4 pb-3">
        <div className="relative grid grid-cols-2 gap-2">
          {/* A측 */}
          <MatchupThumbFrame side="left" className="aspect-square w-full">
            {leftThumb
              ? <img src={safeMediaUrl(leftThumb)} alt="A" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-950/90 via-orange-900/80 to-rose-950/85 p-3">
                  <p className="line-clamp-4 text-center text-xs font-bold text-white/90">{m.left_text}</p>
                </div>
            }
            {/* A WIN 뱃지 */}
            {isComplete && hasVotes && !isActive && winner === 'left' && (
              <div className="absolute right-1.5 top-1.5 z-10">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_2px_8px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 size={9} /> WIN
                </span>
              </div>
            )}
          </MatchupThumbFrame>

          {/* 중앙 VS 뱃지 */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <VsBadge size="lg" />
          </div>

          {/* B측 */}
          <MatchupThumbFrame side="right" className="aspect-square w-full">
            {isComplete
              ? rightThumb
                ? <img src={safeMediaUrl(rightThumb)} alt="B" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-950/90 via-fuchsia-900/80 to-indigo-950/85 p-3">
                    <p className="line-clamp-4 text-center text-xs font-bold text-white/90">{m.right_text}</p>
                  </div>
              : <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-950/85 via-teal-950/75 to-cyan-950/80 border border-dashed border-emerald-400/30">
                  <span className="text-2xl">⚔️</span>
                  <p className="px-2 text-center text-[10px] font-black text-emerald-300">도전자 모집 중</p>
                </div>
            }
            {/* B WIN 뱃지 */}
            {isComplete && hasVotes && !isActive && winner === 'right' && (
              <div className="absolute left-1.5 top-1.5 z-10">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_2px_8px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 size={9} /> WIN
                </span>
              </div>
            )}
          </MatchupThumbFrame>
        </div>
      </div>

      {/* 투표 바 */}
      {hasVotes && isComplete && (
        <div className="px-4 pb-2">
          <div className="flex justify-between text-[10px] font-black mb-1">
            <span className="text-amber-600">{m.left_label || 'A'} {left}%</span>
            <span className="text-gray-400">{formatNumber(m.total_votes)}표</span>
            <span className="text-violet-500">{right}% {m.right_label || 'B'}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-l-full" style={{ width: `${left}%` }} />
            <div className="bg-gradient-to-l from-violet-500 to-fuchsia-400 h-full rounded-r-full" style={{ width: `${right}%` }} />
          </div>
        </div>
      )}

      {/* 카드 하단: 참여자 + CTA */}
      <div className="px-4 py-3 border-t border-pink-100/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users size={13} className="text-fuchsia-400" />
          {isActive
            ? <span><span className="font-black text-fuchsia-700">{formatNumber(m.total_votes || 0)}명</span> 실시간 참여 중</span>
            : <span>최종 <span className="font-black text-[#22282E]">{formatNumber(m.total_votes || 0)}명</span> 참여</span>
          }
        </div>
        <Link
          to={`/matchup/${m.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 rounded-full shadow-sm hover:shadow-[0_3px_12px_-3px_rgba(192,38,211,0.5)] hover:-translate-y-0.5 transition-all"
        >
          {isActive ? '현황 보기' : '결과 보기'}
          <ArrowRight size={11} />
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
        className="w-9 h-9 flex items-center justify-center rounded-full border border-fuchsia-200/70 text-fuchsia-400 hover:border-fuchsia-400 hover:text-fuchsia-700 hover:bg-fuchsia-50/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={16} />
      </button>
      {start > 1 && (
        <>
          <PageBtn page={1} current={current} onClick={onPage} />
          {start > 2 && <span className="text-fuchsia-200 text-sm">…</span>}
        </>
      )}
      {pages.map((p) => <PageBtn key={p} page={p} current={current} onClick={onPage} />)}
      {end < total && (
        <>
          {end < total - 1 && <span className="text-fuchsia-200 text-sm">…</span>}
          <PageBtn page={total} current={current} onClick={onPage} />
        </>
      )}
      <button
        onClick={() => onPage(current + 1)} disabled={current === total}
        className="w-9 h-9 flex items-center justify-center rounded-full border border-fuchsia-200/70 text-fuchsia-400 hover:border-fuchsia-400 hover:text-fuchsia-700 hover:bg-fuchsia-50/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
          ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-[0_3px_12px_-3px_rgba(192,38,211,0.5)] scale-110'
          : 'border border-fuchsia-200/65 text-fuchsia-500/80 hover:border-fuchsia-400 hover:text-fuchsia-700 hover:bg-fuchsia-50/40'
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
  const isDraw     = (m.left_votes || 0) === (m.right_votes || 0)
  const winner     = isDraw ? 'draw' : (m.left_votes > m.right_votes ? 'left' : 'right')
  const thumb      = m.left_thumbnail_url || (m.left_type === 'image' ? m.left_url : null)
  const { left, right } = calcPercent(m.left_votes, m.right_votes)

  return (
    <Link
      to={`/matchup/${m.id}`}
      className={`block ${LIST_CARD} overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group`}
    >
      {/* 썸네일 (aspect-video) */}
      <MatchupThumbFrame side="left" className="aspect-video w-full">
        {thumb
          ? <img src={safeMediaUrl(thumb)} alt={m.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-3">
              <span className="line-clamp-3 text-center text-xs text-gray-400">{m.title}</span>
            </div>
        }
        {/* 하단 그라데이션 */}
        <div className="pointer-events-none absolute inset-0 z-[8] bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* 승패 뱃지 */}
        {isComplete && hasVotes && (
          <span className={`absolute left-2 top-2 z-10 ${winner === 'draw'
              ? 'bg-gray-500 text-white'
              : winner === 'left'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          } rounded-full px-2 py-0.5 text-[10px] font-black`}>
            {winner === 'draw' ? '무승부' : winner === 'left' ? '✓ 승리' : '✗ 패배'}
          </span>
        )}
        {/* 도전자 대기 중 뱃지 */}
        {!isComplete && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-900">
            ⏳ 대기중
          </span>
        )}

        {/* 제목 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-2.5 pb-2">
          <p className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">
            {m.title}
          </p>
        </div>
      </MatchupThumbFrame>

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
  const isDraw    = (m.left_votes || 0) === (m.right_votes || 0)
  const winner   = isDraw ? null : (m.left_votes > m.right_votes ? 'left' : 'right')
  const myWin    = !isActive && hasVotes && !isDraw && vote.side === winner
  const myLose   = !isActive && hasVotes && !isDraw && vote.side !== winner
  const myLabel  = vote.side === 'left' ? (m.left_label || 'A') : (m.right_label || 'B')

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
    : isDraw
    ? { label: '무승부 🤝', cls: 'bg-gray-100 text-gray-600 border-gray-200' }
    : myWin
    ? { label: '적중! 🎯', cls: 'bg-green-50 text-green-600 border-green-100' }
    : { label: '아쉬움 💧', cls: 'bg-blue-50 text-blue-500 border-blue-100' }

  return (
    <div
      className={`${LIST_CARD} overflow-hidden hover:shadow-md hover:shadow-pink-100/30 transition-all duration-200`}
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
          <div className={`relative w-full ${vote.side === 'left' ? 'rounded-xl ring-2 ring-[#22282E]' : ''}`}>
            <MatchupThumbFrame side="left" className="aspect-square w-full">
              {leftThumb
                ? <img src={safeMediaUrl(leftThumb)} alt="A" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-3">
                    <p className="line-clamp-4 text-center text-xs font-bold text-gray-600">{m.left_text}</p>
                  </div>
              }
              {/* MY PICK 오버레이 */}
              {vote.side === 'left' && (
                <div className="absolute inset-0 z-10 flex items-start justify-center pt-2">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#22282E] px-2 py-0.5 text-[10px] font-black text-white shadow-md">
                    ✓ MY PICK
                  </span>
                </div>
              )}
              {/* 퍼센트 */}
              {hasVotes && (
                <div className="absolute bottom-1.5 left-1.5 z-10">
                  <span className={`rounded-lg px-1.5 py-0.5 text-[11px] font-black ${
                    !isActive && winner === 'left' ? 'bg-green-500 text-white' : 'bg-black/50 text-white backdrop-blur-sm'
                  }`}>{left}%</span>
                </div>
              )}
            </MatchupThumbFrame>
          </div>

          {/* 중앙 VS (GNB 로고 + 청·적 그라데이션 배지 — 다른 매치업 카드와 동일) */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <VsBadge size="lg" />
          </div>

          {/* B측 */}
          <div className={`relative w-full ${vote.side === 'right' ? 'rounded-xl ring-2 ring-[#22282E]' : ''}`}>
            <MatchupThumbFrame side="right" className="aspect-square w-full">
              {rightThumb
                ? <img src={safeMediaUrl(rightThumb)} alt="B" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center bg-gradient-to-bl from-pink-50 to-red-100 p-3">
                    <p className="line-clamp-4 text-center text-xs font-bold text-gray-600">{m.right_text}</p>
                  </div>
              }
              {/* MY PICK 오버레이 */}
              {vote.side === 'right' && (
                <div className="absolute inset-0 z-10 flex items-start justify-center pt-2">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#22282E] px-2 py-0.5 text-[10px] font-black text-white shadow-md">
                    ✓ MY PICK
                  </span>
                </div>
              )}
              {/* 퍼센트 */}
              {hasVotes && (
                <div className="absolute bottom-1.5 right-1.5 z-10">
                  <span className={`rounded-lg px-1.5 py-0.5 text-[11px] font-black ${
                    !isActive && winner === 'right' ? 'bg-green-500 text-white' : 'bg-black/50 text-white backdrop-blur-sm'
                  }`}>{right}%</span>
                </div>
              )}
            </MatchupThumbFrame>
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
  const isDraw    = (m.left_votes || 0) === (m.right_votes || 0)
  const winner   = isDraw ? null : (m.left_votes > m.right_votes ? 'left' : 'right')
  const myWin    = !isDraw && vote.side === winner
  const myLabel   = vote.side === 'left' ? (m.left_label || 'A') : (m.right_label || 'B')
  const thumb     = m.left_thumbnail_url || (m.left_type === 'image' ? m.left_url : null)

  return (
    <Link
      to={`/matchup/${m.id}`}
      className={`flex items-center gap-3 p-3.5 ${LIST_CARD} hover:shadow-[0_6px_20px_-6px_rgba(244,114,182,0.28)] hover:-translate-y-0.5 transition-all duration-200 group`}
    >
      {/* 썸네일 */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-fuchsia-50 shrink-0 ring-2 ring-pink-100/60">
        {thumb
          ? <img src={safeMediaUrl(thumb)} alt={m.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-fuchsia-100/60 to-violet-100/50 flex items-center justify-center">
              <span className="text-[8px] text-fuchsia-400 text-center px-1 line-clamp-3">{m.title}</span>
            </div>
        }
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        {m.category && (
          <p className="text-[10px] text-fuchsia-400/80 font-semibold mb-0.5">{m.category}</p>
        )}
        <p className="text-sm font-bold text-[#22282E] truncate">{m.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-gray-400">나의 선택:</span>
          <span className="text-xs font-black text-fuchsia-700">{myLabel}</span>
          {!isActive && hasVotes && (
            isDraw
              ? <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  무승부
                </span>
              : myWin
              ? <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">
                  <CheckCircle2 size={9} /> 승리
                </span>
              : <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200/60">
                  <XCircle size={9} /> 패배
                </span>
          )}
          {isActive && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-200/60">
              <Clock size={9} /> 진행중
            </span>
          )}
        </div>
      </div>

      {/* 결과 뱃지 */}
      <div className="shrink-0">
        {!isActive && hasVotes ? (
          <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl shadow-sm ${
            isDraw
              ? 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-600 border border-slate-200/70'
              : myWin
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.4)]'
              : 'bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-[0_2px_8px_rgba(244,63,94,0.4)]'
          }`}>
            {isDraw ? '무승부' : myWin ? '✓ 승' : '✗ 패'}
          </span>
        ) : isActive ? (
          <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200/60">
            진행중
          </span>
        ) : (
          <ChevronRight size={16} className="text-fuchsia-200 group-hover:text-fuchsia-500 transition-colors" />
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
    <div className="bg-gradient-to-br from-pink-50/60 to-rose-50/40 border border-pink-100/40 rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-sm font-black text-[#22282E]">{value}</p>
      <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
    </div>
  )
}

const SIDE_STAT_VARIANT = {
  rank: {
    box: 'border-2 border-amber-400/75 bg-gradient-to-br from-amber-50 via-orange-50/80 to-yellow-50/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] shadow-amber-200/30',
    label: 'text-amber-800/75',
  },
  rate: {
    box: 'border-2 border-sky-400/70 bg-gradient-to-br from-sky-50 via-cyan-50/70 to-blue-50/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] shadow-sky-200/25',
    label: 'text-sky-800/75',
  },
  wins: {
    box: 'border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-green-50/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] shadow-emerald-200/25',
    label: 'text-emerald-800/75',
  },
  total: {
    box: 'border-2 border-violet-400/70 bg-gradient-to-br from-violet-50 via-fuchsia-50/50 to-purple-50/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] shadow-violet-200/30',
    label: 'text-violet-800/75',
  },
}

function SideStatBox({ variant = 'total', icon, label, value, color }) {
  const v = SIDE_STAT_VARIANT[variant] || SIDE_STAT_VARIANT.total
  return (
    <div className={cn('rounded-xl p-3 text-center transition-transform hover:scale-[1.02]', v.box)}>
      <p className="text-xl mb-0.5 drop-shadow-sm">{icon}</p>
      <p className={cn('text-base font-black', color)}>{value}</p>
      <p className={cn('text-[10px] font-bold', v.label)}>{label}</p>
    </div>
  )
}

function EmptyState({ emoji, title, desc }) {
  return (
    <div className={`py-16 text-center ${SECTION_CARD} bg-gradient-to-br from-white via-fuchsia-50/40 to-pink-50/30`}>
      <p className="text-5xl mb-3">{emoji}</p>
      <p className="text-sm font-black bg-gradient-to-r from-fuchsia-600 to-pink-500 bg-clip-text text-transparent mb-1">{title}</p>
      <p className="text-xs text-fuchsia-700/55">{desc}</p>
    </div>
  )
}

function ProfileHeaderSkeleton() {
  return (
    <div className="flex w-full flex-col sm:flex-row items-center sm:items-start gap-6 animate-pulse">
      <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-start">
        <div className="h-24 w-24 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-100 to-pink-100 sm:h-28 sm:w-28" />
      </div>
      <div className="flex w-full min-w-0 flex-1 flex-col space-y-3 text-center sm:w-auto sm:text-left">
        <div className="h-7 w-32 bg-gradient-to-r from-fuchsia-100 to-pink-100 rounded mx-auto sm:mx-0" />
        <div className="h-4 w-48 bg-fuchsia-100/70 rounded mx-auto sm:mx-0" />
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <div className="h-9 w-24 bg-pink-100/70 rounded-full" />
          <div className="h-9 w-28 bg-violet-100/60 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function ProfileLevelSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 animate-pulse">
      <div className="flex flex-col items-center shrink-0">
        <div className="h-32 w-32 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 ring-4 ring-amber-100/70" />
        <div className="mt-3 h-4 w-24 rounded bg-amber-100/70" />
        <div className="mt-2 h-3 w-20 rounded bg-pink-100/60" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full sm:w-auto">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gradient-to-br from-pink-50 to-fuchsia-50 rounded-xl border border-pink-100/50" />
        ))}
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className={`${LIST_CARD} overflow-hidden animate-pulse`}>
      <div className="aspect-video bg-pink-100/60" />
      <div className="p-3 space-y-2">
        <div className="h-2 bg-gray-100 rounded-full" />
        <div className="h-1.5 bg-gray-100 rounded-full w-3/4" />
      </div>
    </div>
  )
}

function FullCardSkeleton() {
  return (
    <div className={`${LIST_CARD} overflow-hidden animate-pulse`}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-14 h-5 bg-fuchsia-100/70 rounded-full" />
        <div className="flex-1 h-4 bg-pink-100/60 rounded" />
      </div>
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square bg-gradient-to-br from-pink-100/70 to-rose-100/50 rounded-xl" />
          <div className="aspect-square bg-gradient-to-br from-violet-100/60 to-fuchsia-100/50 rounded-xl" />
        </div>
      </div>
      <div className="px-4 py-3 border-t border-pink-100/30 flex justify-between">
        <div className="w-24 h-4 bg-fuchsia-100/60 rounded" />
        <div className="w-16 h-4 bg-pink-100/60 rounded" />
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3.5 border border-pink-100/40 rounded-2xl animate-pulse">
      <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-100/70 to-violet-100/50 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-pink-100/60 rounded w-3/4" />
        <div className="h-3 bg-fuchsia-100/50 rounded w-1/2" />
      </div>
    </div>
  )
}
