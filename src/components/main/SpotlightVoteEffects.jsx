import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'

const COLORS = ['#34d399', '#2dd4bf', '#22d3ee', '#a78bfa', '#fde047', '#f472b6']

/**
 * 메인 스포트라이트 투표 직후 — 화면 어둡게/번쩍임, 버튼 기준 네온 충격파, confetti
 * 헤더(z-30) 위에 두지 않아 GNB 포인트 펄스가 보이도록 z-[25] 대역 사용
 */
export function SpotlightVoteEffects({ active, anchorRect, reducedMotion, onFinish }) {
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  useEffect(() => {
    if (!active) return

    if (reducedMotion || !anchorRect) {
      const t = window.setTimeout(() => finishRef.current?.(), 0)
      return () => window.clearTimeout(t)
    }

    const cx = (anchorRect.left + anchorRect.right) / 2 / window.innerWidth
    const cy = (anchorRect.top + anchorRect.bottom) / 2 / window.innerHeight

    const timers = []
    const bursts = [0, 160, 340, 520, 780, 1040, 1380, 1720, 2080, 2460]
    for (const delay of bursts) {
      timers.push(
        window.setTimeout(() => {
          confetti({
            particleCount: 38,
            spread: 62,
            startVelocity: 36,
            origin: { x: cx + (Math.random() - 0.5) * 0.07, y: cy + (Math.random() - 0.5) * 0.06 },
            colors: COLORS,
            ticks: 200,
            gravity: 0.95,
            scalar: 1.02,
            zIndex: 28,
          })
        }, delay),
      )
    }

    timers.push(
      window.setTimeout(() => {
        confetti({
          particleCount: 32,
          angle: 58,
          spread: 48,
          origin: { x: 0.08, y: 0.55 },
          colors: COLORS,
          ticks: 200,
          zIndex: 28,
        })
        confetti({
          particleCount: 32,
          angle: 122,
          spread: 48,
          origin: { x: 0.92, y: 0.55 },
          colors: COLORS,
          ticks: 200,
          zIndex: 28,
        })
      }, 220),
    )

    const done = window.setTimeout(() => finishRef.current?.(), 3000)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(done)
    }
  }, [active, anchorRect, reducedMotion])

  if (!active || !anchorRect || reducedMotion) return null

  const ox = (anchorRect.left + anchorRect.right) / 2
  const oy = (anchorRect.top + anchorRect.bottom) / 2

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[25] bg-black/40 spotlight-vote-dim"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-[26] bg-white/40 spotlight-vote-flash"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed z-[27] -translate-x-1/2 -translate-y-1/2"
        style={{ left: ox, top: oy }}
      >
        <div className="spotlight-vote-shock h-[5.5rem] w-[5.5rem] rounded-full border-[3px] border-emerald-300/95 shadow-[0_0_48px_rgba(52,211,153,0.75)]" />
      </div>
    </>,
    document.body,
  )
}
