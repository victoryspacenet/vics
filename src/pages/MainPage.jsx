import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Flame, Sparkles } from 'lucide-react'
import { fetchMainMatchupsQuick, enrichMainFeedCreatorRanks, MAIN_FEED_BEST_LIMIT, MAIN_FEED_HOT_LIMIT } from '../lib/mainFeed'
import { fetchActiveMainSpotlightMatchup } from '../lib/mainSpotlight'
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

  const load = useCallback(async () => {
    const seq = ++mainLoadSeqRef.current
    const d = dataRef.current
    const hadAnyFeed =
      (d.best?.length ?? 0) + (d.hot?.length ?? 0) + (d.new?.length ?? 0) > 0
    if (!hadAnyFeed) setQuickLoading(true)
    setEnriching(false)
    let quick = { best: [], hot: [], new: [] }
    try {
      const viewerId = user?.id ?? null
      const [q, spotlight] = await Promise.all([
        fetchMainMatchupsQuick(),
        fetchActiveMainSpotlightMatchup(viewerId),
      ])
      if (seq !== mainLoadSeqRef.current) return
      quick = q
      setData(quick)
      setSpotlightMatchup(spotlight)
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
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const on = () => {
      load()
    }
    window.addEventListener('vics:main-spotlight:updated', on)
    window.addEventListener('vics:matchup-banner-highlight:updated', on)
    window.addEventListener('vics:spotlight-self-voted', on)
    return () => {
      window.removeEventListener('vics:main-spotlight:updated', on)
      window.removeEventListener('vics:matchup-banner-highlight:updated', on)
      window.removeEventListener('vics:spotlight-self-voted', on)
    }
  }, [load])

  // 로딩 중에도 직전 스포트라이트 매치업을 유지해 캐러셀이 데모만 남았다가 다시 뜨며 투표 상태·조회 타이밍이 꼬이지 않게 함
  const spotlightPrimary = spotlightMatchup

  return (
    <div className="min-h-screen text-[#22282E] -mx-4 -my-6 px-4 py-6 pb-24 sm:pb-8">
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
        <div className="flex items-center gap-2 mb-4">
          <Flame size={20} className="text-orange-500" />
          <h2 className="text-lg font-bold text-[#22282E] tracking-tight">베스트 매치업</h2>
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
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} className="text-violet-500" />
          <h2 className="text-lg font-bold text-[#22282E] tracking-tight">추천 매치업</h2>
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



