import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react'
import {
  getContentDeletionNotice,
  markContentDeletionNoticeRead,
  ensureDemoNotice,
} from '../lib/contentDeletionNoticeStorage'
import { useAuthStore } from '../store/authStore'
import { cn } from '../lib/utils'

const PAGE_BG =
  'min-h-screen bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px] overflow-hidden'
const HEADER_GLASS =
  'sticky top-0 z-10 bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/25 backdrop-blur-md border-b border-pink-100/55'

function formatRestrictionEnd(isoString) {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}.${m}.${day} ${h}:${min}`
  } catch {
    return isoString
  }
}

export function ContentDeletionNoticePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthStore()
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setLoading(false)
      setNotice(null)
      return
    }
    let cancelled = false
    ;(async () => {
      if (!id) {
        const demo = await ensureDemoNotice(user.id)
        if (!cancelled && demo?.id) {
          navigate(`/notice/deletion/${demo.id}`, { replace: true })
        }
        setLoading(false)
        return
      }
      const n = await getContentDeletionNotice(id)
      if (cancelled) return
      if (n?.userId && n.userId !== user.id) {
        setNotice(null)
      } else {
        setNotice(n)
        if (n) await markContentDeletionNoticeRead(n.id)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, user?.id, authLoading, navigate])

  if (authLoading || loading) {
    return (
      <div className={cn(PAGE_BG, 'flex min-h-screen items-center justify-center px-4')}>
        <p className="text-sm text-fuchsia-700/80">불러오는 중…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={cn(PAGE_BG, 'flex min-h-screen items-center justify-center px-4')}>
        <p className="text-sm text-fuchsia-800">로그인이 필요해요.</p>
      </div>
    )
  }

  if (!id) {
    return null
  }

  if (!notice) {
    return (
      <div className={cn(PAGE_BG, 'flex flex-col items-center justify-center px-4')}>
        <div className={cn(SECTION_CARD, 'w-full max-w-sm px-8 py-10 text-center')}>
          <p className="mb-4 text-sm font-medium text-fuchsia-800/75">해당 안내를 찾을 수 없어요.</p>
          <Link
            to="/notice"
            className="text-sm font-black text-fuchsia-700 underline decoration-fuchsia-300/80 underline-offset-2 hover:text-fuchsia-900"
          >
            목록으로
          </Link>
        </div>
      </div>
    )
  }

  const summaryDisplay = notice.contentSummaryMasked || notice.contentSummary || '(내용 없음)'
  const restrictionEndFormatted = notice.restrictionEndAt
    ? formatRestrictionEnd(notice.restrictionEndAt)
    : ''

  return (
    <div className={cn('w-full min-w-0', PAGE_BG)}>
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-0">
        <div className={cn('flex items-center justify-between gap-2 px-0 py-3', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-1 flex shrink-0 items-center gap-1 rounded-2xl border border-pink-100/80 bg-white/90 px-2.5 py-2 text-fuchsia-950 shadow-sm shadow-pink-100/40 transition hover:bg-white hover:shadow-md"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <h1 className="min-w-0 flex-1 bg-gradient-to-r from-fuchsia-700 via-violet-600 to-cyan-600 bg-clip-text text-center text-[17px] font-black tracking-tight text-transparent">
            안내 사항
          </h1>
          <div className="w-10 shrink-0" aria-hidden />
        </div>

        <div className="mt-4 space-y-5">
          <div
            className={cn(
              'rounded-2xl border-2 border-rose-200/70 bg-gradient-to-br from-rose-100/90 via-fuchsia-50 to-violet-50/90 px-5 py-6 text-center shadow-[0_12px_36px_-14px_rgba(244,114,182,0.35)] ring-1 ring-white/80',
            )}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-lg shadow-rose-300/45 ring-2 ring-white/60">
              <AlertTriangle size={24} strokeWidth={2.25} />
            </div>
            <p className="text-base font-black leading-snug text-fuchsia-950">
              커뮤니티 가이드라인에 따라
              <br />
              콘텐츠가 삭제되었습니다.
            </p>
            <p className="mt-2 text-xs font-medium text-fuchsia-800/55">아래 내용을 확인해 주세요</p>
          </div>

          <section className={SECTION_CARD}>
            <h2 className="border-b border-pink-100/80 bg-gradient-to-r from-fuchsia-50 via-pink-50/90 to-violet-50/80 px-4 py-3 text-sm font-black text-fuchsia-950">
              삭제 대상
            </h2>
            <div className="space-y-2 p-4 text-sm">
              <p className="text-fuchsia-900/90">
                <span className="font-black text-fuchsia-700/80">유형</span>{' '}
                <span className="font-semibold">{notice.contentType}</span>
                {notice.contentCreatedAt && (
                  <span className="text-fuchsia-700/50"> (작성일: {notice.contentCreatedAt})</span>
                )}
              </p>
              <p className="text-fuchsia-900/90">
                <span className="font-black text-fuchsia-700/80">내용 요약</span>{' '}
                <span className="font-medium">&quot;{summaryDisplay}&quot;</span>
              </p>
            </div>
          </section>

          <section className={SECTION_CARD}>
            <h2 className="border-b border-pink-100/80 bg-gradient-to-r from-violet-50 via-fuchsia-50/80 to-pink-50/70 px-4 py-3 text-sm font-black text-fuchsia-950">
              위반 사유
            </h2>
            <ul className="space-y-2 p-4">
              {(notice.violationReasons || []).map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-fuchsia-900/88"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-[10px] font-black text-white shadow-sm shadow-rose-300/40">
                    {i + 1}
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={cn(
              'rounded-2xl border-2 border-amber-200/80 bg-gradient-to-br from-amber-50/95 via-orange-50/50 to-rose-50/40 shadow-[0_8px_28px_-12px_rgba(251,191,36,0.25)]',
            )}
          >
            <h2 className="border-b border-amber-200/60 bg-gradient-to-r from-amber-100/90 to-orange-50/90 px-4 py-3 text-sm font-black text-amber-950">
              처리 결과
            </h2>
            <ul className="space-y-2 p-4 text-sm text-amber-950/90">
              {(notice.actions || []).map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 ring-1 ring-amber-200/80" />
                  <span>{a}</span>
                </li>
              ))}
              {restrictionEndFormatted && (
                <li className="mt-3 rounded-xl border border-amber-200/70 bg-white/70 px-3 py-2 text-sm font-black text-amber-800 shadow-sm">
                  제한 종료일: {restrictionEndFormatted}
                </li>
              )}
            </ul>
          </section>

          <div className="space-y-4 pt-1">
            <p className="text-center text-sm font-medium leading-relaxed text-fuchsia-800/70">
              회원님의 원활한 서비스 이용을 위해
              <br />
              <span className="font-black text-fuchsia-900">커뮤니티 가이드라인</span>을 다시 숙지해 주세요.
            </p>
            <Link
              to="/community-policy"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 py-3.5 text-sm font-black text-[#0f1f0f] shadow-md shadow-emerald-300/45 ring-1 ring-white/50 transition hover:brightness-105 active:scale-[0.98]"
            >
              <FileText size={18} strokeWidth={2.25} />
              가이드라인 다시보기
            </Link>
            <button
              type="button"
              onClick={() => navigate('/inquiry/appeal')}
              className="block w-full py-3 text-sm font-bold text-fuchsia-700/80 transition hover:text-fuchsia-950 hover:underline"
            >
              이의 제기 및 소명하기
            </button>
            <p className="text-center text-xs font-medium text-fuchsia-700/45">
              억울한 경우 이의를 제기할 수 있어요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
