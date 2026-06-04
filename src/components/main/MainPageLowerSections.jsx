import { Link } from 'react-router-dom'
import { ChevronRight, Trophy, Zap } from 'lucide-react'
import { getCurrentSeason, getDaysUntilSeasonEnd } from '../../lib/season'
import { VipBillboard } from './VipBillboard'
import { MatchupCarousel } from './MatchupCarousel'
import { MainMatchupCard } from './MainMatchupCard'
import { MainCardSkeleton } from './MainCardSkeleton'
import { GoatRankingSection } from './GoatRankingSection'
import { MainRankingBoard } from './MainRankingBoard'
import { MAIN_FEED_NEW_LIMIT } from '../../lib/mainFeed'

/**
 * 메인 홈 하단: VIP 전광판 · NEW 캐러셀 · GOAT · 랭킹 보드.
 * 상단 스포트라이트·베스트·추천 이후 지연 로드용 청크.
 */
export function MainPageLowerSections({ quickLoading, newItems }) {
  const list = Array.isArray(newItems) ? newItems : []

  return (
    <>
      <VipBillboard />

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-emerald-500" />
          <h2 className="text-lg font-bold text-[#22282E] tracking-tight">NEW 매치업</h2>
        </div>
        <MatchupCarousel>
          {quickLoading
            ? Array.from({ length: MAIN_FEED_NEW_LIMIT }).map((_, i) => (
                <MainCardSkeleton key={`sk-new-${i}`} compact staticLcp={i === 0} />
              ))
            : list.slice(0, MAIN_FEED_NEW_LIMIT).map((m, i) => (
                <div
                  key={m.id}
                  className="animate-fade-in-feed-stagger"
                  style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
                >
                  <MainMatchupCard matchup={m} variant="new" eagerMedia={i < 2} />
                </div>
              ))}
        </MatchupCarousel>
        {!quickLoading && list.length >= MAIN_FEED_NEW_LIMIT && (
          <div className="mt-3 flex justify-end px-4">
            <Link
              to="/feed/new"
              className="inline-flex flex-row items-center gap-0.5 whitespace-nowrap text-sm font-bold text-emerald-600 hover:text-emerald-500 transition-colors"
            >
              더보기
              <ChevronRight size={16} strokeWidth={2.5} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <GoatRankingSection />

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-[#22282E] tracking-tight">
              랭킹 보드 TOP
              <span className="ml-1 text-sm font-medium text-slate-400">(역대 누적 강자)</span>
            </h2>
          </div>
          <span className="text-xs text-gray-500">
            시즌 {getCurrentSeason().number} · {getDaysUntilSeasonEnd()}일 후 종료
          </span>
        </div>
        <MainRankingBoard />
      </section>
    </>
  )
}
