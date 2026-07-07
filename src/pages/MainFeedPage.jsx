import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  fetchMainBestFeedPage,
  fetchMainHotFeedPage,
  fetchMainNewFeedPage,
  invalidateMainFeaturedFeedCache,
} from '../lib/mainFeed'
import { enrichMatchupsWithCreatorRankInfo } from '../lib/creatorRankSnapshot'
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
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [page, setPage] = useState(1)

  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const validVariant = ['best', 'hot', 'new'].includes(variant) ? variant : null

  const loadSeqRef = useRef(0)

  const loadFeed = useCallback(async () => {
    if (!validVariant) return
    const seq = ++loadSeqRef.current
    const hadRows = rowsRef.current.length > 0
    if (!hadRows) setLoading(true)
    setEnriching(false)

    let fetchedRows = []
    let fetchedTotal = 0
    try {
      if (validVariant === 'best') {
        const result = await fetchMainBestFeedPage({ page, pageSize: PAGE_SIZE })
        fetchedRows = result.rows
        fetchedTotal = result.totalCount
      } else if (validVariant === 'hot') {
        const result = await fetchMainHotFeedPage({ page, pageSize: PAGE_SIZE })
        fetchedRows = result.rows
        fetchedTotal = result.totalCount
      } else {
        const result = await fetchMainNewFeedPage({ page, pageSize: PAGE_SIZE })
        fetchedRows = result.rows
        fetchedTotal = result.totalCount
      }

      if (seq !== loadSeqRef.current) return
      setRows(fetchedRows)
      setTotalCount(fetchedTotal)
    } catch (err) {
      console.error(err)
      if (seq === loadSeqRef.current) {
        setRows([])
        setTotalCount(0)
        fetchedRows = []
      }
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }

    if (seq !== loadSeqRef.current || !fetchedRows.length) return
    runWhenIdle(() => {
      void (async () => {
        if (seq !== loadSeqRef.current) return
        setEnriching(true)
        try {
          const enriched = await enrichMatchupsWithCreatorRankInfo(fetchedRows)
          if (seq !== loadSeqRef.current) return
          setRows(enriched)
        } catch (e) {
          console.warn('[MainFeedPage] creator rank enrich failed', e)
        } finally {
          if (seq === loadSeqRef.current) setEnriching(false)
        }
      })()
    }, { timeoutMs: 1200 })
  }, [validVariant, page])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  useEffect(() => {
    setPage(1)
    setRows([])
    setTotalCount(0)
    setLoading(true)
  }, [validVariant])

  useEffect(() => {
    const on = () => {
      invalidateMainFeaturedFeedCache()
      void loadFeed()
    }
    window.addEventListener('vics:matchup-banner-highlight:updated', on)
    return () => window.removeEventListener('vics:matchup-banner-highlight:updated', on)
  }, [loadFeed])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const goPage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!validVariant) return <Navigate to="/feed/best" replace />

  return (
    <div className="min-h-screen text-[#22282E] -mx-4 -my-6 px-4 py-6 pb-24 sm:pb-8">
      {/* 넓은 화면에서 카드가 과하게 늘어나지 않도록 가운데 정렬된 폭으로 제한 */}
      <div className="mx-auto w-full max-w-2xl">
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

        {enriching && !loading && rows.length > 0 && (
          <p className="mb-3 text-center text-[11px] font-medium text-slate-400 tabular-nums" aria-live="polite">
            크리에이터 랭크 정보 동기화 중…
          </p>
        )}

        <div className="space-y-4">
          {loading ? (
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
          ) : rows.length > 0 ? (
            rows.map((m, i) => (
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

        {!loading && totalCount > 0 && (
          <div className="mt-8 mb-6 pb-28 sm:pb-10 flex justify-center animate-fade-in-soft">
            <div className="inline-flex items-center gap-2 px-5 py-4 bg-gradient-to-b from-slate-100/95 to-slate-200/35 rounded-2xl border border-gray-200/70 shadow-md shadow-slate-200/60">
              <MainPagination current={page} total={totalPages} onPage={goPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
