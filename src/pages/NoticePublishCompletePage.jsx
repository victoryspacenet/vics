import { Link, useLocation } from 'react-router-dom'
import { CheckCircle, List, Pencil, Megaphone } from 'lucide-react'

const CATEGORY_LABELS = {
  notice: '공지',
  event: '이벤트',
  update: '업데이트',
  winner: '당첨자',
}

export function NoticePublishCompletePage() {
  const { state } = useLocation()
  const data = state || {}

  const title = data.title || '[이벤트] 릴레이 매치업 승리 보상 안내'
  const category = data.category || 'event'
  const publishedAt =
    data.publishedAt ||
    new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' (KST)'
  const targetAll = data.targetAll !== false
  const targetTierLabel = data.targetTierLabel
  const targetTierExact = data.targetTierExact === true
  const sendPush = data.sendPush !== false
  const pushCount = data.pushCount ?? 12500

  const exposureLabel = targetAll
    ? '전체 유저'
    : targetTierLabel
      ? `${targetTierLabel}${targetTierExact ? ' · 해당 티어만' : ' · 이상 열람'}`
      : '특정 티어'

  return (
    <div className="min-h-full w-full min-w-0 bg-gradient-to-b from-slate-100/80 via-white to-emerald-50/30 pb-16">
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <div className="relative mb-8 overflow-hidden rounded-2xl border-2 border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-white to-violet-50/50 px-5 py-6 shadow-sm">
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-emerald-400/15 blur-2xl"
            aria-hidden
          />
          <p className="relative text-[11px] font-black uppercase tracking-wider text-emerald-600/90">
            공지사항 관리 · 게시 완료
          </p>
          <h1 className="relative mt-1 text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">게시 완료</h1>
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-6 text-center shadow-sm shadow-gray-200/40">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-50">
            <CheckCircle size={36} strokeWidth={2.25} className="text-white" />
          </div>
          <p className="text-lg font-black text-[#22282E]">공지사항이 라이브 상태로 전환되었습니다</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-gray-600">
            지금부터 유저 앱의 공지 목록에서 확인할 수 있어요.
          </p>
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm shadow-gray-200/40">
          <div className="border-b border-gray-100/90 bg-gradient-to-r from-slate-50/95 via-white to-emerald-50/30 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100/90 text-emerald-700 ring-1 ring-emerald-200/50">
                <Megaphone size={18} strokeWidth={2.25} />
              </span>
              <h2 className="text-sm font-black tracking-tight text-[#22282E]">게시 정보 요약</h2>
            </div>
          </div>
          <ul className="space-y-3 p-4 text-sm sm:p-5">
            <li className="flex gap-2 rounded-xl bg-gray-50/80 px-3 py-2.5">
              <span className="shrink-0 font-bold text-gray-400">제목</span>
              <span className="min-w-0 font-semibold text-[#22282E]">
                [{CATEGORY_LABELS[category] || category}] {title}
              </span>
            </li>
            <li className="flex gap-2 rounded-xl bg-gray-50/80 px-3 py-2.5">
              <span className="shrink-0 font-bold text-gray-400">게시 일시</span>
              <span className="font-medium text-gray-800">{publishedAt}</span>
            </li>
            <li className="flex gap-2 rounded-xl bg-gray-50/80 px-3 py-2.5">
              <span className="shrink-0 font-bold text-gray-400">노출 대상</span>
              <span className="min-w-0 font-medium text-gray-800">{exposureLabel}</span>
            </li>
            <li className="flex gap-2 rounded-xl bg-gray-50/80 px-3 py-2.5">
              <span className="shrink-0 font-bold text-gray-400">푸시</span>
              <span className="font-medium text-gray-800">
                {sendPush
                  ? `발송 완료 (약 ${pushCount.toLocaleString()}명에게 전송됨)`
                  : '미발송'}
              </span>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">다음 작업</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/notice"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-sky-200/90 bg-gradient-to-br from-sky-50 to-white py-3.5 text-sm font-black text-sky-900 shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <List size={18} /> 공지 목록으로
            </Link>
            <Link
              to="/admin/notice/new"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-400 to-emerald-500 py-3.5 text-sm font-black text-[#0f1f0f] shadow-lg shadow-emerald-300/40 transition hover:from-lime-500 hover:to-emerald-600"
            >
              <Pencil size={18} /> 새 공지 쓰기
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs font-medium text-gray-500">
          수정이 필요하면 공지 목록에서 해당 글을 찾아 수정할 수 있어요.
        </p>
      </div>
    </div>
  )
}
