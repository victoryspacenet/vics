import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, CheckCircle, AlertCircle, Flame, FileText } from 'lucide-react'
import { getAppealResultByReceiptId } from '../lib/appealResultStorage'
import { cn } from '../lib/utils'

const PAGE_BG =
  'min-h-screen bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'sticky top-0 z-10 bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function safeDecode(s) {
  if (!s) return ''
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function AppealResultPage() {
  const navigate = useNavigate()
  const { receiptId: receiptIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const receiptId =
    safeDecode(receiptIdParam) ||
    safeDecode(searchParams.get('id')) ||
    safeDecode(searchParams.get('receiptId')) ||
    ''

  const [result, setResult] = useState(undefined) // undefined = 로딩 중

  useEffect(() => {
    let cancelled = false
    getAppealResultByReceiptId(receiptId).then((data) => {
      if (!cancelled) setResult(data ?? null)
    })
    return () => { cancelled = true }
  }, [receiptId])

  if (result === undefined) {
    return (
      <div className={cn('flex min-h-screen items-center justify-center px-4', PAGE_BG)}>
        <p className="text-sm text-fuchsia-400">불러오는 중...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className={cn('flex min-h-screen items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'w-full max-w-sm px-8 py-10 text-center')}>
          <p className="mb-4 text-sm font-medium text-fuchsia-800/75">해당 심사 결과를 찾을 수 없어요.</p>
          <Link
            to="/inquiry/history"
            className="text-sm font-black text-fuchsia-700 underline decoration-fuchsia-300/80 underline-offset-2 hover:text-fuchsia-900"
          >
            문의 내역으로
          </Link>
        </div>
      </div>
    )
  }

  const displayReceiptNo = (result.receiptId || result.id || '').startsWith('#')
    ? result.receiptId || result.id
    : `#${result.receiptId || result.id}`
  const isApproved = result.decision === 'approve'
  const isMitigate = result.decision === 'mitigate'
  const statusLabel = isApproved
    ? '승인 (제재 해제)'
    : isMitigate
      ? '경감 (제재 기간 단축)'
      : '기각 (제재 유지)'

  const statusAccent =
    isApproved ? 'text-emerald-600' : isMitigate ? 'text-amber-700' : 'text-rose-700'

  return (
    <div className={cn('w-full min-w-0', PAGE_BG)}>
      {/* 헤더 */}
      <div className={cn('flex items-center gap-2 px-4 py-3', HEADER_GLASS)}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-1 flex shrink-0 items-center gap-1 rounded-2xl border border-pink-100/80 bg-white/90 px-2.5 py-2 text-fuchsia-950 shadow-sm shadow-pink-100/40 transition hover:bg-white hover:shadow-md"
          aria-label="뒤로"
        >
          <ArrowLeft size={20} strokeWidth={2.25} />
        </button>
        <h1 className="min-w-0 flex-1 bg-gradient-to-r from-fuchsia-700 via-violet-600 to-cyan-600 bg-clip-text text-center text-lg font-black tracking-tight text-transparent">
          심사 결과 안내
        </h1>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex shrink-0 rounded-2xl border border-pink-100/80 bg-white/80 p-2 text-fuchsia-700/60 transition hover:bg-fuchsia-50/80 hover:text-fuchsia-900"
          aria-label="닫기"
        >
          <X size={20} strokeWidth={2.25} />
        </button>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8">
        {isApproved ? (
          <div className="space-y-6">
            <div className="rounded-2xl border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 via-teal-50/50 to-cyan-50/40 px-4 py-8 text-center shadow-[0_12px_36px_-14px_rgba(16,185,129,0.25)] ring-1 ring-white/80">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 text-white shadow-lg shadow-emerald-400/40 ring-4 ring-white/70">
                <CheckCircle size={34} strokeWidth={2.25} />
              </div>
              <p className="mb-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-2xl font-black tracking-tight text-transparent">
                ✨ GOOD NEWS! ✨
              </p>
              <p className="text-lg font-black text-fuchsia-950">이의 신청이 승인되어</p>
              <p className="text-lg font-black text-fuchsia-950">제재가 해제되었습니다.</p>
            </div>

            <div className={cn(SECTION_CARD, 'space-y-5 p-5')}>
              <div>
                <h2 className="mb-3 border-b border-pink-100/80 pb-2 text-sm font-black text-fuchsia-950">
                  검토 결과
                </h2>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="font-bold text-fuchsia-700/60">접수 번호</span>
                    <span className="font-black text-fuchsia-950">{displayReceiptNo}</span>
                  </li>
                  <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-bold text-fuchsia-700/60">심사 상태</span>
                    <span className={cn('rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black', statusAccent)}>
                      {statusLabel}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="mb-3 border-b border-pink-100/80 pb-2 text-sm font-black text-fuchsia-950">
                  관리자 답변
                </h2>
                <p className="rounded-2xl border border-pink-100/80 bg-gradient-to-br from-fuchsia-50/80 to-white/90 px-4 py-3 text-sm font-medium leading-relaxed text-fuchsia-900/90 whitespace-pre-wrap shadow-inner shadow-pink-100/30">
                  &quot;{result.replyToUser || '제재가 해제되었습니다.'}&quot;
                </p>
              </div>

              <p className="text-center text-xs font-medium leading-relaxed text-fuchsia-700/55">
                앞으로도 클린한 VICTORYSPACE를 위해 커뮤니티 가이드를 준수해 주세요.
              </p>
            </div>

            <Link
              to="/"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 py-4 text-[#0f1f0f] font-black shadow-lg shadow-emerald-300/45 ring-1 ring-white/50 transition hover:brightness-105 active:scale-[0.98]"
            >
              <Flame size={20} strokeWidth={2.25} />
              서비스 바로 시작하기
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div
              className={cn(
                'rounded-2xl border-2 px-4 py-8 text-center shadow-lg ring-1 ring-white/80',
                isMitigate
                  ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-orange-50/60 to-rose-50/40 shadow-amber-200/20'
                  : 'border-rose-200/85 bg-gradient-to-br from-rose-50/95 via-fuchsia-50/50 to-violet-50/40 shadow-rose-200/15',
              )}
            >
              <div
                className={cn(
                  'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white/70',
                  isMitigate
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-400/35'
                    : 'bg-gradient-to-br from-rose-500 via-fuchsia-600 to-violet-700 shadow-fuchsia-400/35',
                )}
              >
                <AlertCircle size={34} strokeWidth={2.25} />
              </div>
              <p className="mb-2 text-lg font-black text-fuchsia-950">이의 신청에 대한 심사 결과</p>
              <p className="text-lg font-black text-fuchsia-950/95">
                {isMitigate ? '제재 기간이 단축되었습니다.' : '제재 유지가 결정되었습니다.'}
              </p>
            </div>

            <div className={cn(SECTION_CARD, 'space-y-5 p-5')}>
              <div>
                <h2 className="mb-3 border-b border-pink-100/80 pb-2 text-sm font-black text-fuchsia-950">
                  검토 결과
                </h2>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="font-bold text-fuchsia-700/60">접수 번호</span>
                    <span className="font-black text-fuchsia-950">{displayReceiptNo}</span>
                  </li>
                  <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-bold text-fuchsia-700/60">심사 상태</span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-black',
                        isMitigate ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800',
                      )}
                    >
                      {statusLabel}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="mb-3 border-b border-pink-100/80 pb-2 text-sm font-black text-fuchsia-950">
                  {isMitigate ? '경감 사유' : '기각 사유'}
                </h2>
                <p className="rounded-2xl border border-pink-100/80 bg-gradient-to-br from-fuchsia-50/80 to-white/90 px-4 py-3 text-sm font-medium leading-relaxed text-fuchsia-900/90 whitespace-pre-wrap shadow-inner shadow-pink-100/30">
                  &quot;{result.replyToUser || (isMitigate ? '제재 기간이 조정되었습니다.' : '제재가 유지됩니다.')}&quot;
                </p>
              </div>

              {result.sanctionEndAt && (
                <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-fuchsia-50/40 px-4 py-3">
                  <h2 className="mb-1 text-xs font-black uppercase tracking-wide text-violet-800/80">
                    제재 종료 예정일
                  </h2>
                  <p className="text-base font-black text-violet-950">{formatDateTime(result.sanctionEndAt)}</p>
                  <p className="mt-1 text-xs font-medium text-violet-700/60">
                    해당 시각 이후부터 활동이 가능합니다
                  </p>
                </div>
              )}
            </div>

            <Link
              to="/community-policy"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-200/90 bg-gradient-to-br from-violet-50/95 to-indigo-50/80 py-4 font-black text-violet-900 shadow-md shadow-violet-200/30 ring-1 ring-white/70 transition hover:border-violet-300 hover:brightness-[1.02] active:scale-[0.98]"
            >
              <FileText size={20} strokeWidth={2.25} />
              커뮤니티 가이드라인 확인
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
