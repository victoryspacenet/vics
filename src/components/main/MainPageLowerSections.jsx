import { Trophy } from 'lucide-react'
import { getCurrentSeason, getDaysUntilSeasonEnd } from '../../lib/season'
import { VipBillboard } from './VipBillboard'
import { GoatRankingSection } from './GoatRankingSection'
import { MainRankingBoard } from './MainRankingBoard'

/**
 * 메인 홈 하단: VIP 전광판 · GOAT · 랭킹 보드.
 * NEW·베스트·추천 캐러셀 이후 지연 로드용 청크.
 */
export function MainPageLowerSections() {
  return (
    <>
      <VipBillboard />

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
              <p className="mt-1 text-[11px] font-black tracking-tight text-orange-700">
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
