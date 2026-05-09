import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Trophy, Gift, Star, Crown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../store/uiStore'
import { getFandomMilestoneRewardCopy, getFandomTierMeta, fandomTierFromClaps } from '../../lib/fandomTiers'
import { claimFandomMilestoneRpc } from '../../lib/fandomMilestones'

const CHEER_DURATION_SEC = 2

function playCheerBurst() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const t0 = ctx.currentTime
    const D = CHEER_DURATION_SEC

    const master = ctx.createGain()
    master.gain.value = 0.88
    master.connect(ctx.destination)

    const len = Math.ceil(ctx.sampleRate * D)
    const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const ch = noiseBuf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) {
      const u = i / (ch.length - 1 || 1)
      const swell = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(u * Math.PI * 12))
      const fade = Math.sin(Math.PI * u)
      ch[i] = (Math.random() * 2 - 1) * swell * fade
    }

    const srcClap = ctx.createBufferSource()
    srcClap.buffer = noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(1200, t0)
    bp.Q.setValueAtTime(0.65, t0)
    const gClap = ctx.createGain()
    gClap.gain.setValueAtTime(0.0001, t0)
    gClap.gain.exponentialRampToValueAtTime(0.14, t0 + 0.08)
    gClap.gain.setValueAtTime(0.1, t0 + 0.35)
    gClap.gain.linearRampToValueAtTime(0.038, t0 + 1.0)
    gClap.gain.linearRampToValueAtTime(0.0001, t0 + D)
    srcClap.connect(bp)
    bp.connect(gClap)
    gClap.connect(master)

    const srcRoar = ctx.createBufferSource()
    srcRoar.buffer = noiseBuf
    const roarLp = ctx.createBiquadFilter()
    roarLp.type = 'lowpass'
    roarLp.frequency.setValueAtTime(420, t0)
    roarLp.frequency.exponentialRampToValueAtTime(260, t0 + D * 0.55)
    roarLp.Q.setValueAtTime(0.7, t0)
    const gRoar = ctx.createGain()
    gRoar.gain.setValueAtTime(0.0001, t0)
    gRoar.gain.exponentialRampToValueAtTime(0.11, t0 + 0.2)
    gRoar.gain.linearRampToValueAtTime(0.06, t0 + 0.85)
    gRoar.gain.linearRampToValueAtTime(0.0001, t0 + D)
    srcRoar.connect(roarLp)
    roarLp.connect(gRoar)
    gRoar.connect(master)

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(4.6, t0)
    lfo.frequency.linearRampToValueAtTime(5.5, t0 + D * 0.72)
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 36
    lfo.connect(lfoDepth)

    const waaVoices = [
      { h0: 152, h1: 318, h2: 405, amp: 0.064 },
      { h0: 172, h1: 345, h2: 428, amp: 0.046 },
      { h0: 188, h1: 298, h2: 388, amp: 0.032 },
    ]
    for (const v of waaVoices) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(v.h0, t0)
      osc.frequency.exponentialRampToValueAtTime(v.h1, t0 + 0.2)
      osc.frequency.exponentialRampToValueAtTime(v.h2, t0 + 0.52)
      osc.frequency.linearRampToValueAtTime(v.h2 * 0.9, t0 + 1.05)
      osc.frequency.linearRampToValueAtTime(Math.max(205, v.h0 * 1.2), t0 + D)
      lfoDepth.connect(osc.detune)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1900
      lp.Q.value = 0.45
      const gWoo = ctx.createGain()
      gWoo.gain.setValueAtTime(0.0001, t0)
      gWoo.gain.exponentialRampToValueAtTime(v.amp, t0 + 0.11)
      gWoo.gain.setValueAtTime(v.amp * 0.8, t0 + 0.28)
      gWoo.gain.linearRampToValueAtTime(v.amp * 0.96, t0 + 0.38)
      gWoo.gain.setValueAtTime(v.amp * 0.74, t0 + 0.5)
      gWoo.gain.linearRampToValueAtTime(v.amp * 0.9, t0 + 0.64)
      gWoo.gain.linearRampToValueAtTime(v.amp * 0.42, t0 + 1.12)
      gWoo.gain.linearRampToValueAtTime(0.0001, t0 + D)
      osc.connect(lp)
      lp.connect(gWoo)
      gWoo.connect(master)
      osc.start(t0)
      osc.stop(t0 + D)
    }
    lfo.start(t0)
    lfo.stop(t0 + D)
    srcClap.start(t0)
    srcClap.stop(t0 + D)
    srcRoar.start(t0)
    srcRoar.stop(t0 + D)

    window.setTimeout(() => { try { void ctx.close() } catch { /* ignore */ } }, D * 1000 + 180)
  } catch { /* ignore */ }
}

// ── 등급별 테마 ────────────────────────────────────────────────────────────

const TIER_THEMES = {
  bronze: {
    /** 배경 그라데이션 (어두운 베이스) */
    bg: 'from-stone-950 via-orange-950 to-stone-950',
    glow: 'shadow-[0_0_60px_rgba(180,83,9,0.45)]',
    border: 'border-orange-700/50',
    radial: 'radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(251,146,60,0.25),transparent_55%)',
    /** 배지 박스 */
    badgeBg: 'from-orange-700 via-amber-800 to-stone-700',
    badgeBorder: 'border-orange-500/80',
    badgeShadow: 'shadow-[0_0_36px_rgba(194,65,12,0.65)]',
    /** 팝 글로우 (배지 뒤) */
    glowBall: 'bg-orange-500/20',
    /** 텍스트 */
    headingText: 'text-orange-100/95',
    tagline: '당신은 이제 라이징 스타입니다',
    taglineEn: 'Rising Star Unlocked',
    subText: 'text-amber-300/90',
    rewardBorder: 'border-orange-700/30',
    rewardBg: 'bg-black/35',
    /** 버튼 */
    revealBtn: 'from-orange-600/90 via-amber-700/90 to-orange-800/90 border-orange-500/50 shadow-orange-700/30',
    claimBtn: 'from-orange-500 via-amber-600 to-rose-700 border-orange-400/60 shadow-amber-600/35',
    /** 아이콘 */
    icon: Star,
    iconClass: 'text-orange-950',
  },
  silver: {
    bg: 'from-slate-950 via-slate-800 to-slate-950',
    glow: 'shadow-[0_0_60px_rgba(148,163,184,0.35)]',
    border: 'border-slate-500/50',
    radial: 'radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(203,213,225,0.22),transparent_55%)',
    badgeBg: 'from-slate-400 via-slate-200 to-slate-500',
    badgeBorder: 'border-slate-300/80',
    badgeShadow: 'shadow-[0_0_40px_rgba(203,213,225,0.55)]',
    glowBall: 'bg-slate-300/20',
    headingText: 'text-slate-100/95',
    tagline: '당신은 이제 크라우드 페이버릿입니다',
    taglineEn: 'Crowd Favorite Unlocked',
    subText: 'text-slate-300/90',
    rewardBorder: 'border-slate-500/30',
    rewardBg: 'bg-black/35',
    revealBtn: 'from-slate-500/90 via-slate-400/90 to-slate-600/90 border-slate-300/50 shadow-slate-500/30',
    claimBtn: 'from-slate-500 via-slate-400 to-slate-600 border-slate-300/60 shadow-slate-400/35',
    icon: Trophy,
    iconClass: 'text-slate-700',
  },
  gold: {
    bg: 'from-slate-950 via-violet-950 to-slate-950',
    glow: 'shadow-[0_0_60px_rgba(217,70,239,0.35)]',
    border: 'border-fuchsia-400/40',
    radial: 'radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(251,191,36,0.22),transparent_55%),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(52,211,153,0.12),transparent_50%)',
    badgeBg: 'from-amber-300 via-yellow-400 to-amber-600',
    badgeBorder: 'border-amber-200/80',
    badgeShadow: 'shadow-[0_0_40px_rgba(251,191,36,0.55)]',
    glowBall: 'bg-emerald-400/25',
    headingText: 'text-white',
    tagline: '당신은 이제 빅토리 아이콘입니다',
    taglineEn: 'Victory Icon Unlocked',
    subText: 'text-amber-200/90',
    rewardBorder: 'border-white/10',
    rewardBg: 'bg-black/30',
    revealBtn: 'from-emerald-500/90 via-teal-500/90 to-cyan-600/90 border-emerald-400/50 shadow-emerald-500/30',
    claimBtn: 'from-amber-500 via-orange-500 to-rose-600 border-amber-400/60 shadow-amber-500/35',
    icon: Trophy,
    iconClass: 'text-amber-950',
  },
}

function getTierTheme(tierId) {
  return TIER_THEMES[tierId] || TIER_THEMES.gold
}

/**
 * @param {{
 *   milestone: number
 *   open: boolean
 *   onClose: () => void
 *   onClaimed: () => void
 *   claimBehavior?: 'rpc' | 'demo'
 * }} props
 */
export function FandomMilestoneModal({ milestone, open, onClose, onClaimed, claimBehavior = 'rpc' }) {
  const showToast = useUIStore((s) => s.showToast)
  const [submitting, setSubmitting] = useState(false)
  const [badgeReveal, setBadgeReveal] = useState(false)

  useEffect(() => {
    if (!open) setBadgeReveal(false)
  }, [open])

  const handleConfirm = useCallback(async () => {
    if (!milestone || submitting) return
    setSubmitting(true)
    playCheerBurst()
    try {
      if (claimBehavior === 'demo') {
        onClaimed?.()
        return
      }
      const res = await claimFandomMilestoneRpc(milestone)
      if (!res.ok) {
        showToast(res.error, 'error')
        setSubmitting(false)
        return
      }
      onClaimed?.()
    } finally {
      setSubmitting(false)
    }
  }, [milestone, onClaimed, claimBehavior, submitting, showToast])

  const handleReveal = useCallback(() => setBadgeReveal(true), [])

  if (!open || !milestone) return null

  const { accruedFp, tierLabel, badge } = getFandomMilestoneRewardCopy(milestone)
  const tierId = fandomTierFromClaps(milestone)
  const tierMeta = getFandomTierMeta(tierId === 'none' ? 'bronze' : tierId)
  const theme = getTierTheme(tierId === 'none' ? 'bronze' : tierId)
  const TierIcon = theme.icon

  const perks = tierMeta?.perks || ''

  return createPortal(
    <div
      className="fixed inset-0 z-[100060] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fandom-milestone-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/72 backdrop-blur-md"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-[1] w-full max-w-md overflow-hidden rounded-3xl border bg-gradient-to-b',
          theme.bg,
          theme.border,
          theme.glow,
        )}
      >
        {/* 배경 글로우 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: theme.radial }}
        />

        <div className="relative px-5 pb-6 pt-7 sm:px-7 sm:pb-8 sm:pt-9">
          {/* 상단 태그라인 */}
          <p
            className={cn(
              'mb-1 text-center text-[11px] font-black uppercase tracking-[0.35em]',
              theme.subText,
            )}
          >
            <Sparkles className="inline-block size-3.5 align-middle opacity-90" aria-hidden />{' '}
            <span id="fandom-milestone-title">{theme.taglineEn}</span>{' '}
            <Sparkles className="inline-block size-3.5 align-middle opacity-90" aria-hidden />
          </p>

          <h2
            className={cn(
              'text-center text-xl font-black leading-tight drop-shadow-sm sm:text-2xl',
              theme.headingText,
            )}
          >
            축하합니다! {Number(milestone).toLocaleString('ko-KR')}명의 팬이
            <br />
            당신을 응원합니다
          </h2>

          {/* 배지 박스 */}
          <div className="relative mx-auto mt-6 flex h-36 items-center justify-center sm:h-40">
            <div
              className={cn(
                'absolute inset-0 rounded-full blur-2xl transition-opacity duration-700',
                theme.glowBall,
                badgeReveal ? 'opacity-100' : 'opacity-40',
              )}
            />
            <div
              className={cn(
                'relative flex size-28 items-center justify-center rounded-2xl border-2 bg-gradient-to-br transition-all duration-700 sm:size-32',
                theme.badgeBg,
                theme.badgeBorder,
                theme.badgeShadow,
                badgeReveal ? 'scale-100 rotate-0 opacity-100' : 'scale-50 rotate-6 opacity-0',
              )}
            >
              <TierIcon className={cn('size-14 drop-shadow-sm sm:size-16', theme.iconClass)} strokeWidth={2.2} />
            </div>
            <span className="pointer-events-none absolute bottom-1 text-2xl drop-shadow-lg">{badge}</span>
          </div>

          {/* 등급 라벨 */}
          <p
            className={cn(
              'mt-4 text-center text-sm font-bold',
              theme.subText,
            )}
          >
            F-Badge ·{' '}
            <span className={theme.headingText}>{tierLabel}</span>
          </p>
          <p className="mt-0.5 text-center text-[11px] font-semibold text-slate-300/80">
            {theme.tagline}
          </p>

          {/* 보상 패키지 */}
          <div
            className={cn(
              'mt-5 space-y-2 rounded-2xl border px-4 py-3.5 backdrop-blur-sm',
              theme.rewardBorder,
              theme.rewardBg,
            )}
          >
            <div
              className={cn(
                'flex items-center gap-2 text-xs font-black uppercase tracking-wide',
                theme.subText,
              )}
            >
              <Gift size={15} className="shrink-0" />
              달성 보상 패키지
            </div>
            <ul className="space-y-1.5 text-[12px] font-semibold leading-relaxed text-slate-100/95">
              <li>
                <span className={theme.subText}>F-Point 누적:</span> Clap 1회당 5 FP 규칙으로 약{' '}
                <span className={cn('tabular-nums', theme.headingText)}>
                  {accruedFp.toLocaleString('ko-KR')}
                </span>{' '}
                FP가 자동 적립된 상태예요.
              </li>
              <li>
                <span className={theme.subText}>Unlock:</span> 프로필·리스트에 표시되는{' '}
                <strong className="text-white">{tierLabel}</strong> 배지
              </li>
              {perks && (
                <li>
                  <span className={theme.subText}>Effect:</span>{' '}
                  <span className="text-slate-200/95">{perks}</span>
                </li>
              )}
            </ul>
          </div>

          {/* 버튼 */}
          {!badgeReveal ? (
            <button
              type="button"
              onClick={handleReveal}
              className={cn(
                'mt-6 w-full rounded-2xl border bg-gradient-to-r py-3.5 text-sm font-black text-white shadow-lg transition hover:brightness-110',
                theme.revealBtn,
              )}
            >
              배지 공개하기
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className={cn(
                'mt-6 w-full rounded-2xl border bg-gradient-to-r py-3.5 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-60',
                theme.claimBtn,
              )}
            >
              {submitting ? '처리 중…' : '영광을 만끽하기'}
            </button>
          )}

          <p className="mt-3 text-center text-[10px] font-medium text-slate-400">
            F-Point는 Clap을 받을 때마다 자동으로 쌓여요. 여기서는 달성·배지 기록만 남기며, 같은
            마일스톤은 한 번만 확인할 수 있어요.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
