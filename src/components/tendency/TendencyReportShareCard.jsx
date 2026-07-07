import { forwardRef } from 'react'
import { buildTendencyShareMiddleLine } from '../../lib/tendencyReportShare'

/**
 * SNS 공유용 카드 — 상단 로고(contain) · 중단 문구 · 하단 URL
 */
export const TendencyReportShareCard = forwardRef(function TendencyReportShareCard(
  { report, shareUrl },
  ref,
) {
  if (!report) return null

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed left-[-9999px] top-0 z-[-1] w-[1080px] bg-gradient-to-br from-[#0f0c1d] via-[#1a1035] to-[#0f172a] px-12 py-12"
      style={{ fontFamily: 'system-ui, "Pretendard Variable", sans-serif' }}
    >
      <div className="flex flex-col items-center rounded-[40px] border border-white/12 bg-black/20 px-14 py-16 text-center shadow-2xl">
        <div className="flex h-36 w-full items-center justify-center">
          <img
            src="/logo.png"
            alt="VictorySpace"
            className="max-h-32 max-w-[400px] w-auto object-contain"
            crossOrigin="anonymous"
          />
        </div>

        <div className="mt-8 w-full space-y-4">
          <p className="text-[42px] font-black leading-tight text-white">
            나의 Vics 성향 리포트 📊
          </p>
          <p className="text-[34px] font-bold leading-snug text-violet-100/95">
            {buildTendencyShareMiddleLine(report)}
          </p>
        </div>

        <p className="mt-10 break-all text-[26px] font-semibold leading-snug text-cyan-300/90">
          {shareUrl}
        </p>
      </div>
    </div>
  )
})
