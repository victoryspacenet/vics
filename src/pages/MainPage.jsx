import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Flame, Sparkles, Zap } from 'lucide-react'
import { fetchMainMatchups } from '../lib/mainFeed'
import { fetchActiveMainSpotlightMatchup } from '../lib/mainSpotlight'
import { useAuthStore } from '../store/authStore'
import { getCurrentSeason, getDaysUntilSeasonEnd } from '../lib/season'
import {
  SpotlightSection,
  MatchupCarousel,
  MainMatchupCard,
  MainRankingBoard,
  MainCardSkeleton,
  MainTabBar,
  VipBillboard,
  GoatRankingSection,
} from '../components/main'

export function MainPage() {
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState({ best: [], hot: [], new: [] })
  const [spotlightMatchup, setSpotlightMatchup] = useState(null)
  const [loading, setLoading] = useState(true)
  /** user null→복원 등으로 load가 겹치면 늦게 끝난 요청이 viewer_vote_side 없는 스냅샷으로 덮어쓰지 않게 함 */
  const mainLoadSeqRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++mainLoadSeqRef.current
    setLoading(true)
    try {
      const viewerId = user?.id ?? null
      const [result, spotlight] = await Promise.all([
        fetchMainMatchups(),
        fetchActiveMainSpotlightMatchup(viewerId),
      ])
      if (seq !== mainLoadSeqRef.current) return
      setData(result)
      setSpotlightMatchup(spotlight)
    } catch (err) {
      if (seq === mainLoadSeqRef.current) console.error(err)
    } finally {
      if (seq === mainLoadSeqRef.current) setLoading(false)
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

      {/* ── 베스트 매치업 ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Flame size={20} className="text-orange-500" />
          <h2 className="text-lg font-bold text-[#22282E] tracking-tight">베스트 매치업</h2>
        </div>
        <MatchupCarousel>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <MainCardSkeleton key={`sk-${i}`} compact />
              ))
            : data.best.slice(0, 10).map((m, i) => (
                <div
                  key={m.id}
                  className="animate-fade-in-feed-stagger"
                  style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                >
                  <MainMatchupCard matchup={m} variant="best" rank={i + 1} />
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
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <MainCardSkeleton key={`sk-${i}`} compact />
              ))
            : data.hot.slice(0, 10).map((m, i) => (
                <div
                  key={m.id}
                  className="animate-fade-in-feed-stagger"
                  style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                >
                  <MainMatchupCard matchup={m} variant="hot" />
                </div>
              ))}
        </MatchupCarousel>
      </section>

      {/* ── Vip 전광판 ── */}
      <VipBillboard />

      {/* ── NEW 매치업 ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-emerald-500" />
          <h2 className="text-lg font-bold text-[#22282E] tracking-tight">NEW 매치업</h2>
        </div>
        <MatchupCarousel>
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <MainCardSkeleton key={`sk-${i}`} compact />
              ))
            : data.new.slice(0, 3).map((m, i) => (
                <div
                  key={m.id}
                  className="animate-fade-in-feed-stagger"
                  style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                >
                  <MainMatchupCard matchup={m} variant="new" />
                </div>
              ))}
        </MatchupCarousel>
        {!loading && data.new.length > 3 && (
          <Link
            to="/feed/new"
            className="inline-block mt-3 text-sm font-bold text-emerald-600 hover:text-emerald-500"
          >
            더보기 →
          </Link>
        )}
      </section>

      {/* ── HOT 랭커 ── */}
      <GoatRankingSection />

      {/* ── 랭킹 보드 TOP ── */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-[#22282E] tracking-tight">랭킹 보드 TOP<span className="ml-1 text-sm font-medium text-slate-400">(역대 누적 강자)</span></h2>
          </div>
          <span className="text-xs text-gray-500">
            시즌 {getCurrentSeason().number} · {getDaysUntilSeasonEnd()}일 후 종료
          </span>
        </div>
        <MainRankingBoard />
      </section>
    </div>
  )
}



