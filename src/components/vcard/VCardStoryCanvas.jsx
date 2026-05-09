import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { Swords } from 'lucide-react'
import { cn } from '../../lib/utils'
import { resolveStoryNeonArchetype } from '../../lib/storyNeonThemes'
import { StoryNeonLayers, storyNeonHostClass } from './StoryNeonLayers'

const CONFETTI_COLORS = [
  '#a855f7',
  '#ec4899',
  '#f59e0b',
  '#22d3ee',
  '#4ade80',
  '#fb923c',
  '#f472b6',
  '#818cf8',
]

/** 축하 성공 후 콜백(응원 패널 등) — 폭죽이 한참 보인 뒤 실행 */
export const VCARD_CLAP_CONFETTI_FOLLOWUP_MS = 2300

function fireVcStoryConfetti() {
  const count = 200
  const defaults = { startVelocity: 32, spread: 360, ticks: 85, zIndex: 99999 }

  const shot = (particleRatio, opts) => {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      colors: CONFETTI_COLORS,
    })
  }

  shot(0.25, { spread: 26, startVelocity: 55, origin: { x: 0.5, y: 0.5 } })
  shot(0.22, { spread: 62, origin: { x: 0.5, y: 0.5 } })
  shot(0.32, { spread: 100, decay: 0.91, scalar: 0.82, origin: { x: 0.5, y: 0.5 } })
  shot(0.1, { speed: 1, spread: 120, startVelocity: 28, decay: 0.92, scalar: 1.15, origin: { x: 0.5, y: 0.5 } })
  setTimeout(() => {
    confetti({ particleCount: 70, angle: 60, spread: 58, origin: { x: 0, y: 0.6 }, colors: CONFETTI_COLORS, zIndex: 99999 })
    confetti({ particleCount: 70, angle: 120, spread: 58, origin: { x: 1, y: 0.6 }, colors: CONFETTI_COLORS, zIndex: 99999 })
  }, 280)
}

const THEMES = {
  classic: {
    shell: 'bg-white text-slate-900 border-2 border-slate-200',
    brand: 'text-slate-900',
    tag: 'text-slate-500',
    line: 'border-slate-200',
    badge: 'bg-slate-900 text-white',
    muted: 'text-slate-600',
    accent: 'text-fuchsia-600',
  },
  'dark-neon': {
    shell: 'bg-slate-950 text-cyan-100 border-2 border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.25)]',
    brand: 'text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]',
    tag: 'text-cyan-300/80',
    line: 'border-cyan-500/35',
    badge: 'bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white',
    muted: 'text-cyan-200/75',
    accent: 'text-fuchsia-300',
  },
  spotlight: {
    shell: cn(
      'bg-slate-950 text-amber-50 border-2 border-amber-400/50',
      'shadow-[0_0_40px_rgba(251,191,36,0.2)]',
      'bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,rgba(250,204,21,0.28),rgba(15,23,42,1)_45%,rgb(15,23,42)_100%)]',
    ),
    brand: 'text-white drop-shadow-[0_0_12px_rgba(251,191,36,0.85)]',
    tag: 'text-amber-200/80',
    line: 'border-amber-400/25',
    badge: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-900',
    muted: 'text-amber-100/75',
    accent: 'text-amber-300',
  },
  pixel: {
    shell: cn(
      'bg-[#0d280d] text-[#7cfc00] border-4 border-[#7cfc00]',
      'font-mono [image-rendering:pixelated]',
    ),
    brand: 'text-[#bfff00]',
    tag: 'text-[#5faf2a]',
    line: 'border-[#2a5f14]',
    badge: 'bg-[#1a3d0a] text-[#c8ff7a] border-2 border-[#7cfc00]',
    muted: 'text-[#8fdf4a]',
    accent: 'text-[#ffff66]',
  },
}

/** 인스타 스토리 비율 9:16 — 캡처 시 3배 스케일로 1080×1920 */
export const V_CARD_W = 360
export const V_CARD_H = 640

function StoryKeyframes() {
  return (
    <style>{`
      @keyframes vcard-neon-breathe {
        0%, 100% { opacity: 0.55; transform: scale(1); filter: blur(0px); }
        50% { opacity: 1; transform: scale(1.08); filter: blur(0.5px); }
      }
      @keyframes vcard-neon-ring {
        0% { transform: scale(0.72); opacity: 0.9; }
        70% { transform: scale(1.45); opacity: 0.12; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      @keyframes vcard-sword-left {
        0% { transform: rotate(-55deg) translateX(-40px); opacity: 0; }
        20% { opacity: 1; }
        45% { transform: rotate(12deg) translateX(0); }
        100% { transform: rotate(8deg) translateX(0); opacity: 1; }
      }
      @keyframes vcard-sword-right {
        0% { transform: rotate(55deg) translateX(40px); opacity: 0; }
        20% { opacity: 1; }
        45% { transform: rotate(-12deg) translateX(0); }
        100% { transform: rotate(-8deg) translateX(0); opacity: 1; }
      }
    `}</style>
  )
}

function SwordClashOverlay({ open, onFinish }) {
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => onFinish?.(), 720)
    return () => clearTimeout(t)
  }, [open, onFinish])

  if (!open) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100000] flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
      aria-hidden
    >
      <div className="relative flex h-32 w-32 items-center justify-center">
        <Swords
          className="absolute h-16 w-16 text-cyan-200 drop-shadow-[0_0_18px_rgba(34,211,238,0.95)]"
          style={{ animation: 'vcard-sword-left 0.7s ease-out forwards' }}
          strokeWidth={2.4}
        />
        <Swords
          className="absolute h-16 w-16 rotate-180 text-fuchsia-200 drop-shadow-[0_0_18px_rgba(236,72,153,0.95)]"
          style={{ animation: 'vcard-sword-right 0.7s ease-out forwards' }}
          strokeWidth={2.4}
        />
      </div>
    </div>
  )
}

function NeonWRateHero({ t, displayPct, wRateTarget, pixel }) {
  const rings = [0, 1, 2]
  return (
    <div className="relative mx-auto flex w-full max-w-[260px] flex-col items-center py-1">
      {rings.map((i) => (
        <span
          key={i}
          className={cn(
            'pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[118%] -translate-x-1/2 -translate-y-1/2 rounded-full',
            pixel ? 'border-2 border-[#7cfc00]/35' : 'border-2 border-fuchsia-400/25',
          )}
          style={{
            animation: `vcard-neon-ring 2.4s ease-out ${i * 0.55}s infinite`,
          }}
        />
      ))}
      <div
        className={cn(
          'relative z-[1] rounded-2xl px-4 py-2.5 text-center',
          pixel
            ? 'border-2 border-[#7cfc00] bg-[#061806] shadow-[0_0_24px_rgba(124,252,0,0.35)]'
            : cn(
                'border border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-950/80 via-slate-900/90 to-cyan-950/80',
                'shadow-[0_0_28px_rgba(217,70,239,0.45),0_0_48px_rgba(34,211,238,0.25)]',
              ),
        )}
        style={{
          animation: pixel ? undefined : 'vcard-neon-breathe 2.2s ease-in-out infinite',
        }}
      >
        <p className={cn('text-[9px] font-black uppercase tracking-[0.2em]', t.accent)}>✨ W-RATE ✨</p>
        <p
          className={cn(
            'mt-0.5 text-3xl font-black tabular-nums leading-none tracking-tight',
            pixel ? 'text-[#c8ff7a]' : 'bg-gradient-to-r from-fuchsia-200 via-white to-cyan-200 bg-clip-text text-transparent',
          )}
        >
          {displayPct}%
        </p>
        <p className={cn('mt-1 text-[9px] font-bold opacity-80', t.muted)}>
          {displayPct < wRateTarget ? '집계 중…' : '핵심 지표 로드 완료'}
        </p>
      </div>
    </div>
  )
}

export const VCardStoryCanvas = forwardRef(function VCardStoryCanvas(
  {
    theme,
    nickname,
    points,
    rankLabel,
    wRate,
    totalWins,
    creations,
    creationWins,
    bestMatchup,
    votes,
    votingAcc,
    upsetMatchup,
    vCardId,
    qrDataUrl,
    metrics,
    /** `static`: PNG 캡처용 고정 레이아웃 · `story`: 인스타 스토리 체험(로딩 훅 → 인터랙션) */
    experienceMode = 'static',
    onChallenge,
    onViewProfile,
    /** Point Reward「프로필 공개 권한」구매 시에만 View Full Profile CTA 표시 */
    profilePublicCtaEnabled = false,
    /** @returns {Promise<boolean>} true면 폭죽 연출 */
    onClap,
    /** 폭죽이 잦아든 뒤(팬 응원 UX 등) */
    onAfterClapConfetti,
    clapCount = 0,
    clapHasClapped = false,
    clapSubmitting = false,
    /** 카드 주인이 본인 미리보기 중일 때 (시청자만 축하 가능) */
    clapDisabledForOwner = false,
    /** 카드를 만든 유저(본인 카드) — 도전자 등장은 타인 매치업에만 가능 */
    challengeDisabledForCardOwner = false,
    /** 스토리 네온 테두리용 활동 스냅샷 — VictoryReportPage에서 전달 */
    storyNeonStats = null,
    /** `?storyNeon=` 등으로 정적·오프스크린 캔버스에도 임시 적용 */
    storyNeonPreviewOverride = null,
  },
  ref,
) {
  const t = THEMES[theme] || THEMES.spotlight
  const pixel = theme === 'pixel'
  const isStory = experienceMode === 'story'

  const resolvedNeonFromStats = useMemo(
    () => resolveStoryNeonArchetype(storyNeonStats ?? {}),
    [storyNeonStats],
  )
  const activeNeonArchetype = storyNeonPreviewOverride ?? (isStory ? resolvedNeonFromStats : null)
  const [storyNeonBoost, setStoryNeonBoost] = useState(false)
  const [storyArcticSpark, setStoryArcticSpark] = useState(false)

  const pulseStoryNeonBoost = useCallback(() => {
    setStoryNeonBoost(true)
    window.setTimeout(() => setStoryNeonBoost(false), 900)
  }, [])

  const m = metrics ?? {}
  const showWins = Boolean(m.overallWins)
  const showCreator = Boolean(m.creatorStreak)
  const showProphet = Boolean(m.predictionAcc)
  const showVotesRec = Boolean(m.totalVotesRec)

  const [storyPhase, setStoryPhase] = useState('hook')
  const [animatedWrate, setAnimatedWrate] = useState(0)
  const [hookCountDone, setHookCountDone] = useState(false)
  const [hookSecondary, setHookSecondary] = useState(false)
  const [swordsOpen, setSwordsOpen] = useState(false)
  const pendingChallenge = useRef(false)

  const wRateNum = Math.max(0, Math.min(100, Number(wRate) || 0))
  const phase = isStory ? storyPhase : 'live'

  useEffect(() => {
    if (!isStory) return
    let cancelled = false
    let raf = 0
    const tid = window.setTimeout(() => {
      if (cancelled) return
      setStoryPhase('hook')
      setAnimatedWrate(0)
      setHookCountDone(false)
      setHookSecondary(false)

      let start = 0
      const duration = 1050
      const step = (now) => {
        if (cancelled) return
        if (!start) start = now
        const p = Math.min(1, (now - start) / duration)
        const eased = 1 - (1 - p) ** 2.4
        setAnimatedWrate(Math.round(wRateNum * eased))
        if (p < 1) raf = requestAnimationFrame(step)
        else setHookCountDone(true)
      }
      raf = requestAnimationFrame(step)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(tid)
      cancelAnimationFrame(raf)
    }
  }, [isStory, wRateNum])

  useEffect(() => {
    if (!isStory) return
    const t0 = window.setTimeout(() => setHookSecondary(true), 380)
    return () => clearTimeout(t0)
  }, [isStory, wRateNum])

  useEffect(() => {
    if (!isStory || !hookCountDone) return
    const tDel = window.setTimeout(() => setStoryPhase('live'), 1500)
    return () => clearTimeout(tDel)
  }, [isStory, hookCountDone])

  const handleClaps = useCallback(async () => {
    if (!onClap || clapSubmitting || clapHasClapped || clapDisabledForOwner) return
    const ok = await onClap()
    if (ok) {
      fireVcStoryConfetti()
      if (isStory && activeNeonArchetype) {
        pulseStoryNeonBoost()
        if (activeNeonArchetype === 'arctic_pulse') {
          setStoryArcticSpark(true)
          window.setTimeout(() => setStoryArcticSpark(false), 420)
        }
      }
      if (onAfterClapConfetti) {
        window.setTimeout(() => onAfterClapConfetti(), VCARD_CLAP_CONFETTI_FOLLOWUP_MS)
      }
    }
  }, [
    onClap,
    onAfterClapConfetti,
    clapSubmitting,
    clapHasClapped,
    clapDisabledForOwner,
    isStory,
    activeNeonArchetype,
    pulseStoryNeonBoost,
  ])

  const finishSwordOverlay = useCallback(() => {
    setSwordsOpen(false)
    if (pendingChallenge.current) {
      pendingChallenge.current = false
      onChallenge?.()
    }
  }, [onChallenge])

  const handleChallenge = useCallback(() => {
    if (challengeDisabledForCardOwner) return
    if (isStory && activeNeonArchetype) {
      pulseStoryNeonBoost()
      if (activeNeonArchetype === 'arctic_pulse') {
        setStoryArcticSpark(true)
        window.setTimeout(() => setStoryArcticSpark(false), 420)
      }
    }
    pendingChallenge.current = true
    setSwordsOpen(true)
  }, [challengeDisabledForCardOwner, isStory, activeNeonArchetype, pulseStoryNeonBoost])

  const metricPanel = cn(
    'shrink-0 border px-2 py-1.5 text-center',
    pixel && 'rounded-none border-2 border-[#5faf2a]/70 bg-[#061806]',
    theme === 'classic' && !pixel && 'rounded-lg border-slate-200/90 bg-slate-50/95 shadow-sm',
    theme !== 'classic' && !pixel && 'rounded-lg border-white/12 bg-white/[0.07] backdrop-blur-[1px]',
  )

  const votesBlock =
    showProphet || showVotesRec ? (
      <div className="shrink-0 space-y-0.5 text-center">
        <p className={cn('text-[9px] font-black uppercase tracking-wider opacity-90', t.accent)}>
          {showVotesRec && showProphet && '예측 · 최다 투표'}
          {showVotesRec && !showProphet && '최다 투표'}
          {!showVotesRec && showProphet && '예측 정확도'}
        </p>
        <p className={cn('text-[10px] font-bold leading-tight', t.muted)}>
          Votes: <span className={cn(showVotesRec ? t.accent : '', 'font-black')}>{votes}</span>
          {showProphet && (
            <>
              {' '}
              / Voting Acc: <span className="font-black">{votingAcc}%</span>
            </>
          )}
        </p>
        {showProphet && upsetMatchup && (
          <p className={cn('text-[9px] font-semibold italic leading-tight', t.muted)}>
            <span className="uppercase tracking-wide not-italic opacity-80">Biggest upset:</span> {upsetMatchup}
          </p>
        )}
      </div>
    ) : null

  const metricsStack = (
    <div className="min-h-0 flex-1 space-y-2 overflow-hidden py-0.5 transition duration-700 ease-out">
      {showWins && (
        <div className={metricPanel}>
          <p className={cn('text-[9px] font-black uppercase tracking-wider', t.accent)}>승리</p>
          <div className="mt-1 flex justify-center">
            <span className={cn('rounded-full px-3 py-1 text-[11px] font-black', t.badge)}>W-RATE {wRate}%</span>
          </div>
          <p className={cn('mt-1 text-center text-[10px] font-bold leading-tight', t.muted)}>
            TOTAL WINS: <span className="font-black text-inherit">{totalWins}</span>
          </p>
        </div>
      )}

      {showCreator && (
        <div className={metricPanel}>
          <p className={cn('text-[9px] font-black uppercase tracking-wider', t.accent)}>생성 연승 · 크리에이터</p>
          <p className={cn('mt-0.5 text-[10px] font-bold leading-tight', t.muted)}>
            Creations: <span className="font-black">{creations}</span> / Creation Wins:{' '}
            <span className="font-black">{creationWins}</span>
          </p>
          {bestMatchup && (
            <p className={cn('mt-0.5 text-[9px] font-semibold leading-tight', t.muted)}>
              <span className="font-black opacity-80">Best:</span> {bestMatchup}
            </p>
          )}
        </div>
      )}

      {(showProphet || showVotesRec) && <div className={metricPanel}>{votesBlock}</div>}
    </div>
  )

  const storyHookBlock =
    isStory && phase === 'hook' ? (
      <div className="min-h-0 flex-1 overflow-hidden py-1">
        {isStory && <StoryKeyframes />}
        <NeonWRateHero t={t} displayPct={animatedWrate} wRateTarget={wRateNum} pixel={pixel} />
        <div
          className={cn(
            'mt-2 text-center transition-opacity duration-700',
            hookSecondary ? 'opacity-100' : 'opacity-0',
            t.muted,
          )}
        >
          <p className="text-[10px] font-bold">
            TOTAL WINS: <span className="font-black text-inherit">{totalWins}</span>
          </p>
          <p className="mt-1 text-[8px] font-semibold opacity-75">나머지 카드 정보는 잠시 후 표시됩니다</p>
        </div>
      </div>
    ) : null

  const interactionStrip =
    isStory && phase === 'live' ? (
      <div className="mt-1 space-y-1 rounded-lg border border-amber-400/35 bg-black/40 p-1.5 shadow-inner backdrop-blur-sm">
        <p className="text-center text-[8px] font-black uppercase tracking-wide text-amber-200">🔥 특별 인터랙션 존</p>
        <p className="text-center text-[7px] font-semibold leading-snug text-amber-100/85">이 V-Card에 호응을 보내세요!</p>
        <p className="text-center text-[7px] font-bold text-amber-100/95">
          누적 축하{' '}
          <span className="tabular-nums text-white">{Number(clapCount || 0).toLocaleString('ko-KR')}</span>회
        </p>
        <p className="text-center text-[6px] font-semibold leading-tight text-amber-200/75">
          시청자 계정당 1회만 집계돼요
        </p>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            title={
              clapDisabledForOwner
                ? '본인 카드에는 축하를 보낼 수 없어요. 다른 계정에서 열면 집계돼요.'
                : clapHasClapped
                  ? '이미 이 카드에 축하를 보냈어요.'
                  : undefined
            }
            disabled={!onClap || clapSubmitting || clapHasClapped || clapDisabledForOwner}
            onClick={handleClaps}
            className={cn(
              'rounded-md border border-emerald-400/50 bg-emerald-600/25 px-0.5 py-1.5 text-[7px] font-black leading-tight text-emerald-50',
              'transition hover:bg-emerald-500/35 active:scale-[0.98]',
              (!onClap || clapSubmitting || clapHasClapped || clapDisabledForOwner) &&
                'cursor-not-allowed opacity-50 hover:bg-emerald-600/25',
            )}
          >
            {clapDisabledForOwner ? '시청자만' : clapHasClapped ? '✓ 축하 완료' : '🎉 축하하기'}
            <span className="mt-0.5 block text-[6px] font-bold opacity-90">Claps</span>
          </button>
          <button
            type="button"
            title={
              challengeDisabledForCardOwner
                ? '내가 연 매치업에는 도전할 수 없어요. 다른 유저가 만든 매치업에서 도전해 주세요.'
                : undefined
            }
            disabled={challengeDisabledForCardOwner}
            onClick={handleChallenge}
            className={cn(
              'rounded-md border border-rose-400/50 bg-rose-600/25 px-0.5 py-1.5 text-[7px] font-black leading-tight text-rose-50',
              'transition hover:bg-rose-500/35 active:scale-[0.98]',
              challengeDisabledForCardOwner &&
                'cursor-not-allowed opacity-50 hover:bg-rose-600/25 active:scale-100',
            )}
          >
            도전자 등장
            <span className="mt-0.5 block text-[6px] font-bold opacity-90">Challenge</span>
          </button>
        </div>
      </div>
    ) : null

  const qrFooter = (
    <div
      className={cn(
        'mt-auto shrink-0 border-t pt-2',
        t.line,
        isStory && phase === 'hook' && 'pointer-events-none opacity-25 transition duration-700 ease-out',
        isStory && phase === 'live' && 'opacity-100 transition duration-700 ease-out',
      )}
    >
      <p className={cn('text-center text-[9px] font-black tracking-wide', t.muted)}>
        V-Card ID: <span className={t.accent}>{vCardId}</span>
      </p>
      <p className={cn('text-center text-[7px] font-semibold opacity-90', t.tag)}>View Full Profile</p>
      <div
        className={cn(
          'mx-auto mt-1 flex w-full max-w-[200px] flex-col items-stretch gap-1',
          isStory && phase === 'live' && 'touch-manipulation',
        )}
      >
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="프로필 링크 QR" width={88} height={88} className="mx-auto rounded-md bg-white p-0.5" />
        ) : (
          <div
            className={cn(
              'mx-auto flex h-[88px] w-[88px] items-center justify-center rounded-md border text-[9px]',
              t.line,
            )}
          >
            QR
          </div>
        )}
        {isStory && phase === 'live' && profilePublicCtaEnabled && onViewProfile && (
          <button
            type="button"
            onClick={onViewProfile}
            className={cn(
              'w-full rounded-md border border-white/40',
              'bg-gradient-to-r from-fuchsia-600/90 to-violet-700/90 px-1 py-1.5 text-[7px] font-black uppercase leading-tight text-white shadow-lg',
              'backdrop-blur-sm transition hover:brightness-110 active:scale-[0.99]',
            )}
          >
            View Full Profile
            <span className="mt-0.5 block text-[6px] font-semibold normal-case opacity-95">탭하여 상세 프로필</span>
          </button>
        )}
        {isStory && phase === 'live' && !profilePublicCtaEnabled && (
          <p className="px-0.5 text-center text-[6px] font-semibold leading-snug text-white/55">
            View Full Profile은 포인트 리워드에서「프로필 공개 권한」을 구매한 뒤 활성화돼요.
          </p>
        )}
      </div>
    </div>
  )

  const fakeStoryChrome =
    isStory && phase === 'live' ? (
      <div
        className="mt-0.5 flex shrink-0 items-center justify-between rounded-b-sm border-t border-white/10 bg-black/50 px-2 py-1 text-white/35"
        aria-hidden
      >
        <span className="text-[9px]">◇</span>
        <span className="text-[8px] font-bold tracking-widest">Instagram</span>
        <span className="text-[9px]">□</span>
      </div>
    ) : null

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col overflow-hidden rounded-sm p-4',
        'box-border select-none',
        t.shell,
        pixel && 'rounded-none',
        isStory && 'relative',
        activeNeonArchetype && storyNeonHostClass(activeNeonArchetype, storyNeonBoost),
      )}
      style={{ width: V_CARD_W, height: V_CARD_H }}
    >
      {activeNeonArchetype && (
        <StoryNeonLayers archetype={activeNeonArchetype} arcticSpark={storyArcticSpark} />
      )}
      {isStory && phase === 'live' && <StoryKeyframes />}
      <SwordClashOverlay open={swordsOpen} onFinish={finishSwordOverlay} />

      <div className="flex shrink-0 items-center justify-center gap-2">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg font-black',
            pixel ? 'bg-[#1a4d0a] text-[#c8ff7a] text-sm' : 'bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white text-sm',
          )}
        >
          V
        </span>
        <span className={cn('text-[15px] font-black tracking-tight', t.brand)}>VICTORYSPACE</span>
      </div>
      <p className={cn('mt-1 text-center text-[8px] font-bold uppercase tracking-[0.18em]', t.tag)}>
        Your choices create victory
      </p>

      <div className={cn('my-2 shrink-0 border-t', t.line)} />

      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full border-2 text-base font-black',
            pixel ? 'border-[#7cfc00] bg-[#143214]' : 'border-fuchsia-300/50 bg-gradient-to-br from-fuchsia-100 to-violet-100 text-fuchsia-900',
          )}
        >
          {nickname?.slice(0, 1) || '?'}
        </div>
        <p className={cn('text-[13px] font-black leading-tight', t.brand)}>{nickname || 'Victory User'}</p>
        <p className={cn('text-[10px] font-bold leading-tight', t.muted)}>
          RANK: <span className={cn('font-black', t.accent)}>{rankLabel}</span> / P:{' '}
          {Number(points || 0).toLocaleString('ko-KR')}
        </p>
      </div>

      <div className={cn('my-2 shrink-0 border-t', t.line)} />

      {isStory && phase === 'hook' ? storyHookBlock : metricsStack}

      {interactionStrip}

      {qrFooter}

      {fakeStoryChrome}
    </div>
  )
})
