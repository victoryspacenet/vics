import { useMemo } from 'react'
import { cn } from '../../lib/utils'

function GoldDustLayer() {
  const specs = useMemo(
    () =>
      [12, 28, 44, 58, 72, 86, 22, 68].map((left, i) => ({
        left: `${left + (i % 3) * 3}%`,
        top: `${8 + (i * 11) % 84}%`,
        delay: `${(i * 0.35).toFixed(2)}s`,
        dur: `${2.4 + (i % 4) * 0.4}s`,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-sm" aria-hidden>
      {specs.map((s, i) => (
        <span
          key={i}
          className="absolute h-0.5 w-0.5 rounded-full bg-amber-200/90 shadow-[0_0_4px_rgba(253,224,71,0.9)] vics-story-neon-gold-dust"
          style={{ left: s.left, top: s.top, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
    </div>
  )
}

function MagmaFlames() {
  return (
    <div className="pointer-events-none absolute left-3 top-2 z-[2] flex gap-0.5" aria-hidden>
      <span className="vics-story-neon-flame text-[10px] leading-none opacity-90">🔥</span>
      <span className="vics-story-neon-flame-delayed text-[9px] leading-none opacity-80">🔥</span>
    </div>
  )
}

function MvpCrownPill() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1 z-[50] -translate-x-1/2"
      aria-hidden
    >
      <div className="vics-story-neon-mvp-pill flex items-center gap-0.5 rounded-full border border-white/30 bg-gradient-to-r from-amber-200 via-fuchsia-300 to-cyan-300 px-2 py-0.5 shadow-lg shadow-fuchsia-500/40">
        <span className="text-[8px]">🏆</span>
        <span className="text-[6px] font-black uppercase tracking-wide text-slate-900">MVP</span>
      </div>
    </div>
  )
}

function RainbowShine() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] rounded-sm vics-story-neon-rainbow-shine mix-blend-screen opacity-60"
      aria-hidden
    />
  )
}

function ArcticSparkFlash({ active }) {
  if (!active) return null
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[4] rounded-sm vics-story-neon-arctic-spark"
      aria-hidden
    />
  )
}

/**
 * V-Card 스토리 라이브 단계 — 카드 내부 최상단에 두는 네온 연출 레이어 (부모에 `relative` + 호스트 클래스)
 */
export function StoryNeonLayers({ archetype, arcticSpark }) {
  if (!archetype) return null

  return (
    <>
      {archetype === 'gold_aura' && <GoldDustLayer />}
      {archetype === 'luminous_rainbow' && (
        <>
                    <RainbowShine />
        </>
      )}
      {archetype === 'magma_flow' && <MagmaFlames />}
      <ArcticSparkFlash active={archetype === 'arctic_pulse' && arcticSpark} />
    </>
  )
}

/** @param {string | null} archetype */
export function storyNeonHostClass(archetype, boosted) {
  if (!archetype) return ''
  const slug = archetype.replace(/_/g, '-')
  return cn(
    'vics-story-neon-host',
    `vics-story-neon-host--${slug}`,
    boosted && 'vics-story-neon-host--boost',
  )
}
