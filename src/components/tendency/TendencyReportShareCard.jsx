import { forwardRef } from 'react'
import { buildTendencyShareMiddleLine, getTendencyReportLandingUrl } from '../../lib/tendencyReportShare'

/**
 * SNS 공유용 카드 — 상단 로고(contain) · 중단 문구 · 하단 URL
 * html-to-image 캡처 전용 (화면 밖, z-0)
 */
export const TendencyReportShareCard = forwardRef(function TendencyReportShareCard(
  { report, shareUrl },
  ref,
) {
  if (!report) return null

  const displayUrl = shareUrl || getTendencyReportLandingUrl()
  const middleLine = buildTendencyShareMiddleLine(report)

  return (
    <div
      ref={ref}
      className="pointer-events-none w-[1080px] px-12 py-12"
      style={{
        fontFamily: 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
        background: 'linear-gradient(135deg, #0f0c1d 0%, #1a1035 50%, #0f172a 100%)',
        color: '#ffffff',
      }}
      aria-hidden
    >
      <div
        className="flex flex-col items-center rounded-[40px] px-14 py-16 text-center"
        style={{
          border: '2px solid rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(0,0,0,0.2)',
        }}
      >
        <div className="flex h-36 w-full flex-col items-center justify-center gap-3">
          <img
            src="/logo.png"
            alt=""
            width={320}
            height={128}
            className="max-h-32 max-w-[400px] w-auto object-contain"
            decoding="sync"
          />
          <p
            className="text-[36px] font-black tracking-tight"
            style={{ color: '#ffffff' }}
          >
            VictorySpace
          </p>
        </div>

        <div className="mt-8 w-full space-y-4">
          <p className="text-[42px] font-black leading-tight" style={{ color: '#ffffff' }}>
            나의 Vics 성향 리포트 📊
          </p>
          <p
            className="text-[34px] font-bold leading-snug"
            style={{ color: 'rgba(237, 233, 254, 0.95)' }}
          >
            {middleLine}
          </p>
        </div>

        <p
          className="mt-10 break-all text-[26px] font-semibold leading-snug"
          style={{ color: 'rgba(103, 232, 249, 0.9)' }}
        >
          {displayUrl}
        </p>
      </div>
    </div>
  )
})
