import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function playZing(ctx) {
  if (!ctx) return
  try {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.08)
    g.gain.setValueAtTime(0.055, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.11)
  } catch {
    /* noop */
  }
}

function playTak(ctx) {
  if (!ctx) return
  try {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.setValueAtTime(200, ctx.currentTime)
    g.gain.setValueAtTime(0.09, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.06)
  } catch {
    /* noop */
  }
}

function playDoneChime(ctx) {
  if (!ctx) return
  try {
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      const t0 = ctx.currentTime + i * 0.055
      o.frequency.setValueAtTime(freq, t0)
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.065, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2)
      o.connect(g)
      g.connect(ctx.destination)
      o.start(t0)
      o.stop(t0 + 0.22)
    })
  } catch {
    /* noop */
  }
}

/**
 * 결제 직후 ~3초 — 빈 카드 + 네온 레이저 각인 후 onComplete
 */
export function VCardCraftingOverlay({ open, audioCtx, nickname, engraveLines, onComplete }) {
  const [cardIn, setCardIn] = useState(false)
  const [laserPass, setLaserPass] = useState(0)
  const [revealed, setRevealed] = useState([])
  const [doneFlash, setDoneFlash] = useState(false)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!open) {
      ranRef.current = false
      setCardIn(false)
      setLaserPass(0)
      setRevealed([])
      setDoneFlash(false)
      return
    }
    if (ranRef.current) return
    ranRef.current = true

    const lines = engraveLines?.length ? engraveLines : [nickname || 'Victory']
    setRevealed(lines.map(() => false))

    let cancelled = false
    const run = async () => {
      const INTRO = 200
      const OUTRO = 340
      const perLine = Math.max(260, Math.floor((3000 - INTRO - OUTRO) / lines.length))

      await sleep(Math.round(INTRO * 0.45))
      if (cancelled) return
      setCardIn(true)
      await sleep(Math.round(INTRO * 0.55))
      if (cancelled) return

      for (let i = 0; i < lines.length; i++) {
        playZing(audioCtx)
        setLaserPass(i + 1)
        await sleep(Math.round(perLine * 0.4))
        if (cancelled) return
        playTak(audioCtx)
        setRevealed(lines.map((_, j) => j <= i))
        await sleep(Math.round(perLine * 0.6))
        if (cancelled) return
      }

      setLaserPass(0)
      await sleep(90)
      if (cancelled) return
      playDoneChime(audioCtx)
      setDoneFlash(true)
      await sleep(250)
      if (!cancelled) onComplete?.()
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [open, audioCtx, nickname, engraveLines, onComplete])

  if (!open) return null

  const lines = engraveLines?.length ? engraveLines : [nickname || 'Victory']

  return (
    <div
      className="fixed inset-0 z-[100050] flex flex-col items-center justify-center bg-black/72 px-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal
      aria-label="V-Card 제작 중"
    >
      <style>{`
        @keyframes vcard-craft-laser {
          0% { transform: translate(-50%, -20%); opacity: 1; }
          100% { transform: translate(-50%, 120%); opacity: 0.45; }
        }
        @keyframes vcard-craft-pop {
          0% { transform: translate(-50%, 8px) scale(0.88); opacity: 0; }
          70% { transform: translate(-50%, 0) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        @keyframes vcard-done-glow {
          0%, 100% { box-shadow: 0 0 18px rgba(236,72,153,0.5), 0 0 36px rgba(34,211,238,0.3); }
          50% { box-shadow: 0 0 28px rgba(236,72,153,0.85), 0 0 48px rgba(34,211,238,0.45); }
        }
      `}</style>

      <div
        className={cn(
          'relative flex w-[min(260px,78vw)] flex-col items-stretch overflow-hidden rounded-2xl border-2 border-slate-500/95 bg-gradient-to-b from-slate-900 via-slate-950 to-black px-4 py-5 shadow-2xl transition-all duration-[400ms]',
          cardIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
        style={{ aspectRatio: '9 / 16', maxHeight: 'min(52vh, 400px)' }}
      >
        {laserPass > 0 && laserPass <= lines.length && (
          <div
            key={laserPass}
            className="pointer-events-none absolute left-1/2 top-0 z-20 w-[3px] rounded-full bg-gradient-to-b from-cyan-200 via-fuchsia-400 to-transparent opacity-95"
            style={{
              height: '36%',
              left: '50%',
              animation: 'vcard-craft-laser 0.52s ease-in forwards',
              boxShadow: '0 0 16px rgba(34,211,238,0.95), 0 0 24px rgba(236,72,153,0.7)',
            }}
          />
        )}

        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 pt-1 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300/75">VictorySpace</p>
          <div className="flex min-h-[100px] w-full flex-col items-center justify-center gap-2">
            {lines.map((line, i) => (
              <p
                key={i}
                className={cn(
                  'max-w-full truncate px-1 text-sm font-black transition-all duration-200 sm:text-[15px]',
                  revealed[i]
                    ? 'bg-gradient-to-r from-fuchsia-200 via-white to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                    : 'text-transparent',
                )}
              >
                {line}
              </p>
            ))}
          </div>
          <div className="mt-auto h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          <p className="pb-0.5 text-[9px] font-bold text-slate-500">LASER ENGRAVE</p>
        </div>
      </div>

      {doneFlash && (
        <div
          className="pointer-events-none absolute left-1/2 top-[min(72%,480px)] z-[100051] rounded-2xl border-2 border-fuchsia-400/85 bg-gradient-to-r from-fuchsia-950/95 via-slate-900 to-cyan-950/95 px-5 py-2.5 text-center"
          style={{
            animation:
              'vcard-craft-pop 0.42s ease-out forwards, vcard-done-glow 1.1s ease-in-out 0.42s infinite',
          }}
        >
          <p className="text-sm font-black tracking-tight text-white sm:text-base">V-Card 생성 완료!</p>
          <p className="mt-0.5 text-[10px] font-semibold text-cyan-200/85">VictorySpace</p>
        </div>
      )}
    </div>
  )
}
