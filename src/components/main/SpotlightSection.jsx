import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, Film, Play, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { safeMediaUrl } from '../../lib/sanitize'
import { VsBadge } from '../ui/VsBadge'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'
import { voteViaApi } from '../../lib/voteApi'
import { fetchSpotlightDemoMatchups } from '../../lib/mainSpotlight'
import { isSpotlightDemoMatchup } from '../../lib/spotlightDemo'
import { SpotlightVoteEffects } from './SpotlightVoteEffects'

/**
 * 좌·우 컬럼 상단 표시 이름
 * - 좌: 작성자 `profiles.nickname` 우선 (없을 때만 제목·라벨 등)
 * - 우: 오른쪽 제출자 `right_profiles.nickname` → `right_nickname` → 제목 "A vs B" → `right_label`
 */
function getSpotlightSideNicknames(m) {
  const isDemo = isSpotlightDemoMatchup(m)
  const author = String(m.profiles?.nickname || '').trim()
  const rightAuthor = String(m.right_profiles?.nickname || '').trim()
  const title = (m.title || '').trim()
  const parsed = title.match(/^(.+?)\s+vs\s+(.+?)(?:\s*[，,]|$)/iu)
  const fromTitleLeft = parsed ? (parsed[1] || '').trim() : ''
  const fromTitleRight = parsed ? (parsed[2] || '').trim() : ''

  const lnField = typeof m.left_nickname === 'string' ? m.left_nickname.trim() : ''
  const rnField = typeof m.right_nickname === 'string' ? m.right_nickname.trim() : ''

  const left = isDemo
    ? fromTitleLeft || lnField || m.left_label?.trim() || author || '—'
    : author || lnField || fromTitleLeft || m.left_label?.trim() || '—'
  const right = isDemo
    ? fromTitleRight || rnField || m.right_label?.trim() || rightAuthor || '—'
    : rightAuthor || rnField || fromTitleRight || m.right_label?.trim() || '—'

  return { left, right }
}

/** DB·PostgREST 응답에 맞춰 left/right만 인정 (대소문자·공백 허용) */
function normalizeSpotlightVoteSide(side) {
  const s = String(side ?? '').trim().toLowerCase()
  if (s === 'left' || s === 'right') return s
  return null
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}

/** 세션 동안 슬라이드별 잔여 시간(끝 시각) 고정 */
function useSpotlightEndTimes(slideIds) {
  const mapRef = useRef(new Map())

  useEffect(() => {
    const map = mapRef.current
    for (const id of slideIds) {
      if (!map.has(id)) {
        const mins = 38 + (id.length % 12)
        map.set(id, Date.now() + mins * 60 * 1000)
      }
    }
    for (const key of [...map.keys()]) {
      if (!slideIds.includes(key)) map.delete(key)
    }
  }, [slideIds])

  return mapRef
}

function SpotlightMedia({ side, matchup: m }) {
  const isLeft = side === 'left'
  const type = isLeft ? m.left_type : m.right_type
  const url = isLeft ? m.left_url : m.right_url
  const thumb = isLeft ? m.left_thumbnail_url : m.right_thumbnail_url
  const label = isLeft ? m.left_label : m.right_label
  const text = isLeft ? m.left_text : m.right_text

  const safeThumb = safeMediaUrl(thumb || '')
  const safeUrl = safeMediaUrl(url || '')

  if (type === 'text') {
    return (
      <div className="flex h-full min-h-[5.5rem] w-full items-center justify-center bg-gradient-to-br from-slate-900/40 to-slate-800/30 p-2">
        <p className="line-clamp-3 text-center text-[11px] font-semibold leading-snug text-white/90">
          {text || label || '—'}
        </p>
      </div>
    )
  }

  if (type === 'video') {
    if (safeThumb) {
      return <img src={safeThumb} alt="" className="h-full w-full min-h-0 object-cover" />
    }
    if (safeUrl) {
      return (
        <div className="relative h-full w-full min-h-0">
          <video src={safeUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Play size={18} className="ml-0.5 fill-white text-white" />
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-fuchsia-950/50 to-violet-950/40 text-white/80">
        <Film size={22} className="opacity-90" />
        <span className="text-[10px] font-bold">{label || '영상'}</span>
      </div>
    )
  }

  const src = safeMediaUrl(thumb || url || '')
  if (src) {
    return <img src={src} alt="" className="h-full w-full min-h-0 object-cover" />
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-800/50 text-[11px] font-semibold text-white/70">
      {label || (isLeft ? 'LEFT' : 'RIGHT')}
    </div>
  )
}

function mediaRibbonLabel(type) {
  if (type === 'video') return '영상'
  if (type === 'image') return '이미지'
  if (type === 'text') return '텍스트'
  return '콘텐츠'
}

/** 작성자(A)·도전자(B) — 스포트라이트 카드에서 본인 경쟁에는 투표 불가 */
function isSpotlightMatchupParticipant(matchup, userId) {
  if (!userId || !matchup) return false
  if (String(matchup.user_id || '') === String(userId)) return true
  if (matchup.right_user_id && String(matchup.right_user_id) === String(userId)) return true
  return false
}

function GoldenVBadge() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1.5 z-[3] -translate-x-1/2"
      aria-hidden
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-amber-100/95 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 shadow-[0_0_18px_rgba(251,191,36,0.95),0_0_36px_rgba(245,158,11,0.45)]">
        <span className="text-[15px] font-black leading-none text-amber-950 drop-shadow-sm">V</span>
      </div>
    </div>
  )
}

function SpotlightNeonGauges({ leftShow, rightShow, leftNick, rightNick, votedSide }) {
  const leftGold = votedSide === 'left'
  const rightGold = votedSide === 'right'
  return (
    <div
      className="space-y-2 rounded-xl border border-cyan-500/20 bg-black/40 px-3 py-2.5 shadow-inner ring-1 ring-emerald-500/15 backdrop-blur-[2px]"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-black tabular-nums">
        <span className={cn('min-w-0 truncate', leftGold ? 'text-amber-300' : 'text-slate-300')}>
          {leftNick} <span className="text-emerald-300">{leftShow}%</span>
        </span>
        <span className={cn('min-w-0 truncate text-right', rightGold ? 'text-amber-300' : 'text-slate-300')}>
          <span className="text-fuchsia-300">{rightShow}%</span> {rightNick}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-950/80 ring-1 ring-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_0_14px_rgba(45,212,191,0.55)] transition-[width] duration-100 ease-out"
          style={{ width: `${leftShow}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-violet-400 via-indigo-400 to-slate-600/90 shadow-[0_0_12px_rgba(167,139,250,0.35)] transition-[width] duration-100 ease-out"
          style={{ width: `${rightShow}%` }}
        />
      </div>
    </div>
  )
}

function SpotlightSlide({ matchup: m, remainingSec }) {
  const user = useAuthStore((s) => s.user)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const showToast = useUIStore((s) => s.showToast)
  /** loadVote 비동기 완료 시점의 최신 props(특히 viewer_vote_side) */
  const mRef = useRef(m)
  mRef.current = m
  const idStr = String(m.id ?? '')
  const isDemo = isSpotlightDemoMatchup(m)
  const voteTo = idStr ? `/matchup/${idStr}` : '/matchups'
  const { left: leftNick, right: rightNick } = getSpotlightSideNicknames(m)
  const isParticipant = !!user?.id && isSpotlightMatchupParticipant(m, user.id)

  const voteBtnRef = useRef(null)
  const [pickedSide, setPickedSide] = useState(null)
  /** idle: 선택 가능 · celebrating: 연출 중 · done: 투표 완료 잠금 · spectate: 참가자(본인 경쟁) 관전 */
  const [phase, setPhase] = useState('idle')
  const [submittedSide, setSubmittedSide] = useState(null)
  const [counts, setCounts] = useState({
    l: Number(m.left_votes || 0),
    r: Number(m.right_votes || 0),
    t: Number(m.total_votes || 0),
  })
  const [celebrationRect, setCelebrationRect] = useState(null)
  const [gaugeL, setGaugeL] = useState(0)
  const [gaugeR, setGaugeR] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = () => setReduceMotion(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    setCounts({
      l: Number(m.left_votes || 0),
      r: Number(m.right_votes || 0),
      t: Number(m.total_votes || 0),
    })
  }, [m.id, m.left_votes, m.right_votes, m.total_votes])

  useEffect(() => {
    let cancelled = false

    if (!m?.id) return

    if (!user?.id) {
      setPhase('idle')
      setPickedSide(null)
      setSubmittedSide(null)
      setCelebrationRect(null)
      return
    }

    if (isParticipant) {
      setPhase('spectate')
      setPickedSide(null)
      setSubmittedSide(null)
      setCelebrationRect(null)
      return
    }

    const matchupId = String(m.id)
    const userIdStr = String(user.id)
    /** 동시에 여러 loadVote가 돌면 늦게 끝난 빈 결과가 '투표 완료'를 덮어쓰지 않게 함 */
    let loadSeq = 0

    function applyVoteRows(rows) {
      if (cancelled) return
      const fromQuery = normalizeSpotlightVoteSide(rows?.[0]?.side)
      const fromEmbed = normalizeSpotlightVoteSide(mRef.current?.viewer_vote_side)
      const side = fromQuery || fromEmbed
      if (side) {
        setSubmittedSide(side)
        setPickedSide(side)
        setPhase('done')
      } else {
        setPhase('idle')
        setPickedSide(null)
        setSubmittedSide(null)
      }
    }

    async function loadVote() {
      const mySeq = ++loadSeq
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled || mySeq !== loadSeq) return
      const queryUserId = String(session?.user?.id ?? user.id ?? '')
      if (!queryUserId) return

      const runQuery = () =>
        supabase
          .from('votes')
          .select('side')
          .eq('matchup_id', matchupId)
          .eq('user_id', queryUserId)
          .limit(1)

      let { data: rows, error } = await runQuery()
      if (cancelled || mySeq !== loadSeq) return
      if (error) {
        if (import.meta.env.DEV) console.warn('[SpotlightSlide] loadVote:', error.message)
        await new Promise((r) => setTimeout(r, 400))
        if (cancelled || mySeq !== loadSeq) return
        const retry = await runQuery()
        rows = retry.data
        error = retry.error
        if (error) {
          if (import.meta.env.DEV) console.warn('[SpotlightSlide] loadVote retry:', error.message)
          return
        }
      }
      if (cancelled || mySeq !== loadSeq) return
      applyVoteRows(rows || [])
    }

    void loadVote()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void loadVote()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [m.id, isDemo, user?.id, isParticipant])

  /** 메인에서 `fetchActiveMainSpotlightMatchup(userId)`로 붙인 투표 — m.id 동일·user만 늦게 붙는 경우 loadVote effect가 다시 안 돌아도 잠금 반영 */
  useEffect(() => {
    if (isParticipant || !user?.id) return
    const embedded = normalizeSpotlightVoteSide(m.viewer_vote_side)
    if (!embedded) return
    setSubmittedSide(embedded)
    setPickedSide(embedded)
    setPhase('done')
  }, [m.id, m.viewer_vote_side, isDemo, isParticipant, user?.id])

  const totalPair = counts.l + counts.r
  const targetL = totalPair > 0 ? Math.round((100 * counts.l) / totalPair) : 50
  const targetR = totalPair > 0 ? 100 - targetL : 50

  useEffect(() => {
    if (phase === 'spectate') {
      setGaugeL(targetL)
      setGaugeR(targetR)
      return
    }
    if (phase !== 'done') {
      setGaugeL(0)
      setGaugeR(0)
      return
    }
    const duration = 900
    const start = performance.now()
    let cancelled = false
    let raf = 0
    const tick = (now) => {
      if (cancelled) return
      const t = Math.min(1, (now - start) / duration)
      const e = 1 - (1 - t) ** 3
      setGaugeL(Math.round(targetL * e))
      setGaugeR(Math.round(targetR * e))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [phase, targetL, targetR])

  const finishCelebration = useCallback(() => {
    setCelebrationRect(null)
    setPhase('done')
  }, [])

  const handlePickSide = (side) => {
    if (phase === 'done' || phase === 'celebrating' || phase === 'spectate' || submitting || !user) return
    setPickedSide(side)
  }

  const handleVoteClick = async () => {
    if (phase === 'done' || phase === 'celebrating' || phase === 'spectate') return
    if (!pickedSide) {
      showToast('왼쪽 또는 오른쪽 콘텐츠를 먼저 선택해 주세요', 'info')
      return
    }

    const rect = voteBtnRef.current?.getBoundingClientRect() ?? null

    if (!user) return

    setSubmitting(true)
    try {
      const result = await voteViaApi(String(m.id), pickedSide)
      if (result.error) {
        showToast(result.error, 'error')
        return
      }
      setCounts((c) => ({
        l: c.l + (pickedSide === 'left' ? 1 : 0),
        r: c.r + (pickedSide === 'right' ? 1 : 0),
        t: c.t + 1,
      }))
      setSubmittedSide(pickedSide)
      setCelebrationRect(rect)
      setPhase('celebrating')
      showToast(
        isDemo
          ? '데모 투표가 저장됐어요. 포인트·랭킹·알림에는 반영되지 않아요.'
          : '투표 완료! 매치업 종료 후 결과에 따라 포인트가 지급돼요',
        'success'
      )
      if (!isDemo) {
        window.dispatchEvent(new CustomEvent('vics:header:points-pulse'))
      }
      window.dispatchEvent(new CustomEvent('vics:spotlight-self-voted'))
      if (user?.id) void fetchProfile(user.id, { force: true })
    } finally {
      setSubmitting(false)
    }
  }

  const sidePickDisabled =
    phase === 'done' || phase === 'celebrating' || phase === 'spectate' || submitting || !user
  const showGauges = phase === 'done' || phase === 'spectate'
  const isCelebrating = phase === 'celebrating' && !!celebrationRect

  return (
    <div
      className={cn(
        'group/spot relative w-full shrink-0 basis-full overflow-hidden rounded-2xl border-2',
        'border-emerald-400/50 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950',
        'shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_0_36px_-6px_rgba(52,211,153,0.35),0_0_56px_-10px_rgba(139,92,246,0.32)]',
        isCelebrating &&
          'border-emerald-300/90 shadow-[0_0_0_2px_rgba(52,211,153,0.45),0_0_52px_-4px_rgba(52,211,153,0.5),0_0_72px_-8px_rgba(139,92,246,0.38)]',
      )}
    >
      <SpotlightVoteEffects
        active={isCelebrating}
        anchorRect={celebrationRect}
        reducedMotion={reduceMotion}
        onFinish={finishCelebration}
      />

      <div
        className={cn(
          'spotlight-particle-layer pointer-events-none absolute -inset-[18%] rounded-[inherit] bg-[radial-gradient(ellipse_at_25%_20%,rgba(52,211,153,0.18),transparent_42%),radial-gradient(ellipse_at_78%_75%,rgba(167,139,250,0.2),transparent_40%),radial-gradient(ellipse_at_50%_100%,rgba(34,211,238,0.12),transparent_55%)]',
          isCelebrating && 'opacity-100 saturate-125',
        )}
        aria-hidden
      />

      <div className="relative z-[1] flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              'spotlight-live-badge inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/25 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-100 shadow-sm',
              isCelebrating && 'border-amber-300/90 shadow-[0_0_22px_rgba(251,191,36,0.45)]',
            )}
          >
            <span className="text-base leading-none" aria-hidden>
              🔥
            </span>
            {isDemo ? '데모 · DB 저장 (포인트·랭킹 제외)' : 'LIVE SPOTLIGHT'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] font-black tabular-nums text-emerald-100/95 backdrop-blur-sm">
            <Clock size={13} className="shrink-0 text-emerald-300" aria-hidden />
            <span aria-hidden>⏳</span> {formatCountdown(remainingSec)}
          </span>
        </div>

        <h3 className="text-center text-base font-black leading-snug text-white drop-shadow-sm sm:text-lg">
          {m.title || `${m.left_label || ''} vs ${m.right_label || ''}`}
        </h3>

        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
          <button
            type="button"
            disabled={sidePickDisabled}
            onClick={() => handlePickSide('left')}
            className={cn(
              'relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-black/25 text-left shadow-inner transition-all',
              pickedSide === 'left' && phase === 'idle'
                ? 'border-emerald-400 ring-2 ring-emerald-400/75 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                : 'border-white/10 hover:border-white/25',
              phase === 'done' && submittedSide === 'left' && 'ring-2 ring-amber-400/50',
              sidePickDisabled && phase === 'celebrating' && 'cursor-default opacity-90',
            )}
          >
            {phase === 'done' && submittedSide === 'left' ? <GoldenVBadge /> : null}
            <p className="truncate border-b border-white/10 bg-black/40 px-2 py-1.5 text-center text-[11px] font-black tracking-tight text-white">
              {leftNick}
            </p>
            <div className="relative min-h-[6.5rem] flex-1 overflow-hidden transition-transform duration-300 group-hover/spot:scale-[1.02] sm:min-h-[7.5rem]">
              <SpotlightMedia side="left" matchup={m} />
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white/95 backdrop-blur-sm">
                <Film size={11} aria-hidden /> {mediaRibbonLabel(m.left_type)}
              </span>
            </div>
          </button>

          <div className="flex flex-col items-center justify-center gap-1 self-center py-1">
            <VsBadge
              size="lg"
              variant="story"
              className="transition-transform duration-500 ease-out group-hover/spot:rotate-180 group-hover/spot:scale-105"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">VS</span>
          </div>

          <button
            type="button"
            disabled={sidePickDisabled}
            onClick={() => handlePickSide('right')}
            className={cn(
              'relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-black/25 text-left shadow-inner transition-all',
              pickedSide === 'right' && phase === 'idle'
                ? 'border-emerald-400 ring-2 ring-emerald-400/75 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                : 'border-white/10 hover:border-white/25',
              phase === 'done' && submittedSide === 'right' && 'ring-2 ring-amber-400/50',
              sidePickDisabled && phase === 'celebrating' && 'cursor-default opacity-90',
            )}
          >
            {phase === 'done' && submittedSide === 'right' ? <GoldenVBadge /> : null}
            <p className="truncate border-b border-white/10 bg-black/40 px-2 py-1.5 text-center text-[11px] font-black tracking-tight text-white">
              {rightNick}
            </p>
            <div className="relative min-h-[6.5rem] flex-1 overflow-hidden transition-transform duration-300 group-hover/spot:scale-[1.02] sm:min-h-[7.5rem]">
              <SpotlightMedia side="right" matchup={m} />
              <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white/95 backdrop-blur-sm">
                <Film size={11} aria-hidden /> {mediaRibbonLabel(m.right_type)}
              </span>
            </div>
          </button>
        </div>

        {showGauges ? (
          <SpotlightNeonGauges
            leftShow={gaugeL}
            rightShow={gaugeR}
            leftNick={leftNick}
            rightNick={rightNick}
            votedSide={phase === 'spectate' ? null : submittedSide}
          />
        ) : null}

        <div className="flex flex-col gap-1.5">
          <button
            ref={voteBtnRef}
            type="button"
            title={
              phase === 'spectate'
                ? '작성자(A)와 도전자(B)는 이 경쟁에 투표할 수 없어요. 상세 페이지에서 공유·통계를 확인해 보세요.'
                : !user
                  ? '로그인 후 투표할 수 있어요'
                  : undefined
            }
            disabled={phase === 'done' || phase === 'celebrating' || submitting || phase === 'spectate' || !user}
            onClick={() => void handleVoteClick()}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-3.5 text-sm font-black shadow-lg transition',
              (phase === 'done' || phase === 'spectate') &&
                'cursor-not-allowed border-slate-600/80 bg-slate-800/90 text-slate-400 shadow-none ring-1 ring-white/5',
              phase === 'celebrating' &&
                'relative cursor-wait border-emerald-200/90 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-emerald-500/50 ring-2 ring-emerald-300/60',
              phase === 'idle' &&
                user &&
                'border-emerald-300/70 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-emerald-500/35 hover:brightness-110 hover:shadow-emerald-400/45 active:scale-[0.99]',
              phase === 'idle' &&
                !user &&
                'cursor-not-allowed border-white/15 bg-slate-800/85 text-slate-400 shadow-none ring-1 ring-white/10',
            )}
          >
            <span className="text-lg" aria-hidden>
              🗳️
            </span>
            {phase === 'spectate'
              ? '내 매치업 · 투표 불가'
              : phase === 'done'
                ? '변경 불가'
                : phase === 'celebrating'
                  ? '투표 완료!'
                  : submitting
                    ? '처리 중…'
                    : !user
                      ? `로그인 후 투표 (${counts.t.toLocaleString('ko-KR')}명 참여 중)`
                      : isDemo
                        ? `데모 투표하기 (${counts.t.toLocaleString('ko-KR')}명 참여 중)`
                        : `지금 바로 투표하기 (${counts.t.toLocaleString('ko-KR')}명 참여 중)`}
          </button>

          <div className="flex justify-center">
            <Link
              to={voteTo}
              className="inline-flex max-w-full text-[11px] font-bold text-emerald-200/85 underline-offset-2 hover:text-white hover:underline"
            >
              매치업 자세히 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 메인 홈 상단 스포트라이트 — 가로 캐러셀
 * @param {object|null} primaryMatchup — Point Reward '메인 스포트라이트 6h' 등으로 예약된 매치업 (`fetchActiveMainSpotlightMatchup`). 없으면 데모만
 */
export function SpotlightSection({ primaryMatchup = null }) {
  const user = useAuthStore((s) => s.user)
  const [demoMatchups, setDemoMatchups] = useState([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchSpotlightDemoMatchups(user?.id ?? null)
      if (!cancelled) setDemoMatchups(rows || [])
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    const on = () => {
      void (async () => {
        const rows = await fetchSpotlightDemoMatchups(user?.id ?? null)
        setDemoMatchups(rows || [])
      })()
    }
    window.addEventListener('vics:spotlight-self-voted', on)
    return () => window.removeEventListener('vics:spotlight-self-voted', on)
  }, [user?.id])

  const slides = useMemo(() => {
    const seen = new Set()
    const out = []
    if (primaryMatchup?.id) {
      out.push(primaryMatchup)
      seen.add(primaryMatchup.id)
    }
    for (const row of demoMatchups) {
      if (row?.id && !seen.has(row.id)) {
        seen.add(row.id)
        out.push(row)
      }
    }
    return out.slice(0, 4)
  }, [primaryMatchup, demoMatchups])

  const ids = useMemo(() => slides.map((s) => s.id), [slides])
  const endMapRef = useSpotlightEndTimes(ids)

  const [index, setIndex] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, slides.length - 1)))
  }, [slides.length])

  const nSlides = slides.length
  const canGoPrev = index > 0
  const canGoNext = index < nSlides - 1

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(nSlides - 1, i + 1))
  }, [nSlides])

  if (slides.length === 0) return null

  return (
    <section className="mb-10 animate-fade-in-soft" aria-labelledby="spotlight-heading">
      <div className="mb-4 text-center">
        <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.25em] text-violet-600/90">
          <Sparkles size={14} className="text-amber-500" />
          NOW IN THE SPOTLIGHT
        </p>
        <h2 id="spotlight-heading" className="text-lg font-black text-[#22282E] sm:text-xl">
          ✨ 스포트라이트
        </h2>
        <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-relaxed text-slate-600 sm:text-sm">
          현재 가장 뜨겁게 주목받고 있는 1VS1 경쟁
        </p>
        {!primaryMatchup?.id ? (
          <p className="mx-auto mt-2 max-w-lg rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] font-bold leading-snug text-amber-950/90">
            활성 메인 스포트라이트 예약이 없을 때도{' '}
            <span className="underline decoration-amber-600/80">아래 데모 매치업</span>으로 투표를 체험할 수
            있어요. 데모는 DB에 저장되지만 포인트·랭킹·작성자 알림에는 반영되지 않아요. 예약된 슬롯(LIVE 맨
            앞)만 포인트 정산이 적용돼요.
          </p>
        ) : null}
      </div>

      <div className="relative flex items-stretch gap-1 sm:gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="이전 스포트라이트"
          className={cn(
            'flex w-9 shrink-0 items-center justify-center self-center rounded-xl border border-slate-200/80 bg-slate-100/92 text-slate-700 shadow-sm transition sm:w-10',
            canGoPrev ? 'hover:bg-violet-50 hover:text-violet-800' : 'cursor-not-allowed opacity-35',
          )}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>

        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl">
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((m) => {
              void tick
              const end = endMapRef.current.get(m.id) ?? Date.now() + 45 * 60 * 1000
              const sec = Math.max(0, (end - Date.now()) / 1000)
              return (
                <div key={m.id} className="w-full shrink-0 basis-full px-0.5">
                  <SpotlightSlide matchup={m} remainingSec={sec} />
                </div>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="다음 스포트라이트"
          className={cn(
            'flex w-9 shrink-0 items-center justify-center self-center rounded-xl border border-slate-200/80 bg-slate-100/92 text-slate-700 shadow-sm transition sm:w-10',
            canGoNext ? 'hover:bg-violet-50 hover:text-violet-800' : 'cursor-not-allowed opacity-35',
          )}
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="스포트라이트 위치">
          {slides.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={index === i}
              aria-label={`${i + 1}번째`}
              onClick={() => setIndex(i)}
              className="p-2 -m-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-300',
                  index === i ? 'w-6 bg-gradient-to-r from-emerald-500 to-violet-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
