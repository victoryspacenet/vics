import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, Heart, ShoppingBag, Sparkles, TrendingUp, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { MainPagination } from '../components/main/MainPagination'
import { cn } from '../lib/utils'
import { FANDOM_POINTS_PER_CLAP } from '../lib/fandomPoints'
import { FANDOM_TIERS, getFandomTierMeta, fandomTierFromClaps } from '../lib/fandomTiers'
import { fetchVcardClapStats, fetchFandomWeeklyGrowth, VCARD_CLAPS_UPDATED } from '../lib/vcardClaps'
import { fetchRecentFandomCheers } from '../lib/fandomMilestones'

const CHEERS_PAGE_SIZE = 5

/** 주간 증가율 표시 서브 컴포넌트 */
function WeeklyGrowthDisplay({ growth }) {
  const { thisWeek, lastWeek, growthRate, isNew } = growth

  // 이번 주 Clap이 하나도 없으면
  if (thisWeek === 0 && lastWeek === 0) {
    return (
      <p className="mt-1 text-sm font-medium text-slate-400">
        아직 이번 주 Clap이 없어요. V-Card를 공유해 팬을 늘려보세요!
      </p>
    )
  }

  const isUp = growthRate !== null && growthRate > 0
  const isDown = growthRate !== null && growthRate < 0
  const isFlat = growthRate !== null && growthRate === 0

  const rateLabel = isNew
    ? '신규 ▲'
    : isUp
      ? `+${growthRate}% ▲`
      : isDown
        ? `${growthRate}% ▼`
        : isFlat
          ? '0% (변동 없음)'
          : '—'

  const rateColor = isNew || isUp
    ? 'text-emerald-700'
    : isDown
      ? 'text-rose-600'
      : 'text-slate-500'

  return (
    <div className="mt-1.5 space-y-1">
      <p className={cn('text-2xl font-black tabular-nums', rateColor)}>{rateLabel}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] font-semibold text-slate-500">
        <span>이번 주 <strong className="text-fuchsia-700">{thisWeek.toLocaleString('ko-KR')}</strong>회</span>
        <span>지난 주 <strong className="text-slate-600">{lastWeek.toLocaleString('ko-KR')}</strong>회</span>
      </div>
      {isNew && (
        <p className="text-[10px] font-medium text-emerald-600">
          지난 주 대비 신규로 Clap이 발생했어요!
        </p>
      )}
    </div>
  )
}

const FP_SHOP = [
  { id: 'super-chat', name: '슈퍼 채팅권 (댓글 최상단 고정)', cost: 500, ready: false },
  { id: 'fan-event', name: '팬 감사 이벤트 개최권', cost: 2000, ready: false },
]

export function FandomDashboardPage() {
  const { user, profile, fetchProfile } = useAuthStore()
  const [cheerPage, setCheerPage] = useState(1)

  // ── 실데이터 상태 ──────────────────────────────────────────────────────────
  const [totalClaps, setTotalClaps] = useState(0)
  const [clapsLoading, setClapsLoading] = useState(true)
  const [cheers, setCheers] = useState([])
  const [cheersLoading, setCheersLoading] = useState(true)
  const [weeklyGrowth, setWeeklyGrowth] = useState(
    /** @type {{ thisWeek: number, lastWeek: number, growthRate: number|null, isNew: boolean }|null} */ (null)
  )
  const [weeklyLoading, setWeeklyLoading] = useState(true)

  // 티어·FP는 실제 Clap 수 기준으로 파생 (profile.fandom_tier/fandom_points가 stale일 경우 대비)
  // clapsLoading 중에는 'none' 표시, 로드 완료 후 실제 Clap 수로 계산
  const displayTierId = clapsLoading ? 'none' : fandomTierFromClaps(totalClaps)
  const fp = clapsLoading ? 0 : totalClaps * FANDOM_POINTS_PER_CLAP
  const currentTier = getFandomTierMeta(displayTierId === 'none' ? null : displayTierId)

  const tierLabelEn =
    displayTierId && displayTierId !== 'none'
      ? displayTierId.charAt(0).toUpperCase() + displayTierId.slice(1)
      : '—'

  const nextTier = useMemo(() => {
    const ordered = [...FANDOM_TIERS].reverse()
    return ordered.find((t) => t.minClaps > totalClaps) || null
  }, [totalClaps])

  // ── 실데이터 로드 ──────────────────────────────────────────────────────────
  const loadClaps = useCallback(async () => {
    if (!user?.id) return
    setClapsLoading(true)
    try {
      const { total } = await fetchVcardClapStats(user.id)
      setTotalClaps(Number(total || 0))
    } finally {
      setClapsLoading(false)
    }
  }, [user?.id])

  const loadWeeklyGrowth = useCallback(async () => {
    if (!user?.id) return
    setWeeklyLoading(true)
    try {
      const result = await fetchFandomWeeklyGrowth(user.id)
      setWeeklyGrowth(result)
    } finally {
      setWeeklyLoading(false)
    }
  }, [user?.id])

  const loadCheers = useCallback(async () => {
    if (!user?.id) return
    setCheersLoading(true)
    try {
      const data = await fetchRecentFandomCheers(user.id, 50)
      setCheers(data || [])
    } finally {
      setCheersLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    void fetchProfile(user.id)
    void loadClaps()
    void loadCheers()
    void loadWeeklyGrowth()
  }, [user?.id, fetchProfile, loadClaps, loadCheers, loadWeeklyGrowth])

  // Clap이 새로 들어오면 실시간 갱신
  useEffect(() => {
    const handler = () => {
      void loadClaps()
      void loadWeeklyGrowth()
      void fetchProfile(user?.id)
    }
    window.addEventListener(VCARD_CLAPS_UPDATED, handler)
    return () => window.removeEventListener(VCARD_CLAPS_UPDATED, handler)
  }, [loadClaps, loadWeeklyGrowth, fetchProfile, user?.id])

  // ── 응원 한마디 페이지네이션 ──────────────────────────────────────────────
  const cheerTotalPages = Math.max(1, Math.ceil(cheers.length / CHEERS_PAGE_SIZE))
  const pagedCheers = useMemo(() => {
    const start = (cheerPage - 1) * CHEERS_PAGE_SIZE
    return cheers.slice(start, start + CHEERS_PAGE_SIZE)
  }, [cheerPage, cheers])

  useEffect(() => {
    if (cheerPage > cheerTotalPages) setCheerPage(cheerTotalPages)
  }, [cheerPage, cheerTotalPages])

  return (
    <div className="min-h-[70vh] pb-12">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-fuchsia-700 hover:text-fuchsia-900"
      >
        <ArrowLeft size={18} />
        뒤로
      </button>

      <header className="mb-8 text-center">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-white/90 px-4 py-1 text-xs font-black text-pink-700 shadow-sm">
          <Heart size={14} className="text-rose-500" fill="currentColor" />
          Fandom Influence
        </p>
        <h1 className="bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-700 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          내 팬덤
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-relaxed text-slate-600">
          당신을 열광시키는 팬들의 목소리와 지표를 한곳에서 확인하세요.
        </p>
      </header>

      {!user ? (
        <p className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-center text-sm font-semibold text-slate-600">
          로그인 후 팬덤 인사이트를 확인할 수 있어요.
        </p>
      ) : (
        <div className="space-y-6">
          {/* ── 실시간 팬덤 지표 ───────────────────────────────────────────── */}
          <section
            className={cn(
              'rounded-3xl border border-fuchsia-200/60 bg-gradient-to-br from-white via-rose-50/40 to-violet-50/50 p-5 shadow-lg shadow-fuchsia-100/40 sm:p-7',
            )}
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-pink-100/70 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-[#22282E] sm:text-xl">
                  <BarChart3 className="h-6 w-6 text-fuchsia-600" />
                  실시간 팬덤 지표
                </h2>
                <p className="mt-1 text-xs font-medium text-fuchsia-800/60">
                  V-Card 축하(Claps) 기준 · Clap 1회당 {FANDOM_POINTS_PER_CLAP} FP
                </p>
              </div>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => { void loadClaps(); void loadWeeklyGrowth(); void fetchProfile(user.id) }}
                  className="mt-1 rounded-xl p-1.5 text-fuchsia-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition"
                  title="새로고침"
                >
                  <RefreshCw size={15} />
                </button>
                <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-2 text-right shadow-inner">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-800/80">F-Point</p>
                  <p className="text-lg font-black tabular-nums text-amber-950">
                    {fp.toLocaleString('ko-KR')} <span className="text-sm">FP</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-stretch">
              {/* 총 누적 Claps */}
              <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm md:p-5">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">총 누적 Claps</p>
                {clapsLoading ? (
                  <div className="mt-2 h-9 w-24 animate-pulse rounded-xl bg-slate-100" />
                ) : (
                  <p className="mt-2 text-3xl font-black tabular-nums leading-none text-fuchsia-700 sm:text-4xl">
                    {totalClaps.toLocaleString('ko-KR')}회
                  </p>
                )}
              </div>

              {/* 보유 배지 현황 */}
              <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm md:p-5">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">보유 배지 현황</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                  {[...FANDOM_TIERS].reverse().map((t) => {
                    const earned = totalClaps >= t.minClaps
                    const active = displayTierId === t.id
                    return (
                      <span
                        key={t.id}
                        title={`${t.name} · ${t.minClaps.toLocaleString('ko-KR')} Clap 이상`}
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-xl border text-xl shadow-inner transition sm:h-12 sm:w-12 sm:text-2xl',
                          earned
                            ? 'border-amber-300/90 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-950'
                            : 'border-slate-200/90 bg-slate-100/80 text-slate-300 grayscale',
                          active &&
                            earned &&
                            'ring-2 ring-fuchsia-400/80 ring-offset-2 ring-offset-white shadow-md shadow-fuchsia-200/40',
                        )}
                        aria-current={active ? 'true' : undefined}
                      >
                        {t.badgeLabel}
                      </span>
                    )
                  })}
                </div>
                <p className="mt-4 text-sm font-semibold italic leading-snug text-violet-900/90">
                  현재:{' '}
                  <span className="font-black not-italic text-fuchsia-700">
                    {currentTier ? currentTier.name : '티어 없음'}
                  </span>
                  {currentTier ? (
                    <span className="not-italic text-slate-500"> ({tierLabelEn})</span>
                  ) : null}
                </p>
              </div>
            </div>

            {/* 다음 등급까지 */}
            {!clapsLoading && (
              <div className="mt-3 rounded-xl border border-violet-100/80 bg-violet-50/50 px-3 py-2.5 text-xs font-medium text-violet-900/90">
                {nextTier ? (
                  <>
                    다음 등급 <strong className="text-violet-950">{nextTier.name}</strong>까지 Clap{' '}
                    <strong className="tabular-nums text-fuchsia-700">
                      {(nextTier.minClaps - totalClaps).toLocaleString('ko-KR')}
                    </strong>
                    회 남았어요.
                  </>
                ) : (
                  <span className="font-bold text-amber-800">최고 등급 달성! 💎 언터처블 레전드</span>
                )}
              </div>
            )}

            {/* 주간 증가율 */}
            <div className="mt-4 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <p className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <TrendingUp size={12} className="text-emerald-600" />
                이번 주 증가율
              </p>
              {weeklyLoading ? (
                <div className="mt-2 h-8 w-32 animate-pulse rounded-xl bg-slate-100" />
              ) : weeklyGrowth ? (
                <WeeklyGrowthDisplay growth={weeklyGrowth} />
              ) : (
                <p className="mt-1 text-sm font-medium text-slate-400">데이터를 불러올 수 없어요.</p>
              )}
            </div>
          </section>

          {/* ── FP 전용 상점 ──────────────────────────────────────────────── */}
          <section>
            <div className="rounded-3xl border border-teal-200/70 bg-white/95 p-5 shadow-md sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-base font-black text-teal-950 sm:text-lg">
                <ShoppingBag className="h-5 w-5 text-teal-600" />
                FP 전용 상점
              </h2>
              <ul className="space-y-3">
                {FP_SHOP.map((item) => {
                  const affordable = fp >= item.cost
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                    >
                      <input type="checkbox" disabled className="mt-1" aria-label={item.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">{item.name}</p>
                        <p className="text-xs font-semibold text-teal-700">
                          {item.cost.toLocaleString('ko-KR')} FP
                          {!affordable && (
                            <span className="ml-2 text-rose-600">
                              (부족 {(item.cost - fp).toLocaleString('ko-KR')} FP)
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-600">
                <span className="font-bold text-teal-700">FP로만</span> 구매 가능한 아이템은{' '}
                <span className="font-bold text-teal-700">순차 연동 예정</span>이에요.{' '}
                <span className="font-bold text-teal-800">일반 포인트와는 별도</span>예요.
              </p>
            </div>
          </section>

          {/* ── 최근 응원 한마디 ───────────────────────────────────────────── */}
          <section
            className="rounded-3xl border border-sky-200/70 bg-gradient-to-br from-white to-sky-50/40 p-5 shadow-md sm:p-6"
            aria-label="최근 응원 한마디"
          >
            <h2 className="mb-3 flex items-center gap-2 text-base font-black text-sky-950 sm:text-lg">
              <Sparkles className="h-5 w-5 text-sky-600" />
              최근 응원 한마디
            </h2>

            {cheersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : cheers.length === 0 ? (
              <p className="rounded-xl border border-sky-100/80 bg-white/90 px-3 py-4 text-center text-sm font-medium text-slate-400">
                아직 응원 한마디가 없어요. V-Card 리포트를 공유해 팬들을 만나보세요!
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs font-medium text-slate-500">
                  총 <span className="font-bold text-sky-800">{cheers.length.toLocaleString('ko-KR')}</span>건 · 페이지당{' '}
                  {CHEERS_PAGE_SIZE}개
                </p>
                <ul className="space-y-2">
                  {pagedCheers.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border border-sky-100/80 bg-white/90 px-3 py-2 text-sm text-slate-700"
                    >
                      <span className="font-bold text-sky-800">{c.profiles?.nickname || '익명'}</span>: {c.body}
                    </li>
                  ))}
                </ul>
                {cheerTotalPages > 1 ? (
                  <div className="mt-5 flex flex-col items-center gap-2 border-t border-sky-100/80 pt-4">
                    <MainPagination current={cheerPage} total={cheerTotalPages} onPage={setCheerPage} />
                    <p className="text-[11px] font-medium text-slate-400">
                      {(cheerPage - 1) * CHEERS_PAGE_SIZE + 1}–
                      {Math.min(cheerPage * CHEERS_PAGE_SIZE, cheers.length).toLocaleString('ko-KR')} /{' '}
                      {cheers.length.toLocaleString('ko-KR')}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <p className="text-center text-xs text-slate-500">
            V-Card 리포트는{' '}
            <Link
              to="/rewards/v-card"
              className="inline-flex items-center rounded-lg bg-fuchsia-50 px-2 py-1 text-sm font-black text-fuchsia-700 shadow-sm ring-1 ring-fuchsia-200/80 underline-offset-2 transition hover:bg-fuchsia-100 hover:ring-fuchsia-300/90 sm:text-base"
            >
              여기
            </Link>
            에서 더 많은 팬과 연결될 수 있어요.
          </p>
        </div>
      )}
    </div>
  )
}
