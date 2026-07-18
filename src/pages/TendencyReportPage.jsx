import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Loader2,
  Share2,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { resolvePublicShareUrl } from '../lib/socialShare'
import {
  ackTendencyReport,
  buildTendencyReportForUser,
  fetchTendencyReportStatus,
  TENDENCY_REPORT_VOTE_THRESHOLD,
  TENDENCY_TYPES,
} from '../lib/tendencyReport'
import { stripReportMarkdown, normalizeCategoryBreakdown } from '../lib/tendencyReportAnalysis'
import {
  buildDemoTendencyReport,
  parseDemoTendencyParam,
  DEMO_TENDENCY_LABELS,
} from '../lib/tendencyReportDemo'
import {
  fetchSharedTendencyReport,
  getTendencyReportSharePageUrl,
  getTendencyReportLandingUrl,
  publishTendencyReportShare,
  readTendencyShareToken,
  buildTendencyShareMiddleLine,
  extractTendencyShareId,
  getTendencyReportOgImageUrl,
} from '../lib/tendencyReportShare'
import { TendencyReportShareSheet } from '../components/tendency/TendencyReportShareSheet'

const PAGE_BG = 'min-h-screen bg-gradient-to-br from-[#0f0c1d] via-[#1a1035] to-[#0f172a]'
/** 모바일은 가득, 웹(lg+)은 중앙 카드형 폭 */
const TENDENCY_REPORT_CONTENT_WIDTH = 'mx-auto w-full min-w-0 max-w-lg lg:max-w-xl'

function StatBar({ label, value, colorClass }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-violet-200/70">{label}</span>
        <span className="font-black tabular-nums text-white">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn('h-full rounded-full transition-all duration-700', colorClass)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

export function TendencyReportPage() {
  const navigate = useNavigate()
  const { shareId: shareIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const shareToken = useMemo(
    () => readTendencyShareToken({ shareIdParam, searchParams }),
    [shareIdParam, searchParams],
  )
  const isDevDemo = import.meta.env.DEV && searchParams.get('demo') === '1'
  const demoKind = searchParams.get('type') || 'trendsetter'
  const demoNicknameParam = searchParams.get('nickname')
  const { user, profile } = useAuthStore()
  const { openLoginModal, showToast } = useUIStore()

  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const [voteCount, setVoteCount] = useState(0)
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [sharePreviewUrl, setSharePreviewUrl] = useState('')
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [error, setError] = useState(null)

  const isSharedView = Boolean(shareToken)

  useEffect(() => {
    const legacyShare = searchParams.get('share')?.trim()
    if (legacyShare && !shareIdParam) {
      navigate(`/report/tendency/s/${encodeURIComponent(legacyShare)}`, { replace: true })
    }
  }, [navigate, searchParams, shareIdParam])

  const meta = useMemo(
    () => (report ? TENDENCY_TYPES[report.tendencyType] : null),
    [report],
  )

  const displayCategoryBreakdown = useMemo(
    () => normalizeCategoryBreakdown(report?.categoryBreakdown, report?.voteCount),
    [report?.categoryBreakdown, report?.voteCount],
  )

  useEffect(() => {
    if (shareToken) {
      let cancelled = false
      setLoading(true)
      setError(null)
      void fetchSharedTendencyReport(shareToken).then((res) => {
        if (cancelled) return
        if (!res.ok || !res.report) {
          setReport(null)
          setError(res.error || '공유된 리포트를 찾을 수 없어요')
        } else {
          setReport(res.report)
          setVoteCount(res.report.voteCount || TENDENCY_REPORT_VOTE_THRESHOLD)
          setAcknowledged(true)
        }
        setLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    if (isDevDemo) {
      if (demoKind === 'progress') {
        setVoteCount(8)
        setAcknowledged(false)
        setReport(null)
        setError(`아직 ${TENDENCY_REPORT_VOTE_THRESHOLD}회 투표에 도달하지 않았어요 (8/${TENDENCY_REPORT_VOTE_THRESHOLD})`)
        setLoading(false)
        return
      }

      const demoType = parseDemoTendencyParam(demoKind)
      const nick = demoNicknameParam || profile?.nickname || '미리보기'
      setVoteCount(10)
      setAcknowledged(false)
      setError(null)
      setReport(buildDemoTendencyReport(demoType, nick))
      setLoading(false)
      return
    }

    if (!user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const status = await fetchTendencyReportStatus()
        if (cancelled) return

        setVoteCount(status.voteCount)
        setAcknowledged(status.acknowledged)

        if (status.voteCount < TENDENCY_REPORT_VOTE_THRESHOLD) {
          setReport(null)
          setError(`아직 ${TENDENCY_REPORT_VOTE_THRESHOLD}회 투표에 도달하지 않았어요 (${status.voteCount}/${TENDENCY_REPORT_VOTE_THRESHOLD})`)
          return
        }

        if (status.acknowledged && status.snapshot) {
          setReport(status.snapshot)
          return
        }

        const { report: built, error: buildErr } = await buildTendencyReportForUser(
          user.id,
          profile?.nickname,
        )
        if (cancelled) return
        if (buildErr) {
          setError(buildErr)
          return
        }
        setReport(built)
      } catch {
        if (!cancelled) setError('리포트를 불러오지 못했어요')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id, profile?.nickname, isDevDemo, demoKind, demoNicknameParam, shareToken])

  const handleConfirm = useCallback(async () => {
    if (!report || saving) return
    if (isDevDemo) {
      showToast('미리보기 모드 — 저장하지 않았어요', 'info')
      navigate('/dev/tendency-report')
      return
    }
    if (acknowledged) {
      navigate('/mypage')
      return
    }
    setSaving(true)
    try {
      const res = await ackTendencyReport(report)
      if (!res.ok) {
        showToast(res.error || '저장에 실패했어요', 'error')
        return
      }
      setAcknowledged(true)
      showToast('성향 리포트가 저장됐어요 ✓', 'success')
      navigate('/mypage')
    } finally {
      setSaving(false)
    }
  }, [acknowledged, isDevDemo, navigate, report, saving, showToast])

  const shareUrl = useMemo(
    () => (sharePreviewUrl || (shareToken ? getTendencyReportSharePageUrl(shareToken) : '')),
    [sharePreviewUrl, shareToken],
  )
  const shareOgDescription = useMemo(() => {
    if (report) return 'VictorySpace · 투표 성향 리포트'
    if (isSharedView) return 'VictorySpace · 투표 성향 리포트'
    return '10회 투표 후 열리는 나만의 Vics 투표 성향 리포트'
  }, [report, isSharedView])

  const shareOgTitle = useMemo(() => {
    if (report) return buildTendencyShareMiddleLine(report)
    return 'VictorySpace 성향 리포트'
  }, [report])

  const shareOgImage = useMemo(() => {
    const url = shareUrl || sharePreviewUrl
    const sid = extractTendencyShareId(url)
    const line = report ? buildTendencyShareMiddleLine(report) : ''
    return getTendencyReportOgImageUrl({ shareId: sid, middleLine: line, shareUrl: url })
  }, [report, shareUrl, sharePreviewUrl])

  const handleShare = useCallback(async () => {
    if (!report || sharing) return
    setSharing(true)
    try {
      let publicUrl = sharePreviewUrl

      if (!publicUrl) {
        if (isDevDemo) {
          const demoParams = new URLSearchParams({
            demo: '1',
            type: report.tendencyType || 'unique',
          })
          if (report.nickname) demoParams.set('nickname', report.nickname)
          publicUrl = resolvePublicShareUrl(
            `${window.location.origin}/report/tendency?${demoParams.toString()}`,
          )
        } else {
          const pub = await publishTendencyReportShare(report)
          if (!pub.ok) {
            showToast(pub.error || '공유 링크를 만들지 못했어요', 'error')
            return
          }
          publicUrl = pub.shareUrl
          setSharePreviewUrl(publicUrl)
        }
      }

      flushSync(() => {
        setSharePreviewUrl(publicUrl)
      })

      setShareSheetOpen(true)
    } catch {
      showToast('공유에 실패했어요', 'error')
    } finally {
      setSharing(false)
    }
  }, [isDevDemo, report, sharePreviewUrl, sharing, showToast])

  if (!user && !isDevDemo && !isSharedView) {
    return (
      <div className={cn(PAGE_BG, '-mx-4 px-4 flex flex-col items-center justify-center py-20 text-center')}>
        <div className={cn(TENDENCY_REPORT_CONTENT_WIDTH, 'px-2')}>
          <Sparkles className="size-10 text-violet-400 mb-4 mx-auto" />
          <h1 className="text-lg font-black text-white">Vics 성향 리포트</h1>
          <p className="mt-2 text-sm text-violet-200/70">로그인 후 10회 투표를 완료하면 열려요</p>
          <button
            type="button"
            onClick={openLoginModal}
            className="mt-6 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-black text-white"
          >
            로그인하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(PAGE_BG, '-mx-4 px-4')}>
      <Helmet>
        <title>Vics 성향 리포트</title>
        <meta name="description" content={shareOgDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={shareOgTitle} />
        <meta property="og:description" content={shareOgDescription} />
        {shareUrl ? <meta property="og:url" content={shareUrl} /> : null}
        {shareOgImage ? <meta property="og:image" content={shareOgImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        {shareUrl ? <meta name="twitter:url" content={shareUrl} /> : null}
      </Helmet>
      <div className={cn(TENDENCY_REPORT_CONTENT_WIDTH, 'pb-24 pt-4')}>
        {/* 헤더 */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200 hover:bg-white/10 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-400/80">
              Vics Event Report
            </p>
            <h1 className="truncate text-lg font-black text-white">성향 리포트</h1>
          </div>
          {report && !isSharedView && (
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={sharing}
              className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200 hover:bg-white/10 transition-colors disabled:opacity-50"
              aria-label="공유"
            >
              {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            </button>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-violet-300/70">
            <Loader2 className="size-8 animate-spin mb-3" />
            <p className="text-sm font-semibold">투표 패턴 분석 중…</p>
          </div>
        )}

        {!loading && error && !report && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
            <Target className="mx-auto size-10 text-violet-400 mb-3" />
            <p className="text-sm font-semibold text-violet-200/80">{error}</p>
            <Link
              to="/matchups"
              className="mt-6 inline-flex items-center gap-1 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-black text-white"
            >
              매치업 투표하러 가기
              <ChevronRight size={16} />
            </Link>
          </div>
        )}

        {!loading && report && meta && (
          <div className="space-y-5">
            {isSharedView && (
              <p className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-center text-xs font-bold text-cyan-100/90">
                친구가 공유한 성향 리포트예요 · 로그인 없이 볼 수 있어요
              </p>
            )}
            {isDevDemo && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-bold text-amber-200/90">
                개발 미리보기 · {DEMO_TENDENCY_LABELS[report.tendencyType] || report.tendencyType} 샘플
                · 저장·공유는 반영되지 않아요
              </p>
            )}
            {/* 메인 카드 */}
            <div
              className={cn(
                'relative overflow-hidden rounded-3xl border p-6 shadow-2xl',
                'bg-gradient-to-br',
                meta.cardBg,
                meta.ring,
                'ring-1',
              )}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,255,255,0.12), transparent 60%)',
                }}
              />
              <div className="relative text-center">
                <span className="text-5xl">{meta.emoji}</span>
                <p className={cn('mt-2 text-xs font-black uppercase tracking-[0.3em]', meta.accent)}>
                  {meta.tagline}
                </p>
                <h2 className="mt-2 text-2xl font-black text-white leading-tight">{report.headline}</h2>
                <div
                  className={cn(
                    'mx-auto mt-4 inline-flex rounded-full bg-gradient-to-r px-4 py-1.5 text-sm font-black text-white shadow-lg',
                    meta.gradient,
                  )}
                >
                  {meta.title}
                </div>
              </div>
            </div>

            {/* 요약 */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <p className="text-sm font-medium leading-relaxed text-violet-100/90">
                {stripReportMarkdown(report.summary)}
              </p>
              <ul className="mt-4 space-y-2">
                {(report.traits || []).map((t) => (
                  <li key={t} className="flex items-start gap-2 text-xs font-semibold text-violet-200/75">
                    <Zap size={14} className="mt-0.5 shrink-0 text-fuchsia-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* 통계 */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                <BarChart3 size={16} className="text-cyan-400" />
                투표 패턴 ({report.voteCount}회 기준)
              </div>
              <div className="space-y-4">
                <StatBar label="다수와 같은 선택" value={report.stats.mainstreamPct} colorClass="bg-gradient-to-r from-sky-500 to-blue-500" />
                <StatBar label="다수와 다른 선택" value={report.stats.contrarianPct} colorClass="bg-gradient-to-r from-rose-500 to-orange-500" />
                {report.stats.hitRatePct != null && (
                  <StatBar label="종료 매치업 예측 적중" value={report.stats.hitRatePct} colorClass="bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                )}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl bg-black/25 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-violet-300/60">LEFT (A)</p>
                    <p className="text-lg font-black tabular-nums text-white">{report.stats.leftPct}%</p>
                  </div>
                  <div className="rounded-xl bg-black/25 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold text-violet-300/60">RIGHT (B)</p>
                    <p className="text-lg font-black tabular-nums text-white">{report.stats.rightPct}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 카테고리 */}
            {displayCategoryBreakdown.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                  <Users size={16} className="text-fuchsia-400" />
                  관심 카테고리
                </div>
                <div className="space-y-2.5">
                  {displayCategoryBreakdown.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-lg">{c.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-violet-100/90 truncate">{c.label}</span>
                          <span className="font-black tabular-nums text-white/80">{c.pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500"
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 하이라이트 선택 */}
            {report.highlightChoices?.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <p className="mb-3 text-sm font-black text-white">기억에 남는 선택</p>
                <div className="space-y-2">
                  {report.highlightChoices.map((c, i) => (
                    <div
                      key={`${c.title}-${i}`}
                      className="rounded-xl border border-white/8 bg-black/20 px-3.5 py-3"
                    >
                      <p className="text-xs font-bold text-violet-200/60 line-clamp-1">{c.title}</p>
                      <p className="mt-1 text-sm font-black text-white">
                        내 선택: <span className="text-fuchsia-300">{c.pickedLabel}</span>
                        {c.wasMajority === false && (
                          <span className="ml-2 text-[10px] font-bold text-amber-400/90">소수파 ✦</span>
                        )}
                        {c.wasMajority === true && (
                          <span className="ml-2 text-[10px] font-bold text-sky-400/90">다수파</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSharedView ? (
              <Link
                to="/matchups"
                className="block w-full rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 py-4 text-center text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110"
              >
                나도 매치업 투표하고 리포트 받기
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleConfirm()}
                  className={cn(
                    'w-full rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 py-4 text-sm font-black text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110 disabled:opacity-60',
                  )}
                >
                  {saving ? '저장 중…' : acknowledged ? '마이페이지로' : '리포트 확인 완료'}
                </button>

                {!acknowledged && (
                  <p className="text-center text-[10px] font-medium text-slate-500">
                    확인 완료 후 마이페이지에서 다시 볼 수 있어요 · 투표 {TENDENCY_REPORT_VOTE_THRESHOLD}회 달성 이벤트
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <TendencyReportShareSheet
        open={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        report={report}
        shareUrl={shareUrl || sharePreviewUrl || getTendencyReportLandingUrl()}
        showToast={showToast}
      />
    </div>
  )
}
