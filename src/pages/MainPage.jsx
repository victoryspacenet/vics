import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Flame, Sparkles } from 'lucide-react'
import { fetchMainMatchupsQuick, enrichMainFeedCreatorRanks, MAIN_FEED_BEST_LIMIT, MAIN_FEED_HOT_LIMIT } from '../lib/mainFeed'
import { fetchActiveMainSpotlightMatchup } from '../lib/mainSpotlight'
import { runWhenIdle } from '../lib/runDeferred'
import { useAuthStore } from '../store/authStore'
import {
  SpotlightSection,
  MatchupCarousel,
  MainMatchupCard,
  MainCardSkeleton,
  MainTabBar,
} from '../components/main'

const MainPageLowerSections = lazy(() =>
  import('../components/main/MainPageLowerSections').then((m) => ({ default: m.MainPageLowerSections })),
)

export function MainPage() {
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState({ best: [], hot: [], new: [] })
  const [spotlightMatchup, setSpotlightMatchup] = useState(null)
  /** 퀵 응답 전에만 스켈레톤(첫 진입·목록 비었을 때만 true로 올림) */
  const [quickLoading, setQuickLoading] = useState(true)
  /** 티어 RPC 병합 중 */
  const [enriching, setEnriching] = useState(false)
  /** user null→복원 등으로 load가 겹치면 늦게 끝난 요청이 viewer_vote_side 없는 스냅샷으로 덮어쓰지 않게 함 */
  const mainLoadSeqRef = useRef(0)

  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const loadFeed = useCallback(async () => {
    const seq = ++mainLoadSeqRef.current
    const d = dataRef.current
    const hadAnyFeed =
      (d.best?.length ?? 0) + (d.hot?.length ?? 0) + (d.new?.length ?? 0) > 0
    if (!hadAnyFeed) setQuickLoading(true)
    setEnriching(false)
    let quick = { best: [], hot: [], new: [] }
    try {
      quick = await fetchMainMatchupsQuick()
      if (seq !== mainLoadSeqRef.current) return
      setData(quick)
    } catch (err) {
      if (seq === mainLoadSeqRef.current) {
        console.error(err)
        setData({ best: [], hot: [], new: [] })
        quick = { best: [], hot: [], new: [] }
      }
    } finally {
      if (seq === mainLoadSeqRef.current) setQuickLoading(false)
    }
    if (seq !== mainLoadSeqRef.current) return
    runWhenIdle(() => {
      void (async () => {
        if (seq !== mainLoadSeqRef.current) return
        setEnriching(true)
        try {
          const enriched = await enrichMainFeedCreatorRanks(quick)
          if (seq !== mainLoadSeqRef.current) return
          setData(enriched)
        } catch (e) {
          console.warn('[MainPage] creator rank enrich failed', e)
        } finally {
          if (seq === mainLoadSeqRef.current) setEnriching(false)
        }
      })()
    }, { timeoutMs: 1200 })
  }, [])

  const loadSpotlight = useCallback(async () => {
    try {
      const spotlight = await fetchActiveMainSpotlightMatchup(user?.id ?? null)
      setSpotlightMatchup(spotlight)
    } catch (err) {
      console.warn('[MainPage] spotlight:', err)
    }
  }, [user?.id])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  useEffect(() => {
    void loadSpotlight()
  }, [loadSpotlight])

  useEffect(() => {
    let debounceTimer = null
    const scheduleReload = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        void loadFeed()
        void loadSpotlight()
      }, 350)
    }
    window.addEventListener('vics:main-spotlight:updated', scheduleReload)
    window.addEventListener('vics:matchup-banner-highlight:updated', scheduleReload)
    window.addEventListener('vics:spotlight-self-voted', scheduleReload)
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      window.removeEventListener('vics:main-spotlight:updated', scheduleReload)
      window.removeEventListener('vics:matchup-banner-highlight:updated', scheduleReload)
      window.removeEventListener('vics:spotlight-self-voted', scheduleReload)
    }
  }, [loadFeed, loadSpotlight])

  // 로딩 중에도 직전 스포트라이트 매치업을 유지해 캐러셀이 데모만 남았다가 다시 뜨며 투표 상태·조회 타이밍이 꼬이지 않게 함
  const spotlightPrimary = spotlightMatchup

  return (
    <div className="relative min-h-screen text-[#22282E] -mx-4 -my-6 px-4 py-6 pb-24 sm:pb-8 overflow-x-hidden">
      {/* ── 앰비언트 배경 오라 (성능 영향 없는 CSS only) ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-gradient-radial from-amber-300/12 via-orange-200/6 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-gradient-radial from-violet-300/10 via-fuchsia-200/5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-gradient-radial from-emerald-300/8 via-teal-200/4 to-transparent blur-3xl" />
      </div>

      {/* ── 스포트라이트 (GNB 직후 최상단 · 가로 캐러셀) ── */}
      <SpotlightSection primaryMatchup={spotlightPrimary} />

      {/* ── 상단 탭 바 (각 탭 → 독립 페이지 링크) ── */}
      <MainTabBar currentVariant={null} />

      {enriching && !quickLoading && (data.best.length > 0 || data.hot.length > 0 || data.new.length > 0) && (
        <p className="mb-3 text-center text-[11px] font-medium text-slate-400 tabular-nums" aria-live="polite">
          크리에이터 랭크 정보 동기화 중…
        </p>
      )}

      {/* ── 베스트 매치업 ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_4px_14px_-2px_rgba(251,146,60,0.55)]">
              <Flame size={18} className="text-white" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-base font-black leading-none bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent tracking-tight">
                베스트 매치업
              </h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/80">TOP RANKED</p>
            </div>
          </div>
          <span className="rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 shadow-sm">
            🔥 HOT
          </span>
        </div>
        <MatchupCarousel>
          {quickLoading
            ? Array.from({ length: MAIN_FEED_BEST_LIMIT }).map((_, i) => (
                <MainCardSkeleton key={`sk-${i}`} compact staticLcp={i === 0} />
              ))
            : data.best.slice(0, MAIN_FEED_BEST_LIMIT).map((m, i) => (
                <div
                  key={m.id}
                  className="animate-fade-in-feed-stagger"
                  style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                >
                  <MainMatchupCard matchup={m} variant="best" rank={i + 1} eagerMedia={i < 2} />
                </div>
              ))}
        </MatchupCarousel>
      </section>

      {/* ── 추천 매치업 ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-[0_4px_14px_-2px_rgba(168,85,247,0.5)]">
              <Sparkles size={18} className="text-white" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-base font-black leading-none bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent tracking-tight">
                추천 매치업
              </h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-500/80">EDITOR&apos;S PICK</p>
            </div>
          </div>
          <span className="rounded-full border border-violet-200/80 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700 shadow-sm">
            ✨ PICK
          </span>
        </div>
        <MatchupCarousel>
          {quickLoading
            ? Array.from({ length: MAIN_FEED_HOT_LIMIT }).map((_, i) => (
                <MainCardSkeleton key={`sk-${i}`} compact staticLcp={i === 0} />
              ))
            : data.hot.slice(0, MAIN_FEED_HOT_LIMIT).map((m, i) => (
                <div
                  key={m.id}
                  className="animate-fade-in-feed-stagger"
                  style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                >
                  <MainMatchupCard matchup={m} variant="hot" eagerMedia={i < 2} />
                </div>
              ))}
        </MatchupCarousel>
      </section>

      <Suspense
        fallback={
          <div className="mb-10 space-y-10" aria-hidden>
            <div className="h-28 rounded-2xl border border-slate-200/60 bg-gradient-to-b from-slate-50/95 to-slate-100/60" />
            <div className="h-40 rounded-2xl border border-slate-200/60 bg-gradient-to-b from-slate-50/95 to-slate-100/60" />
            <div className="h-48 rounded-2xl border border-slate-200/60 bg-gradient-to-b from-slate-50/95 to-slate-100/60" />
          </div>
        }
      >
        <MainPageLowerSections quickLoading={quickLoading} newItems={data.new} />
      </Suspense>
    </div>
  )
}



