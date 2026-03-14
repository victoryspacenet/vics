import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { fetchMainMatchups } from '../lib/mainFeed'
import {
  MainMatchupCard,
  MainCardSkeleton,
  MainTabBar,
  MainPagination,
} from '../components/main'

const PAGE_SIZE = 12

export function MainFeedPage() {
  const { variant } = useParams()
  const [data, setData] = useState({ best: [], hot: [], new: [] })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const validVariant = ['best', 'hot', 'new'].includes(variant) ? variant : null
  if (!validVariant) return <Navigate to="/feed/best" replace />

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [validVariant])

  const load = async () => {
    setLoading(true)
    try {
      const result = await fetchMainMatchups()
      setData(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const currentList = data[validVariant] || []
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE))
  const pagedItems = currentList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const goPage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white -mx-4 -my-6 px-4 py-6 pb-24 sm:pb-8">
      {/* ── 상단 탭 바 (독립 페이지) ── */}
      <MainTabBar currentVariant={validVariant} />

      {/* ── 피드 ── */}
      <div className="space-y-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="py-3">
                <MainCardSkeleton />
              </div>
            ))
          : pagedItems.length > 0
          ? pagedItems.map((m, i) => (
              <div key={m.id} className="py-3">
                <MainMatchupCard
                  matchup={m}
                  variant={validVariant}
                  rank={validVariant === 'best' ? (page - 1) * PAGE_SIZE + i + 1 : undefined}
                />
              </div>
            ))
          : (
              <div className="py-16 text-center text-white/40 text-sm">
                아직 매치업이 없어요
              </div>
            )}
      </div>

      {/* ── 페이지네이션 ── */}
      {!loading && currentList.length > 0 && (
        <div className="mt-8 mb-6 pb-28 sm:pb-10 flex justify-center">
          <div className="inline-flex items-center gap-2 px-5 py-4 bg-[#1a2332] rounded-2xl border border-white/20 shadow-lg">
            <MainPagination current={page} total={totalPages} onPage={goPage} />
          </div>
        </div>
      )}
    </div>
  )
}
