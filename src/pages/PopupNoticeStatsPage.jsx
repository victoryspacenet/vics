import { useMemo, useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Layers, MousePointerClick, Route, Eye } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { getPopupNotice } from '../lib/popupNoticeStorage'

const PAGE_BG =
  'min-h-full w-full min-w-0 bg-gradient-to-b from-slate-100/90 via-white to-violet-50/35 pb-16'

function sortPathEntries(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj)
    .map(([path, count]) => ({ path, count: Number(count) || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
}

function PathTable({ title, icon: Icon, rows, emptyHint }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_8px_30px_-12px_rgba(91,33,182,0.12)] ring-1 ring-violet-100/40">
      <div className="border-b border-violet-100/60 bg-gradient-to-r from-violet-50/95 via-white to-fuchsia-50/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 text-violet-700 shadow-sm ring-1 ring-violet-200/60">
            <Icon size={18} strokeWidth={2.25} />
          </span>
          <h2 className="text-sm font-black text-[#22282E]">{title}</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-medium text-gray-500 sm:px-5">{emptyHint}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-violet-50 bg-violet-50/30">
                <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-wide text-gray-500 sm:px-5">
                  화면 경로
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-black uppercase tracking-wide text-gray-500 sm:px-5">
                  건수
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ path, count }) => (
                <tr key={path} className="border-b border-violet-50/50 last:border-0">
                  <td className="max-w-[min(28rem,70vw)] px-4 py-2.5 font-mono text-xs font-semibold text-[#22282E] sm:px-5">
                    <span className="break-all">{path}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-black tabular-nums text-violet-800 sm:px-5">
                    {count.toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function PopupNoticeStatsPage() {
  const { id } = useParams()
  const popupRefresh = useUIStore((s) => s.popupRefresh)
  const [popup, setPopup] = useState(null)

  useEffect(() => {
    if (!id) {
      setPopup(null)
      return
    }
    void getPopupNotice(id).then(setPopup)
  }, [id, popupRefresh])

  const views = popup?.viewCount ?? 0
  const clicks = popup?.clickCount ?? 0
  const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0'

  const viewRows = useMemo(() => sortPathEntries(popup?.viewByPath), [popup?.viewByPath])
  const clickRows = useMemo(() => sortPathEntries(popup?.clickByPath), [popup?.clickByPath])

  if (!popup) {
    return (
      <div className={PAGE_BG}>
        <div className="relative z-[1] mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <p className="text-center text-sm font-medium text-gray-500">팝업을 찾을 수 없어요.</p>
          <Link
            to="/admin/notice/popup/list"
            className="mt-4 block text-center text-sm font-black text-violet-700 hover:underline"
          >
            목록으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={PAGE_BG}>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-gradient-to-b from-violet-200/25 via-fuchsia-100/10 to-transparent blur-3xl"
        aria-hidden
      />
      <div className="relative z-[1] mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-8 overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/50 to-fuchsia-50/40 p-5 shadow-[0_12px_40px_-16px_rgba(109,40,217,0.25)] ring-1 ring-white/80 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Link
                to="/admin/notice/popup/list"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-fuchsia-700"
              >
                <ArrowLeft size={16} />
                목록
              </Link>
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-violet-600/90">Analytics</p>
              <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-400/30">
                  <BarChart3 size={20} strokeWidth={2.25} />
                </span>
                팝업 통계
              </h1>
              <p className="mt-2 truncate text-sm font-bold text-[#22282E]">{popup.name || '(제목 없음)'}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">노출·클릭 수와 화면별 유입을 확인해요.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                to={`/admin/notice/popup/${id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200/90 bg-white px-4 py-2.5 text-sm font-bold text-violet-800 shadow-sm transition hover:bg-violet-50"
              >
                <Layers size={16} />
                기본 정보
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-violet-100/80 bg-white/95 p-4 shadow-sm ring-1 ring-violet-100/40">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-500">
                <Eye size={14} className="text-violet-600" />
                노출
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums text-[#22282E]">{views.toLocaleString('ko-KR')}</p>
            </div>
            <div className="rounded-2xl border border-violet-100/80 bg-white/95 p-4 shadow-sm ring-1 ring-violet-100/40">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-500">
                <MousePointerClick size={14} className="text-fuchsia-600" />
                클릭
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums text-[#22282E]">{clicks.toLocaleString('ko-KR')}</p>
            </div>
            <div className="rounded-2xl border border-violet-100/80 bg-white/95 p-4 shadow-sm ring-1 ring-violet-100/40">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-500">
                <BarChart3 size={14} className="text-emerald-600" />
                클릭률 (CTR)
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums text-[#22282E]">{ctr}%</p>
            </div>
          </div>

          <PathTable
            title="유입 경로 · 노출"
            icon={Route}
            rows={viewRows}
            emptyHint="아직 화면별 노출 데이터가 없어요. 앱에서 팝업이 뜬 뒤부터 경로별로 쌓여요."
          />
          <PathTable
            title="유입 경로 · 클릭"
            icon={MousePointerClick}
            rows={clickRows}
            emptyHint="아직 화면별 클릭 데이터가 없어요. 사용자가 팝업 이미지를 눌렀을 때 경로가 기록돼요."
          />

          <p className="text-center text-[11px] font-medium leading-relaxed text-gray-400">
            집계는 앱 내 라우트 경로 기준이에요. Supabase 연동 후에는 기기·캠페인 단위로 확장할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  )
}
