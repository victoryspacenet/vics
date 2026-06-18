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
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 shadow-[0_4px_14px_-2px_rgba(20,184,166,0.5)]">
              <Zap size={18} className="text-white" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-base font-black leading-none bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent tracking-tight">
                NEW 매치업
              </h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-500/80">JUST ARRIVED</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 shadow-sm">
            ⚡ NEW
          </span>
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
              className="inline-flex flex-row items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              더보기
              <ChevronRight size={14} strokeWidth={2.5} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <GoatRankingSection />

      <section className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 shadow-[0_4px_14px_-2px_rgba(245,158,11,0.5)]">
              <Trophy size={18} className="text-white" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-base font-black leading-none bg-gradient-to-r from-amber-600 via-yellow-500 to-orange-500 bg-clip-text text-transparent tracking-tight">
                랭킹 보드 TOP
              </h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500/80">
                시즌 {getCurrentSeason().number} · {getDaysUntilSeasonEnd()}일 후 종료
              </p>
            </div>
          </div>
          <span className="rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 shadow-sm">
            🏆 RANK
          </span>
        </div>
        <MainRankingBoard />
      </section>
    </>
  )
}
