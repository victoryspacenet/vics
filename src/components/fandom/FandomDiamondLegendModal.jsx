import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../store/uiStore'
import { claimFandomMilestoneRpc } from '../../lib/fandomMilestones'
import { publishLegendFeedAnnouncement } from '../../lib/legendFeedAnnouncement'
import {
  playLegendBreakthroughPhase,
  playLegendCoronationPhase,
  playLegendSilencePhase,
} from '../../lib/legendDiamondAscensionSound'

const MILESTONE_DIAMOND = 5000

/** @type {0 | 1 | 2} */
// 0 silence, 1 breakthrough, 2 coronation

function FloatingShards({ active }) {
  const shards = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${6 + (i * 7) % 88}%`,
        delay: `${(i * 0.09).toFixed(2)}s`,
        size: 4 + (i % 4),
        rot: (i * 23) % 360,
      })),
    [],
  )
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {shards.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-sm bg-gradient-to-br from-cyan-200/90 via-white to-fuchsia-200/80 opacity-90 shadow-[0_0_8px_rgba(255,255,255,0.6)] vics-legend-shard-rise"
          style={{
            left: s.left,
            bottom: '12%',
            width: s.size,
            height: s.size * 1.4,
            transform: `rotate(${s.rot}deg)`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  )
}

function LaserBurst({ active }) {
  if (!active) return null
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[42%] h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-90"
      aria-hidden
    >
      <div className="absolute inset-0 vics-legend-laser-burst rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.95)_18deg,transparent_36deg,rgba(34,211,238,0.85)_52deg,transparent_70deg,rgba(255,255,255,0.75)_88deg,transparent_110deg)]" />
    </div>
  )
}

function GlassParticles({ active }) {
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-[1px] bg-white/80 vics-legend-glass-particle shadow-[0_0_4px_rgba(255,255,255,0.9)]"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `${(i * 23) % 100}%`,
            animationDelay: `${(i * 0.04).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * 다이아몬드 팬덤 등급(5000 Clap) 전용 — 3단계 전설 연출 + 피드 배너 게시
 */
export function FandomDiamondLegendModal({
  open,
  nickname = 'Victory',
  onClose,
  onClaimed,
  claimBehavior = 'rpc',
}) {
  const showToast = useUIStore((s) => s.showToast)
  const [phase, setPhase] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const timersRef = useRef([])
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => {
    if (!open) {
      clearTimers()
      setPhase(0)
      setShowPanel(false)
      return
    }
    if (reducedMotion) {
      setPhase(2)
      setShowPanel(true)
      playLegendCoronationPhase()
      return
    }
    setPhase(0)
    setShowPanel(false)
    playLegendSilencePhase()

    const t1 = window.setTimeout(() => {
      setPhase(1)
      playLegendBreakthroughPhase()
    }, 2600)
    const t2 = window.setTimeout(() => {
      setPhase(2)
      playLegendCoronationPhase()
    }, 2600 + 3200)
    const t3 = window.setTimeout(() => setShowPanel(true), 2600 + 3200 + 700)
    timersRef.current = [t1, t2, t3]
    return clearTimers
  }, [open, reducedMotion, clearTimers])

  const handleClaim = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (claimBehavior === 'demo') {
        onClaimed?.()
        return
      }
      const res = await claimFandomMilestoneRpc(MILESTONE_DIAMOND)
      if (!res.ok) {
        showToast(res.error, 'error')
        setSubmitting(false)
        return
      }
      const pub = await publishLegendFeedAnnouncement(nickname)
      if (!pub.ok && pub.error) {
        showToast(pub.error, 'error')
      }
      showToast('전설이 기록되었어요! 메인 피드에 잠시 배너가 올라가요 ✨', 'success')
      onClaimed?.()
    } finally {
      setSubmitting(false)
    }
  }, [submitting, claimBehavior, nickname, onClaimed, showToast])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && phase >= 2) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, phase, onClose])

  if (!open) return null

  const displayName = nickname || 'Victory'

  return createPortal(
    <div
      className="fixed inset-0 z-[100065] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legend-diamond-title"
    >
      <button
        type="button"
        className={cn(
          'absolute inset-0 transition-colors duration-700',
          phase === 0 && 'bg-black/[0.82]',
          phase === 1 && 'bg-black/[0.55]',
          phase >= 2 && 'bg-black/70 backdrop-blur-[2px]',
        )}
        aria-label={phase >= 2 ? '닫기' : '연출 진행 중'}
        onClick={() => (phase >= 2 ? onClose?.() : undefined)}
        disabled={phase < 2}
      />

      {/* Step 1 & 2 full-screen layers */}
      {phase < 2 && (
        <div className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center">
          <FloatingShards active={phase === 0} />
          {phase === 1 && (
            <>
              <LaserBurst active />
              <div
                className="z-[2] flex size-40 items-center justify-center rounded-3xl border-2 border-white/30 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-[0_0_60px_rgba(34,211,238,0.45)] vics-legend-rough-stone sm:size-44"
                aria-hidden
              >
                <div className="absolute inset-2 rounded-2xl border border-cyan-300/20 bg-gradient-to-t from-cyan-950/40 to-transparent" />
              </div>
              <div className="absolute left-1/2 top-1/2 z-[4] flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-2 border-cyan-100/80 bg-gradient-to-br from-cyan-200 via-white to-fuchsia-200 text-4xl shadow-[0_0_48px_rgba(255,255,255,0.85)] vics-legend-badge-spin sm:size-28 sm:text-5xl">
                💎
              </div>
              <GlassParticles active />
            </>
          )}
        </div>
      )}

      {/* Step 3 — 와이어프레임 패널 */}
      <div
        className={cn(
          'relative z-[2] w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-300/35 bg-gradient-to-b from-slate-950 via-indigo-950/95 to-slate-950 shadow-[0_0_80px_rgba(34,211,238,0.25)] transition-all duration-700',
          phase >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'pointer-events-none opacity-0 translate-y-6 scale-95',
        )}
      >
        <div className="pointer-events-none absolute inset-0 vics-legend-aurora-bg opacity-80" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent" aria-hidden />

        <div className="relative px-4 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
          <p
            id="legend-diamond-title"
            className="text-center text-[10px] font-black uppercase tracking-[0.42em] text-cyan-200/95 sm:text-[11px]"
          >
            <Sparkles className="mr-1 inline-block size-3.5 align-middle text-amber-200" aria-hidden />A LEGEND HAS
            DESCENDED
            <Sparkles className="ml-1 inline-block size-3.5 align-middle text-amber-200" aria-hidden />
          </p>

          <div className="relative mx-auto mt-5 flex h-36 items-center justify-center sm:h-40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-36 rounded-full bg-gradient-to-br from-cyan-400/25 via-fuchsia-500/20 to-white/10 blur-2xl sm:size-44" />
            </div>
            <div className="relative flex size-28 items-center justify-center rounded-2xl border-2 border-white/50 bg-gradient-to-br from-cyan-100 via-white to-fuchsia-200 text-5xl shadow-[0_0_56px_rgba(255,255,255,0.55)] sm:size-32 sm:text-6xl">
              💎
            </div>
          </div>

          <h2 className="vics-legend-metal-type mt-4 text-center text-lg font-black uppercase tracking-[0.2em] text-transparent sm:text-xl">
            UNTOUCHABLE LEGEND
          </h2>
          <p className="vics-legend-nickname-neon mt-3 text-center text-base font-black sm:text-lg">
            <span className="text-white">{displayName}</span>
            <span className="font-bold text-cyan-100/90"> 님, 당신은 이제 전설입니다.</span>
          </p>

          {showPanel && (
            <div className="mt-6 space-y-4 animate-fade-in-soft">
              <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 backdrop-blur-sm">
                <p className="mb-2 text-center text-xs font-black uppercase tracking-wide text-amber-200/90">
                  🎁 레전드 전용 특권 해제
                </p>
                <ul className="space-y-2 text-[11px] font-semibold leading-relaxed text-slate-100/95 sm:text-xs">
                  <li>
                    <span className="text-cyan-300">Nickname Effect:</span> 매치업 리스트에서 닉네임에 다이아몬드 오라
                  </li>
                  <li>
                    <span className="text-cyan-300">VIP Access:</span> 전체 공지권 1회 — 모든 유저에게 내 매치업 알림
                    (정책·앱 연동 예정)
                  </li>
                  <li>
                    <span className="text-cyan-300">Legendary Theme:</span> 메인 셸·헤더·하단 내비 다크 다이아몬드
                    스타일 — 포인트 리워드의 프로필·스타일에서 on/off
                  </li>
                </ul>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleClaim()}
                className="w-full rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-amber-500/35 transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? '기록 중…' : '🔥 전설의 길을 계속 걷기 (Claim Your Glory)'}
              </button>
              <p className="text-center text-[9px] font-medium leading-relaxed text-slate-400">
                클릭 시 마일스톤을 확정하고, 메인 피드 상단에 약 10분간 축하 배너가 노출돼요. 푸시 알림은 추후 연동될
                수 있어요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
