import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { fetchMainMatchupsQuick, enrichMainFeedCreatorRanks } from '../lib/mainFeed'
import { runWhenIdle } from '../lib/runDeferred'
import {
  MainMatchupCard,
  MainFeedCardSkeleton,
  MainTabBar,
  MainPagination,
} from '../components/main'

const LegendFeedBanner = lazy(() =>
  import('../components/fandom/LegendFeedBanner').then((m) => ({ default: m.LegendFeedBanner })),
)

const PAGE_SIZE = 12

export function MainFeedPage() {
  const { variant } = useParams()
  const [data, setData] = useState({ best: [], hot: [], new: [] })
  /** 목록·썸네일용 첫 응답 대기 (스켈레톤 구간) */
  const [quickLoading, setQuickLoading] = useState(true)
  /** 티어 RPC 병합 중 — 카드는 유지, 상단에만 경량 표시 */
  const [enriching, setEnriching] = useState(false)
  const [page, setPage] = useState(1)

  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const validVariant = ['best', 'hot', 'new'].includes(variant) ? variant : null
  if (!validVariant) return <Navigate to="/feed/best" replace />

  const loadSeqRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current
    const d = dataRef.current
    const hadAnyFeed =
      (d.best?.length ?? 0) + (d.hot?.length ?? 0) + (d.new?.length ?? 0) > 0
    if (!hadAnyFeed) setQuickLoading(true)
    setEnriching(false)
    let quick = { best: [], hot: [], new: [] }
    try {
      quick = await fetchMainMatchupsQuick()
      if (seq !== loadSeqRef.current) return
      setData(quick)
    } catch (err) {
      console.error(err)
      if (seq === loadSeqRef.current) {
        setData({ best: [], hot: [], new: [] })
        quick = { best: [], hot: [], new: [] }
      }
    } finally {
      if (seq === loadSeqRef.current) setQuickLoading(false)
    }
    if (seq !== loadSeqRef.current) return
    runWhenIdle(() => {
      void (async () => {
        if (seq !== loadSeqRef.current) return
        setEnriching(true)
        try {
          const enriched = await enrichMainFeedCreatorRanks(quick)
          if (seq !== loadSeqRef.current) return
          setData(enriched)
        } catch (e) {
          console.warn('[MainFeedPage] creator rank enrich failed', e)
        } finally {
          if (seq === loadSeqRef.current) setEnriching(false)
        }
      })()
    }, { timeoutMs: 1200 })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [validVariant])

  useEffect(() => {
    const on = () => {
      void load()
    }
    window.addEventListener('vics:matchup-banner-highlight:updated', on)
    return () => window.removeEventListener('vics:matchup-banner-highlight:updated', on)
  }, [load])

  const currentList = data[validVariant] || []
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE))
  const pagedItems = currentList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const goPage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen text-[#22282E] -mx-4 -my-6 px-4 py-6 pb-24 sm:pb-8">
      {/* ── 상단 탭 바 (독립 페이지) ── */}
      <MainTabBar currentVariant={validVariant} />

      <Suspense
        fallback={
          <div
            className="mb-4 min-h-[5rem] rounded-xl border border-slate-200/60 bg-gradient-to-b from-slate-50/90 to-slate-100/50"
            aria-hidden
          />
        }
      >
        <LegendFeedBanner />
      </Suspense>

      {enriching && !quickLoading && currentList.length > 0 && (
        <p className="mb-3 text-center text-[11px] font-medium text-slate-400 tabular-nums" aria-live="polite">
          크리에이터 랭크 정보 동기화 중…
        </p>
      )}

      {/* ── 피드: 퀵 로드 전에는 카드 형태 스켈레톤(첫 블록은 LCP용 정적) ── */}
      <div className="space-y-4">
        {quickLoading ? (
          <>
            <div className="py-3">
              <MainFeedCardSkeleton variant={validVariant} staticLcp />
            </div>
            <div className="py-3">
              <MainFeedCardSkeleton variant={validVariant} />
            </div>
            <div className="py-3">
              <MainFeedCardSkeleton variant={validVariant} />
            </div>
          </>
        ) : pagedItems.length > 0 ? (
          pagedItems.map((m, i) => (
            <div
              key={`${validVariant}-${page}-${m.id}`}
              className="py-3 animate-fade-in-feed-stagger"
              style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
            >
              <MainMatchupCard
                matchup={m}
                variant={validVariant}
                rank={validVariant === 'best' ? (page - 1) * PAGE_SIZE + i + 1 : undefined}
                eagerMedia={(page - 1) * PAGE_SIZE + i < 2}
              />
            </div>
          ))
        ) : (
          <div className="animate-fade-in-feed py-16 text-center text-sm text-gray-400">
            아직 매치업이 없어요
          </div>
        )}
      </div>

      {/* ── 페이지네이션 (퀵 데이터만 있으면 표시 — enrich과 무관) ── */}
      {!quickLoading && currentList.length > 0 && (
        <div className="mt-8 mb-6 pb-28 sm:pb-10 flex justify-center animate-fade-in-soft">
          <div className="inline-flex items-center gap-2 px-5 py-4 bg-gradient-to-b from-slate-100/95 to-slate-200/35 rounded-2xl border border-gray-200/70 shadow-md shadow-slate-200/60">
            <MainPagination current={page} total={totalPages} onPage={goPage} />
          </div>
        </div>
      )}
    </div>
  )
}
