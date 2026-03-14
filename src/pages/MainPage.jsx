import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Flame, Sparkles, Zap } from 'lucide-react'
import { fetchMainMatchups } from '../lib/mainFeed'
import {
  MainMatchupCard,
  MainRankingBoard,
  MainCardSkeleton,
  MainTabBar,
} from '../components/main'

export function MainPage() {
  const [data, setData] = useState({ best: [], hot: [], new: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

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

  return (
    <div className="min-h-screen bg-[#0f1419] text-white -mx-4 -my-6 px-4 py-6 pb-24 sm:pb-8">
      {/* ── 상단 탭 바 (각 탭 → 독립 페이지 링크) ── */}
      <MainTabBar currentVariant={null} />

      {/* ── 베스트 매치업 ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Flame size={20} className="text-orange-400" />
          <h2 className="text-lg font-bold">베스트 매치업</h2>
        </div>
        <div className="relative -mx-4 overflow-hidden">
          <div
            className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 px-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-[min(280px,85vw)] min-w-[240px] sm:min-w-[280px] shrink-0 snap-start">
                    <MainCardSkeleton compact />
                  </div>
                ))
              : data.best.slice(0, 4).map((m, i) => (
                  <div key={m.id} className="w-[min(280px,85vw)] min-w-[240px] sm:min-w-[280px] shrink-0 snap-start">
                    <MainMatchupCard matchup={m} variant="best" rank={i + 1} />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ── 추천 매치업 ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} className="text-violet-400" />
          <h2 className="text-lg font-bold">추천 매치업</h2>
        </div>
        <div className="relative -mx-4 overflow-hidden">
          <div
            className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 px-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="w-[min(280px,85vw)] min-w-[240px] sm:min-w-[280px] shrink-0 snap-start">
                    <MainCardSkeleton compact />
                  </div>
                ))
              : data.hot.slice(0, 3).map((m) => (
                  <div key={m.id} className="w-[min(280px,85vw)] min-w-[240px] sm:min-w-[280px] shrink-0 snap-start">
                    <MainMatchupCard matchup={m} variant="hot" />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ── NEW 매치업 ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-emerald-400" />
          <h2 className="text-lg font-bold">NEW 매치업</h2>
        </div>
        <div className="relative -mx-4 overflow-hidden">
          <div
            className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 px-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="w-[min(280px,85vw)] min-w-[240px] sm:min-w-[280px] shrink-0 snap-start">
                    <MainCardSkeleton compact />
                  </div>
                ))
              : data.new.slice(0, 3).map((m) => (
                  <div key={m.id} className="w-[min(280px,85vw)] min-w-[240px] sm:min-w-[280px] shrink-0 snap-start">
                    <MainMatchupCard matchup={m} variant="new" />
                  </div>
                ))}
          </div>
        </div>
        {!loading && data.new.length > 3 && (
          <Link
            to="/feed/new"
            className="inline-block mt-3 text-sm font-bold text-emerald-400 hover:text-emerald-300"
          >
            더보기 →
          </Link>
        )}
      </section>

      {/* ── 랭킹 보드 TOP ── */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={20} className="text-amber-400" />
          <h2 className="text-lg font-bold">랭킹 보드 TOP</h2>
        </div>
        <MainRankingBoard />
      </section>
    </div>
  )
}
