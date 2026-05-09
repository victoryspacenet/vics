import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Download,
  Home,
  Palette,
  RefreshCw,
  Share2,
  Sparkles,
} from 'lucide-react'
import { VCardStoryCanvas, V_CARD_H, V_CARD_W } from '../components/vcard/VCardStoryCanvas'
import { VCardCraftingOverlay } from '../components/vcard/VCardCraftingOverlay'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn, copyToClipboard } from '../lib/utils'
import { getTier } from '../lib/tiers'
import { fetchVcardClapStats, recordVcardClap, VCARD_CLAPS_UPDATED } from '../lib/vcardClaps'
import { isProfilePublicUnlockActive } from '../lib/profilePublicUnlock'
import { fetchMyNewMatchupsWaiting } from '../lib/matchupsNewWaiting'
import { Modal } from '../components/ui/Modal'
import { supabase } from '../lib/supabase'
import { VCARD_REPORT_COST, purchaseVcardReportRpc } from '../lib/victoryReportPurchase'
import { parseStoryNeonPreviewParam } from '../lib/storyNeonThemes'

const PREVIEW_SCALE = 0.72

const PERIODS = [
  { id: 'this-month', label: '이번 달' },
  { id: 'last-month', label: '지난 달' },
  { id: '90d', label: '최근 90일' },
  { id: 'all', label: '전체' },
]

const CARD_THEMES = [
  { id: 'classic', label: '클래식 화이트' },
  { id: 'dark-neon', label: '다크 네온' },
  { id: 'spotlight', label: '스포트라이트' },
  { id: 'pixel', label: '픽셀 아트' },
]

const METRIC_OPTIONS = [
  { key: 'overallWins', label: 'Overall Wins (승리 수)' },
  { key: 'creatorStreak', label: 'Creator Streak (생성 연승)' },
  { key: 'predictionAcc', label: 'Prediction Acc (예측 정확도)' },
  { key: 'totalVotesRec', label: 'Total Votes Rec (최다 투표)' },
]

const EMPTY_STATS = {
  wRate: 0,
  totalWins: 0,
  creations: 0,
  creationWins: 0,
  bestMatchup: '',
  votes: 0,
  votingAcc: 0,
  upsetMatchup: '',
}

const DEMO_STATS_BY_PERIOD = {
  'this-month': EMPTY_STATS,
  'last-month': EMPTY_STATS,
  '90d': EMPTY_STATS,
  all: EMPTY_STATS,
}

function demoStatsForPeriod(periodId) {
  return DEMO_STATS_BY_PERIOD[periodId] ?? DEMO_STATS_BY_PERIOD.all
}

function newVCardId() {
  return `VS${Math.floor(10000 + Math.random() * 89999)}PT`
}

function isUuidString(s) {
  if (!s || typeof s !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
}

function buildShareText(nickname) {
  return `축하합니다! ${nickname || 'Victory'}님의 V-Card가 스토리에 공유될 준비가 되었습니다. #VictorySpace #VCard`
}

export function VictoryReportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const storyNeonPreviewOverride = useMemo(
    () => parseStoryNeonPreviewParam(searchParams.get('storyNeon') ?? searchParams.get('neonPreview')),
    [searchParams],
  )
  const { user, profile, fetchProfile } = useAuthStore()
  const { openLoginModal, showToast } = useUIStore()
  const exportRef = useRef(null)

  const vCardOwnerId = useMemo(() => {
    const raw = searchParams.get('owner')
    if (raw && isUuidString(raw)) return raw.trim()
    return user?.id ?? null
  }, [searchParams, user?.id])

  /** 카드 주인이 아닌 방문(팬 또는 비로그인 + ?owner=) — 제작·결제 UI 숨김 */
  const viewerOwnsCard = Boolean(user?.id && vCardOwnerId && user.id === vCardOwnerId)
  const hideCraftAndPay = Boolean(vCardOwnerId && !viewerOwnsCard)
  /** 팬이 ?owner= 로 볼 때 카드 주인 프로필 (본인 리포트면 null → store profile 사용) */
  const [subjectProfile, setSubjectProfile] = useState(null)
  const [period, setPeriod] = useState('this-month')
  const [theme, setTheme] = useState('spotlight')
  const [metrics, setMetrics] = useState({
    overallWins: true,
    creatorStreak: true,
    predictionAcc: false,
    totalVotesRec: true,
  })
  const [vCardId, setVCardId] = useState(newVCardId)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [exporting, setExporting] = useState(false)
  /** 카드 초기화 직후 미리보기 영역 강조 */
  const [justReset, setJustReset] = useState(false)
  const [clapTotal, setClapTotal] = useState(0)
  const [clapHasClapped, setClapHasClapped] = useState(false)
  const [clapSubmitting, setClapSubmitting] = useState(false)
  const [newMatchupPickerOpen, setNewMatchupPickerOpen] = useState(false)
  const [newMatchupOptions, setNewMatchupOptions] = useState([])
  const [vcardFlow, setVcardFlow] = useState(/** @type {'editor' | 'crafting' | 'done'} */ ('editor'))
  const [craftAudioCtx, setCraftAudioCtx] = useState(/** @type {AudioContext | null} */ (null))
  const [payConfirmOpen, setPayConfirmOpen] = useState(false)
  const [paySubmitting, setPaySubmitting] = useState(false)

  const nickname = subjectProfile?.nickname ?? profile?.nickname ?? 'OOTD장인'
  /** 카드에 표시할 포인트(팬 뷰면 주인 프로필) */
  const points = subjectProfile != null ? Number(subjectProfile.points ?? 0) : Number(profile?.points ?? 0)
  /** 결제·포인트 부족 안내는 로그인한 사용자 기준 */
  const payerPoints = Number(profile?.points ?? 0)
  const demoStats = useMemo(() => demoStatsForPeriod(period), [period])

  /**
   * 티어 표기는 기간과 무관하게 `getTier`(Player·Star·Master·Vip·Goat)만 사용.
   * 프로필·랭크 정보가 없으면 기본 Player.
   */
  const tierProfileForCard = useMemo(
    () => (hideCraftAndPay ? subjectProfile ?? {} : profile ?? {}),
    [hideCraftAndPay, subjectProfile, profile],
  )

  const demoTierLabel = useMemo(() => {
    const t = getTier(tierProfileForCard, {})
    return `${t.emoji} ${t.name}`
  }, [tierProfileForCard])

  /** 스토리 네온 테두리(활동 기반) — 카드에 쓰는 티어·통계와 동기 */
  const storyNeonStats = useMemo(() => {
    const tier = getTier(tierProfileForCard, {})
    if (hideCraftAndPay) {
      return {
        matchupTierId: tier.id,
        totalMatchups: Number(tierProfileForCard.total_matchups ?? 0),
        voteTotal: Number(tierProfileForCard.vote_total ?? 0),
        voteHits: Number(tierProfileForCard.vote_hits ?? 0),
              creatorWins: Number(tierProfileForCard.creator_wins ?? 0),
      }
    }
    return {
      matchupTierId: tier.id,
      totalMatchups: Number(profile?.total_matchups ?? 0) || demoStats.creations,
      voteTotal: Number(profile?.vote_total ?? 0) || demoStats.votes,
      voteHits:
        Number(profile?.vote_hits ?? 0) ||
        Math.round((Number(demoStats.votes) * Number(demoStats.votingAcc || 0)) / 100),
      creatorWins: Number(profile?.creator_wins ?? 0) || demoStats.creationWins,
    }
  }, [hideCraftAndPay, tierProfileForCard, profile, demoStats])

  /** 제작 연출에 순서대로 각인되는 문구 */
  const craftEngraveLines = useMemo(() => {
    const lines = [nickname, `W-RATE ${demoStats.wRate}%`, demoTierLabel]
    if (metrics.overallWins) lines.push(`OVERALL WINS ${demoStats.totalWins}`)
    if (metrics.creatorStreak) lines.push(`CREATOR ${demoStats.creationWins}W`)
    if (metrics.predictionAcc) lines.push(`PRED ${demoStats.votingAcc}%`)
    if (metrics.totalVotesRec) lines.push(`VOTES ${demoStats.votes}`)
    return lines.slice(0, 5)
  }, [nickname, demoStats, metrics, demoTierLabel])

  const profileQrTarget = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    if (user?.id) return `${origin}/mypage`
    return `${origin}/rewards`
  }, [user?.id])

  useEffect(() => {
    if (!vCardOwnerId) {
      setSubjectProfile(null)
      return
    }
    if (user?.id === vCardOwnerId) {
      setSubjectProfile(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, points, total_matchups, vote_total, vote_hits, creator_wins')
        .eq('id', vCardOwnerId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setSubjectProfile({ id: vCardOwnerId, nickname: 'Victory', points: 0 })
        return
      }
      setSubjectProfile(data)
    })()
    return () => {
      cancelled = true
    }
  }, [vCardOwnerId, user?.id])

  useEffect(() => {
    let cancelled = false
    async function loadClaps() {
      if (!vCardOwnerId) {
        setClapTotal(0)
        setClapHasClapped(false)
        return
      }
      const { total, hasClapped, error } = await fetchVcardClapStats(vCardOwnerId)
      if (cancelled) return
      if (error) {
        setClapTotal(0)
        setClapHasClapped(false)
        return
      }
      setClapTotal(total)
      setClapHasClapped(hasClapped)
    }
    loadClaps()
    const onClapEvent = (e) => {
      if (e.detail?.ownerUserId === vCardOwnerId) loadClaps()
    }
    window.addEventListener(VCARD_CLAPS_UPDATED, onClapEvent)
    return () => {
      cancelled = true
      window.removeEventListener(VCARD_CLAPS_UPDATED, onClapEvent)
    }
  }, [vCardOwnerId])

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(profileQrTarget, { width: 220, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [profileQrTarget])

  useEffect(() => {
    if (!justReset) return
    const t = window.setTimeout(() => setJustReset(false), 900)
    return () => window.clearTimeout(t)
  }, [justReset])

  const metricCount = useMemo(() => Object.values(metrics).filter(Boolean).length, [metrics])

  const toggleMetric = (key) => {
    setMetrics((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      const n = Object.values(next).filter(Boolean).length
      if (n > 3) {
        showToast('강조 지표는 최대 3개까지 선택할 수 있어요.', 'error')
        return prev
      }
      if (n < 1) {
        showToast('최소 1개 이상 선택해 주세요.', 'error')
        return prev
      }
      return next
    })
  }

  const handleReset = () => {
    setPeriod('this-month')
    setTheme('spotlight')
    setMetrics({
      overallWins: true,
      creatorStreak: true,
      predictionAcc: false,
      totalVotesRec: true,
    })
    setVCardId(newVCardId())
    setJustReset(true)
    showToast('스타일·기간·지표·카드 ID를 처음 값으로 되돌렸어요. 이미 기본이었다면 ID만 바뀔 수 있어요.', 'success')
  }

  const handleStoryClap = useCallback(async () => {
    if (!user?.id) {
      openLoginModal()
      return false
    }
    if (!vCardOwnerId) {
      showToast('프로필을 불러온 뒤 다시 시도해 주세요.', 'error')
      return false
    }
    if (user.id === vCardOwnerId) {
      showToast('본인 V-Card에는 축하를 보낼 수 없어요. 다른 계정에서 열면 집계돼요.', 'info')
      return false
    }
    if (clapHasClapped) {
      showToast('이미 축하를 보낸 계정이에요.', 'info')
      return false
    }
    setClapSubmitting(true)
    try {
      const res = await recordVcardClap(vCardOwnerId)
      if (!res.ok) {
        if (res.reason === 'duplicate') {
          setClapHasClapped(true)
          const { total, hasClapped } = await fetchVcardClapStats(vCardOwnerId)
          setClapTotal(total)
          setClapHasClapped(hasClapped)
          showToast('이미 축하를 보낸 계정이에요.', 'info')
        } else if (res.reason === 'self') {
          showToast('본인 V-Card에는 축하를 보낼 수 없어요.', 'info')
        } else {
          showToast('축하 전송에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error')
        }
        return false
      }
      const { total, hasClapped } = await fetchVcardClapStats(vCardOwnerId)
      setClapTotal(total)
      setClapHasClapped(hasClapped)
      showToast('축하가 전해졌어요!', 'success')
      return true
    } finally {
      setClapSubmitting(false)
    }
  }, [
    user?.id,
    vCardOwnerId,
    clapHasClapped,
    openLoginModal,
    showToast,
  ])

  const showCheerPanel = Boolean(vCardOwnerId && !(user?.id && user.id === vCardOwnerId))

  const handleAfterClapConfetti = useCallback(() => {
    if (!showCheerPanel || !vCardOwnerId) return
    navigate(`/rewards/v-card/cheer?owner=${encodeURIComponent(vCardOwnerId)}`)
  }, [showCheerPanel, vCardOwnerId, navigate])

  const handleStoryChallenge = useCallback(() => {
    if (!user?.id) {
      openLoginModal()
      return
    }
    void (async () => {
      const { data, error } = await fetchMyNewMatchupsWaiting(user.id)
      if (error) {
        showToast('NEW 매치업 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', 'error')
        return
      }
      if (!data.length) {
        showToast('도전자를 기다리는 NEW 매치업이 없어요.', 'info')
        return
      }
      if (data.length === 1) {
        navigate(`/matchup/${data[0].id}`)
        return
      }
      setNewMatchupOptions(data)
      setNewMatchupPickerOpen(true)
    })()
  }, [user?.id, navigate, openLoginModal, showToast])

  const closeNewMatchupPicker = useCallback(() => {
    setNewMatchupPickerOpen(false)
    setNewMatchupOptions([])
  }, [])

  const handlePickNewMatchup = useCallback(
    (id) => {
      closeNewMatchupPicker()
      navigate(`/matchup/${id}`)
    },
    [navigate, closeNewMatchupPicker],
  )

  const handlePayButtonClick = useCallback(() => {
    if (!user) {
      openLoginModal()
      return
    }
    if (payerPoints < VCARD_REPORT_COST) {
      showToast(`포인트가 부족해요 (${VCARD_REPORT_COST.toLocaleString('ko-KR')} P 필요)`, 'error')
      return
    }
    setPayConfirmOpen(true)
  }, [user, payerPoints, openLoginModal, showToast])

  const closePayConfirm = useCallback(() => {
    if (paySubmitting) return
    setPayConfirmOpen(false)
  }, [paySubmitting])

  const handleConfirmPayAndCraft = useCallback(async () => {
    if (!user?.id) {
      openLoginModal()
      return
    }
    setPaySubmitting(true)
    try {
      const res = await purchaseVcardReportRpc()
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      setPayConfirmOpen(false)
      await fetchProfile(user.id)
      showToast(
        `${(res.pointsSpent ?? VCARD_REPORT_COST).toLocaleString('ko-KR')} P가 차감됐어요. 제작 연출을 시작해요!`,
        'success',
      )
      let ctx = null
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (AC) {
          ctx = new AC()
          if (ctx.state === 'suspended') void ctx.resume()
        }
      } catch {
        /* no audio */
      }
      setCraftAudioCtx(ctx)
      setVcardFlow('crafting')
    } finally {
      setPaySubmitting(false)
    }
  }, [user?.id, openLoginModal, showToast, fetchProfile])

  const pointsInsufficient = payerPoints < VCARD_REPORT_COST

  const handleCraftComplete = useCallback(() => {
    setCraftAudioCtx((ctx) => {
      try {
        ctx?.close?.()
      } catch {
        /* noop */
      }
      return null
    })
    setVcardFlow('done')
  }, [])

  const handleInstaShare = useCallback(async () => {
    if (!user) {
      openLoginModal()
      return
    }
    if (!exportRef.current) {
      showToast('카드를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.', 'error')
      return
    }
    setExporting(true)
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        skipFonts: true,
      })
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `VictorySpace-VCard-${vCardId}.png`, { type: 'image/png' })
      const text = buildShareText(nickname)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'VictorySpace V-Card', text })
        showToast('공유 시트가 열렸어요. 인스타 스토리에서 음악·필터를 골라 올려 보세요!', 'success')
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `VictorySpace-VCard-${vCardId}.png`
        a.click()
        await copyToClipboard(text)
        showToast('이미지를 저장했어요. 인스타 스토리에서 갤러리 사진을 선택해 올리면 돼요.', 'info')
      }
    } catch (e) {
      console.error(e)
      showToast('공유를 완료하지 못했어요. 이미지 저장 후 인스타에서 직접 올려 주세요.', 'error')
    } finally {
      setExporting(false)
    }
  }, [user, openLoginModal, vCardId, nickname, showToast])

  const handleGalleryEmbed = useCallback(() => {
    showToast(
      '갤러리 자동 박제는 랭킹 카드 저장 플로우와 맞춰 둘 예정이에요. 갤러리로 이동해 보관함을 확인해 보세요.',
      'info',
    )
    navigate('/mypage/ranking-gallery')
  }, [navigate, showToast])

  const handleDownload = useCallback(async () => {
    if (!user) {
      openLoginModal()
      return
    }
    if (!exportRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        skipFonts: true,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `VictorySpace-VCard-${vCardId}.png`
      a.click()
      const share = buildShareText(nickname)
      await copyToClipboard(share)
      showToast(
        '1080×1920 이미지가 저장됐어요. 공유 문구가 클립보드에 복사됐어요.',
        'success',
      )
    } catch (e) {
      console.error(e)
      showToast('이미지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error')
    } finally {
      setExporting(false)
    }
  }, [user, openLoginModal, vCardId, nickname, showToast])

  return (
    <div className="min-h-[70vh] pb-12">
      {vcardFlow === 'crafting' && (
        <VCardCraftingOverlay
          open
          audioCtx={craftAudioCtx}
          nickname={nickname}
          engraveLines={craftEngraveLines}
          onComplete={handleCraftComplete}
        />
      )}
      <div className="mx-auto max-w-screen-lg px-0 pt-2 sm:px-1">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/rewards'))}
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-fuchsia-700 hover:text-fuchsia-900"
        >
          <ArrowLeft size={18} />
          포인트 리워드로
        </button>

        <header className="mb-6 rounded-2xl border border-pink-100/70 bg-white/90 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md">
                <BarChart3 size={24} strokeWidth={2.4} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">
                  📈 V-Report: 당신의 승리를 증명하세요
                </h1>
                <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-fuchsia-900/70">
                  {hideCraftAndPay
                    ? '축하하기를 누르면 폭죽 연출 후 응원 한마디를 남기는 페이지로 이동해요.'
                    : '포인트를 사용하여 완벽한 성적표를 소셜에 공유해 보세요.'}
                </p>
                {hideCraftAndPay ? (
                  <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2 text-xs font-bold text-sky-900">
                    <span className="font-black text-sky-950">{nickname}</span>
                    님의 리포트를 보고 있어요.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
              <CalendarDays className="h-5 w-5 text-violet-500" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                disabled={hideCraftAndPay}
                className="rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm font-black text-violet-950 outline-none focus:ring-2 focus:ring-violet-400/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {vcardFlow === 'done' ? (
          <section className="mx-auto w-full max-w-md rounded-2xl border-2 border-emerald-300/70 bg-gradient-to-b from-emerald-50/95 via-white to-fuchsia-50/35 p-5 shadow-[0_8px_40px_-12px_rgba(16,185,129,0.35)] sm:p-7">
            <p className="border-b border-emerald-200/60 pb-4 text-center text-base font-black leading-snug text-emerald-950 sm:text-lg">
              V-Card가 성공적으로 제작되었습니다!
            </p>
            <div className="mt-5 flex justify-center rounded-xl bg-slate-900/[0.06] p-3 ring-1 ring-slate-200/80">
              <div
                className="relative overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10"
                style={{ width: V_CARD_W * 0.78, height: V_CARD_H * 0.78 }}
              >
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{ transform: 'scale(0.78)', width: V_CARD_W, height: V_CARD_H }}
                >
                  <VCardStoryCanvas
                    experienceMode="static"
                    theme={theme}
                    nickname={nickname}
                    points={points}
                    rankLabel={demoTierLabel}
                    wRate={demoStats.wRate}
                    totalWins={demoStats.totalWins}
                    creations={demoStats.creations}
                    creationWins={demoStats.creationWins}
                    bestMatchup={demoStats.bestMatchup}
                    votes={demoStats.votes}
                    votingAcc={demoStats.votingAcc}
                    upsetMatchup={demoStats.upsetMatchup}
                    vCardId={vCardId}
                    qrDataUrl={qrDataUrl}
                    metrics={metrics}
                    storyNeonPreviewOverride={storyNeonPreviewOverride}
                  />
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] font-bold text-slate-500">V-Card ID: {vCardId}</p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={exporting}
                onClick={() => void handleDownload()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-violet-300/80 bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-black text-white shadow-md transition hover:brightness-105 disabled:opacity-50"
              >
                <Download size={18} />
                📸 이미지로 저장
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={() => void handleInstaShare()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-pink-400/70 bg-gradient-to-r from-pink-500 to-orange-500 py-3.5 text-sm font-black text-white shadow-md transition hover:brightness-105 disabled:opacity-50"
              >
                <Share2 size={18} />
                🤳 인스타 스토리로 공유
              </button>
            </div>
            <button
              type="button"
              onClick={handleGalleryEmbed}
              className="mt-2 w-full rounded-2xl border-2 border-sky-300/80 bg-sky-50 py-3.5 text-sm font-black text-sky-950 transition hover:bg-sky-100"
            >
              🖼️ 내 프로필 갤러리에 박제하기
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Home size={18} className="text-fuchsia-600" />
              메인으로 돌아가기
            </button>
            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
              인스타 스토리 공유 시 앱에서 배경음악·VictorySpace 전용 필터를 더하면 바이럴에 도움이 돼요. (앱 기능·정책에 따름)
            </p>
          </section>
        ) : (
          <>
        <div className={cn('grid gap-6', hideCraftAndPay ? 'lg:mx-auto lg:max-w-xl' : 'lg:grid-cols-2 lg:gap-8')}>
          {/* 미리보기 */}
          <section className="rounded-2xl border border-pink-100/70 bg-white/95 p-4 shadow-sm sm:p-5">
            <h2 className="mb-1 flex flex-wrap items-center gap-2 text-sm font-black text-fuchsia-950 sm:text-base">
              <Sparkles className="h-5 w-5 text-amber-500" />
              V-Card 그래픽 미리보기
              <span className="text-xs font-bold text-fuchsia-500/80">(실시간 적용)</span>
            </h2>
            {storyNeonPreviewOverride ? (
              <p className="mb-2 rounded-lg border border-amber-200/90 bg-amber-50/95 px-3 py-2 text-[11px] font-bold leading-snug text-amber-950">
                URL 파라미터로 스토리 네온 연출 중: <span className="font-black">{storyNeonPreviewOverride}</span>
                <span className="mt-1 block font-semibold text-amber-900/85">
                  정적 미리보기·제작 완료 썸네일·PNG 캡처용 DOM에도 동일하게 적용됩니다. 끄려면 주소에서{' '}
                  <code className="rounded bg-white/80 px-1">storyNeon</code> / <code className="rounded bg-white/80 px-1">neonPreview</code>를
                  제거하세요.
                </span>
              </p>
            ) : null}
            <p className="mb-3 text-xs font-bold text-slate-500">
              {PERIODS.find((p) => p.id === period)?.label}
            </p>
            <div
              className={cn(
                'flex justify-center overflow-auto rounded-xl bg-slate-100/90 p-4 transition-shadow duration-300',
                justReset && 'ring-4 ring-amber-400/75 ring-offset-2 ring-offset-white',
              )}
            >
              <div
                className="relative shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5"
                style={{
                  width: V_CARD_W * PREVIEW_SCALE,
                  height: V_CARD_H * PREVIEW_SCALE,
                }}
              >
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{
                    transform: `scale(${PREVIEW_SCALE})`,
                    width: V_CARD_W,
                    height: V_CARD_H,
                  }}
                >
                  <VCardStoryCanvas
                    key={period}
                    experienceMode="story"
                    theme={theme}
                    nickname={nickname}
                    points={points}
                    rankLabel={demoTierLabel}
                    wRate={demoStats.wRate}
                    totalWins={demoStats.totalWins}
                    creations={demoStats.creations}
                    creationWins={demoStats.creationWins}
                    bestMatchup={demoStats.bestMatchup}
                    votes={demoStats.votes}
                    votingAcc={demoStats.votingAcc}
                    upsetMatchup={demoStats.upsetMatchup}
                    vCardId={vCardId}
                    qrDataUrl={qrDataUrl}
                    metrics={metrics}
                    storyNeonStats={storyNeonStats}
                    storyNeonPreviewOverride={storyNeonPreviewOverride}
                    onClap={handleStoryClap}
                    onAfterClapConfetti={showCheerPanel ? handleAfterClapConfetti : undefined}
                    clapCount={clapTotal}
                    clapHasClapped={clapHasClapped}
                    clapSubmitting={clapSubmitting}
                    clapDisabledForOwner={Boolean(user?.id && vCardOwnerId && user.id === vCardOwnerId)}
                    challengeDisabledForCardOwner={Boolean(
                      user?.id && vCardOwnerId && user.id === vCardOwnerId,
                    )}
                    onChallenge={handleStoryChallenge}
                    profilePublicCtaEnabled={isProfilePublicUnlockActive(profile)}
                    onViewProfile={() => {
                      if (user?.id) navigate('/mypage')
                      else openLoginModal()
                    }}
                  />
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] font-bold text-slate-500">V-Card ID: {vCardId}</p>
          </section>

          {/* 커스텀 */}
          {!hideCraftAndPay ? (
          <section className="space-y-5 rounded-2xl border border-pink-100/70 bg-white/95 p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-fuchsia-950 sm:text-base">
              <Palette className="h-5 w-5 text-violet-500" />
              템플릿 커스텀
            </h2>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-violet-600">카드 스타일 선택</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CARD_THEMES.map((opt) => (
                  <label
                    key={opt.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors',
                      theme === opt.id
                        ? 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-300/60'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-violet-200',
                    )}
                  >
                    <input
                      type="radio"
                      name="vcard-theme"
                      checked={theme === opt.id}
                      onChange={() => setTheme(opt.id)}
                      className="accent-amber-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-pink-100 bg-gradient-to-br from-fuchsia-50/50 to-white p-4">
              <p className="text-xs font-black text-fuchsia-800">프로필</p>
              <p className="mt-1 text-lg font-black text-fuchsia-950">{nickname}</p>
              <p className="mt-1 text-sm font-bold text-fuchsia-800/80">
                RANK: <span className="text-violet-700">{demoTierLabel}</span>
              </p>
              <p className="mt-2 text-xs font-semibold text-fuchsia-700/70">
                W-RATE <span className="font-black text-fuchsia-900">{demoStats.wRate}%</span> · Overall Wins:{' '}
                {demoStats.totalWins}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-black text-violet-700">강조할 지표 (최대 3개) · {metricCount}/3</p>
              <ul className="space-y-2">
                {METRIC_OPTIONS.map(({ key, label }) => (
                  <li key={key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={metrics[key]}
                        onChange={() => toggleMetric(key)}
                        className="h-4 w-4 accent-violet-600"
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[280px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                    <th className="px-2 py-2">모듈</th>
                    <th className="px-2 py-2">핵심</th>
                    <th className="px-2 py-2">하이라이트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr>
                    <td className="px-2 py-2 font-black text-emerald-800">Creator</td>
                    <td className="px-2 py-2">Wins {demoStats.creationWins}</td>
                    <td className="px-2 py-2 text-[11px]">Best: {demoStats.bestMatchup}</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-2 font-black text-sky-800">Prophet</td>
                    <td className="px-2 py-2">Acc {demoStats.votingAcc}%</td>
                    <td className="px-2 py-2 text-[11px]">Upset: {demoStats.upsetMatchup}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleReset}
                title="스타일·기간(이번 달)·강조 지표·V-Card ID를 처음 상태로 되돌립니다."
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 sm:w-auto sm:px-6"
              >
                <RefreshCw size={16} />
                카드 초기화
              </button>
              <p className="text-[11px] leading-relaxed text-slate-500">
                템플릿 스타일, 상단 기간, 체크한 지표, 카드 ID를{' '}
                <strong className="text-slate-700">처음 들어왔을 때와 같은 값</strong>으로 맞춥니다. 이미 그 상태면
                주로 <strong className="text-slate-700">V-Card ID</strong>만 새로 바뀝니다.
              </p>
            </div>
          </section>
          ) : null}
        </div>

        {!hideCraftAndPay ? (
          <>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 border-t border-pink-100/80 pt-6 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => navigate('/rewards')}
                className={cn(
                  'group relative isolate order-2 inline-flex min-w-[200px] items-stretch justify-center rounded-3xl p-[2.5px] sm:order-1',
                  'bg-gradient-to-r from-slate-500 via-fuchsia-500 to-sky-500 shadow-[0_10px_36px_-12px_rgba(100,116,139,0.45)]',
                  'transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_14px_44px_-10px_rgba(192,132,252,0.35)] active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2',
                )}
              >
                <span
                  className={cn(
                    'relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[1.35rem]',
                    'bg-gradient-to-br from-white/98 via-slate-50/95 to-fuchsia-50/70 px-7 py-3.5 backdrop-blur-md',
                    'ring-1 ring-white/85',
                  )}
                >
                  <span
                    className="pointer-events-none absolute -left-4 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-sky-300/25 to-fuchsia-300/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-fuchsia-500/[0.06] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden
                  />
                  <ArrowLeft
                    size={18}
                    strokeWidth={2.6}
                    className="relative shrink-0 text-fuchsia-600 transition-transform duration-300 group-hover:-translate-x-1 group-hover:text-fuchsia-700"
                    aria-hidden
                  />
                  <span className="relative bg-gradient-to-r from-slate-800 via-fuchsia-700 to-sky-700 bg-clip-text text-sm font-black tracking-tight text-transparent sm:text-[15px]">
                    취소
                  </span>
                  <Sparkles
                    size={15}
                    className="relative shrink-0 text-sky-500 drop-shadow-[0_0_6px_rgba(14,165,233,0.45)] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
                    aria-hidden
                  />
                </span>
              </button>
              <button
                type="button"
                disabled={
                  exporting || vcardFlow === 'crafting' || paySubmitting || (!!user && pointsInsufficient)
                }
                onClick={handlePayButtonClick}
                className={cn(
                  'order-1 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white shadow-lg transition sm:order-2 sm:min-w-[280px]',
                  'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:brightness-110 disabled:opacity-60',
                )}
              >
                <Sparkles size={18} />
                {paySubmitting ? '처리 중…' : `${VCARD_REPORT_COST.toLocaleString('ko-KR')} P 결제하고 제작하기`}
              </button>
            </div>
            <p className="mt-2 text-center text-xs font-bold text-amber-800/90">
              포인트 소진: {VCARD_REPORT_COST.toLocaleString('ko-KR')} P (제작 확인 시 즉시 차감)
            </p>
          </>
        ) : null}

        <p className="mt-8 text-center text-[11px] text-slate-500">
          최종 PNG는 인스타그램 스토리 비율 <strong>1080×1920</strong>입니다.{' '}
          <Link to="/rewards" className="font-bold text-fuchsia-700 underline-offset-2 hover:underline">
            포인트 리워드 센터
          </Link>
        </p>
          </>
        )}

        {/* 스케일 없이 캡처 전용 (1080×1920) — 완료 화면에서도 DOM에 유지 */}
        <div
          className="pointer-events-none fixed left-[-9999px] top-0 z-0"
          style={{ width: V_CARD_W, height: V_CARD_H }}
          aria-hidden
        >
          <VCardStoryCanvas
            key={`export-${period}-${vCardId}`}
            ref={exportRef}
            experienceMode="static"
            theme={theme}
            nickname={nickname}
            points={points}
            rankLabel={demoTierLabel}
            wRate={demoStats.wRate}
            totalWins={demoStats.totalWins}
            creations={demoStats.creations}
            creationWins={demoStats.creationWins}
            bestMatchup={demoStats.bestMatchup}
            votes={demoStats.votes}
            votingAcc={demoStats.votingAcc}
            upsetMatchup={demoStats.upsetMatchup}
            vCardId={vCardId}
            qrDataUrl={qrDataUrl}
            metrics={metrics}
            storyNeonPreviewOverride={storyNeonPreviewOverride}
          />
        </div>
      </div>

      <Modal
        isOpen={payConfirmOpen}
        onClose={closePayConfirm}
        title="결제 전 확인"
        rootClassName="z-[100040]"
        titleClassName="text-amber-950"
        headerClassName="border-amber-100 bg-amber-50/80"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 p-3.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold text-amber-950">
              <p>
                V-Card 제작 시 <strong className="font-black">{VCARD_REPORT_COST.toLocaleString('ko-KR')} P</strong>가
                즉시 차감됩니다.
              </p>
              <p className="text-xs font-medium leading-relaxed text-amber-900/85">
                제작을 시작하면 약 3초간 제작 연출이 재생된 뒤 완료 화면으로 이동합니다. 지금 선택한 템플릿·강조 지표가
                그대로 반영돼요.
              </p>
            </div>
          </div>
          {pointsInsufficient && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
              보유 포인트가 {payerPoints.toLocaleString('ko-KR')} P로 부족해요. {VCARD_REPORT_COST.toLocaleString('ko-KR')} P
              이상 모은 뒤 다시 시도해 주세요.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closePayConfirm}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 sm:min-w-[100px]"
            >
              취소
            </button>
            <button
              type="button"
              disabled={pointsInsufficient || paySubmitting}
              onClick={() => void handleConfirmPayAndCraft()}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-md transition sm:min-w-[200px]',
                'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:brightness-110',
                (pointsInsufficient || paySubmitting) && 'cursor-not-allowed opacity-50 hover:brightness-100',
              )}
            >
              <Sparkles size={16} />
              {paySubmitting ? '처리 중…' : '결제하고 제작하기'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={newMatchupPickerOpen}
        onClose={closeNewMatchupPicker}
        title="도전자 대기 중인 NEW 매치업"
        rootClassName="z-[100002]"
      >
        <p className="mb-4 text-sm font-medium text-slate-600">
          이동할 매치업을 선택해 주세요. (오른쪽 콘텐츠를 아직 받지 않은 매치업만 보여요)
        </p>
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {newMatchupOptions.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => handlePickNewMatchup(m.id)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-fuchsia-300 hover:bg-fuchsia-50/60"
              >
                <span className="line-clamp-2 text-sm font-black text-slate-900">{m.title || '(제목 없음)'}</span>
                <span className="mt-1 block text-[11px] font-semibold text-slate-500">
                  {m.category ? `${m.category} · ` : ''}
                  {m.created_at
                    ? new Date(m.created_at).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
