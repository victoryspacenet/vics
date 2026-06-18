import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ChevronLeft, Heart, RefreshCw, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react'
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
    void loadClaps()
    void loadCheers()
    void loadWeeklyGrowth()
  }, [user?.id, loadClaps, loadCheers, loadWeeklyGrowth])

  // Clap이 새로 들어오면 실시간 갱신
  useEffect(() => {
    const handler = () => {
      void loadClaps()
      void loadWeeklyGrowth()
      void fetchProfile(user?.id, { force: true })
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50 pb-12">
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-radial from-fuchsia-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-gradient-radial from-pink-300/15 to-transparent blur-3xl" />
        <div className="absolute bottom-24 left-1/4 w-64 h-64 rounded-full bg-gradient-radial from-rose-300/12 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* 스티키 헤더 */}
        <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-2.5 bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-pink-200/60 hover:from-fuchsia-100 hover:to-pink-100 transition-all shrink-0 shadow-sm"
          >
            <ChevronLeft size={16} className="text-fuchsia-700" />
            <span className="text-xs font-bold text-fuchsia-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-fuchsia-600 shadow-md shadow-fuchsia-300/40">
              <Heart size={13} className="text-white" fill="currentColor" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-700 bg-clip-text text-transparent tracking-tight">내 팬덤</h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-5">
          {/* 히어로 헤더 */}
          <div className="rounded-2xl overflow-hidden border border-fuchsia-200/50 bg-white/90 shadow-[0_4px_28px_-10px_rgba(192,38,211,0.2)] backdrop-blur-sm text-center">
            <div className="h-1.5 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600" />
            <div className="px-6 py-6">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-gradient-to-r from-rose-50 to-fuchsia-50 px-4 py-1 text-xs font-black text-pink-700 shadow-sm">
                <Heart size={13} className="text-rose-500" fill="currentColor" />
                Fandom Influence
              </p>
              <h2 className="bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-700 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
                내 팬덤
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-fuchsia-800/65">
                팬들의 목소리와 지표를 한곳에서 확인하세요.
              </p>
            </div>
          </div>

          {!user ? (
            <div className="rounded-2xl overflow-hidden border border-pink-100/70 bg-white/90 shadow-sm text-center px-6 py-10">
              <div className="text-3xl mb-3">🔒</div>
              <p className="text-sm font-bold text-fuchsia-800/70">로그인 후 팬덤 인사이트를 확인할 수 있어요.</p>
            </div>
          ) : (
            <>
              {/* ── 실시간 팬덤 지표 ─────────────────────────────────────── */}
              <section className="rounded-2xl overflow-hidden border border-fuchsia-200/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(192,38,211,0.2)] backdrop-blur-[2px]">
                <div className="h-1 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600" />
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-100/70 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-md shadow-fuchsia-300/40">
                        <BarChart3 size={16} className="text-white" />
                      </span>
                      <div>
                        <h2 className="text-sm font-black bg-gradient-to-r from-fuchsia-700 to-pink-700 bg-clip-text text-transparent">실시간 팬덤 지표</h2>
                        <p className="text-[10px] font-medium text-fuchsia-700/55">V-Card Claps 기준 · 1회당 {FANDOM_POINTS_PER_CLAP} FP</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { void loadClaps(); void loadWeeklyGrowth(); void fetchProfile(user.id, { force: true }) }}
                        className="rounded-xl p-2 text-fuchsia-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 border border-pink-100/60 transition shadow-sm"
                        title="새로고침"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-2 text-right shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">F-Point</p>
                        <p className="text-lg font-black tabular-nums text-amber-950">
                          {fp.toLocaleString('ko-KR')} <span className="text-sm">FP</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
                    {/* 총 누적 Claps */}
                    <div className="rounded-2xl border border-fuchsia-100/60 bg-gradient-to-br from-fuchsia-50/60 to-pink-50/40 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600/80 mb-2">총 누적 Claps</p>
                      {clapsLoading ? (
                        <div className="h-9 w-28 animate-pulse rounded-xl bg-fuchsia-100/60" />
                      ) : (
                        <p className="text-3xl font-black tabular-nums leading-none bg-gradient-to-r from-fuchsia-700 to-pink-600 bg-clip-text text-transparent sm:text-4xl">
                          {totalClaps.toLocaleString('ko-KR')}회
                        </p>
                      )}
                    </div>

                    {/* 보유 배지 현황 */}
                    <div className="rounded-2xl border border-amber-100/70 bg-gradient-to-br from-amber-50/60 to-yellow-50/40 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/80 mb-2">보유 배지 현황</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {[...FANDOM_TIERS].reverse().map((t) => {
                          const earned = totalClaps >= t.minClaps
                          const active = displayTierId === t.id
                          return (
                            <span
                              key={t.id}
                              title={`${t.name} · ${t.minClaps.toLocaleString('ko-KR')} Clap 이상`}
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-xl border text-xl shadow-inner transition',
                                earned
                                  ? 'border-amber-300/90 bg-gradient-to-br from-amber-50 to-yellow-100'
                                  : 'border-slate-200/90 bg-slate-100/80 text-slate-300 grayscale opacity-40',
                                active && earned && 'ring-2 ring-fuchsia-400/80 ring-offset-2 ring-offset-white shadow-md shadow-fuchsia-200/40 scale-110',
                              )}
                              aria-current={active ? 'true' : undefined}
                            >
                              {t.badgeLabel}
                            </span>
                          )
                        })}
                      </div>
                      <p className="mt-3 text-xs font-bold text-fuchsia-950/80">
                        현재:{' '}
                        <span className="font-black text-fuchsia-700">{currentTier ? currentTier.name : '티어 없음'}</span>
                        {currentTier && <span className="text-fuchsia-700/50 font-medium"> ({tierLabelEn})</span>}
                      </p>
                    </div>
                  </div>

                  {/* 다음 등급까지 */}
                  {!clapsLoading && (
                    <div className="mt-3 rounded-xl border border-violet-200/60 bg-gradient-to-r from-violet-50/70 to-fuchsia-50/50 px-4 py-2.5 text-xs font-medium text-violet-900/85">
                      {nextTier ? (
                        <>
                          다음 등급 <strong className="text-violet-950 font-black">{nextTier.name}</strong>까지 Clap{' '}
                          <strong className="tabular-nums font-black bg-gradient-to-r from-fuchsia-700 to-pink-600 bg-clip-text text-transparent">
                            {(nextTier.minClaps - totalClaps).toLocaleString('ko-KR')}
                          </strong>
                          회 남았어요.
                        </>
                      ) : (
                        <span className="font-black text-amber-800">최고 등급 달성! 💎 언터처블 레전드</span>
                      )}
                    </div>
                  )}

                  {/* 주간 증가율 */}
                  <div className="mt-3 rounded-2xl border border-emerald-100/60 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700/80 mb-2">
                      <TrendingUp size={12} className="text-emerald-600" />
                      이번 주 증가율
                    </p>
                    {weeklyLoading ? (
                      <div className="h-8 w-32 animate-pulse rounded-xl bg-emerald-100/60" />
                    ) : weeklyGrowth ? (
                      <WeeklyGrowthDisplay growth={weeklyGrowth} />
                    ) : (
                      <p className="text-sm font-medium text-fuchsia-700/50">데이터를 불러올 수 없어요.</p>
                    )}
                  </div>
                </div>
              </section>

              {/* ── FP 전용 상점 ──────────────────────────────────────────── */}
              <section className="rounded-2xl overflow-hidden border border-teal-200/60 bg-white/92 shadow-[0_4px_20px_-10px_rgba(20,184,166,0.2)] backdrop-blur-[2px]">
                <div className="h-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400" />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-md shadow-teal-300/40">
                      <ShoppingBag size={16} className="text-white" />
                    </span>
                    <h2 className="text-sm font-black bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent">FP 전용 상점</h2>
                  </div>
                  <ul className="space-y-2.5">
                    {FP_SHOP.map((item) => {
                      const affordable = fp >= item.cost
                      return (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 rounded-xl border border-teal-100/70 bg-gradient-to-br from-teal-50/60 to-cyan-50/40 px-3.5 py-3"
                        >
                          <input type="checkbox" disabled className="mt-1 accent-teal-500" aria-label={item.name} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-fuchsia-950">{item.name}</p>
                            <p className="text-xs font-black text-teal-700 mt-0.5">
                              {item.cost.toLocaleString('ko-KR')} FP
                              {!affordable && (
                                <span className="ml-2 text-rose-600 font-bold">
                                  (부족 {(item.cost - fp).toLocaleString('ko-KR')} FP)
                                </span>
                              )}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-teal-900/65 leading-relaxed bg-teal-50/60 rounded-xl px-3 py-2 border border-teal-100/60">
                    <span className="font-black text-teal-700">FP로만</span> 구매 가능한 아이템은{' '}
                    <span className="font-black text-teal-700">순차 연동 예정</span>이에요.{' '}
                    <span className="font-black text-teal-800">일반 포인트와는 별도</span>예요.
                  </p>
                </div>
              </section>

              {/* ── 최근 응원 한마디 ──────────────────────────────────────── */}
              <section className="rounded-2xl overflow-hidden border border-sky-200/60 bg-white/92 shadow-[0_4px_20px_-10px_rgba(14,165,233,0.15)] backdrop-blur-[2px]">
                <div className="h-1 bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400" />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 shadow-md shadow-sky-300/40">
                      <Sparkles size={16} className="text-white" />
                    </span>
                    <h2 className="text-sm font-black bg-gradient-to-r from-sky-700 to-blue-700 bg-clip-text text-transparent">최근 응원 한마디</h2>
                  </div>

                  {cheersLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 animate-pulse rounded-xl bg-sky-50/70" />
                      ))}
                    </div>
                  ) : cheers.length === 0 ? (
                    <div className="rounded-xl border border-sky-100/70 bg-sky-50/40 px-4 py-5 text-center">
                      <div className="text-2xl mb-2">🌱</div>
                      <p className="text-sm font-bold text-sky-900/65">아직 응원 한마디가 없어요.</p>
                      <p className="text-xs text-sky-700/50 mt-1">V-Card 리포트를 공유해 팬들을 만나보세요!</p>
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-xs font-bold text-sky-800/60">
                        총 <span className="font-black text-sky-700">{cheers.length.toLocaleString('ko-KR')}</span>건
                      </p>
                      <ul className="space-y-2">
                        {pagedCheers.map((c) => (
                          <li
                            key={c.id}
                            className="relative rounded-xl border border-sky-100/70 bg-gradient-to-br from-sky-50/60 to-blue-50/40 px-4 py-2.5 text-sm"
                          >
                            <span className="font-black text-sky-700">{c.profiles?.nickname || '익명'}</span>
                            <span className="text-fuchsia-900/70">: {c.body}</span>
                          </li>
                        ))}
                      </ul>
                      {cheerTotalPages > 1 && (
                        <div className="mt-5 flex flex-col items-center gap-2 border-t border-sky-100/60 pt-4">
                          <MainPagination current={cheerPage} total={cheerTotalPages} onPage={setCheerPage} />
                          <p className="text-[11px] font-medium text-sky-700/50">
                            {(cheerPage - 1) * CHEERS_PAGE_SIZE + 1}–{Math.min(cheerPage * CHEERS_PAGE_SIZE, cheers.length).toLocaleString('ko-KR')} / {cheers.length.toLocaleString('ko-KR')}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* V-Card 링크 */}
              <div className="text-center py-2">
                <p className="text-xs text-fuchsia-700/55 mb-2">V-Card 리포트에서 더 많은 팬과 연결될 수 있어요.</p>
                <Link
                  to="/rewards/v-card"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-500 text-white text-sm font-black shadow-[0_4px_18px_-4px_rgba(192,38,211,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Heart size={14} fill="currentColor" />
                  V-Card 보러가기
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
