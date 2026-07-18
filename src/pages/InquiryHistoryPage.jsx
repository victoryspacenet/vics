import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, Lightbulb, Loader2, Plus } from 'lucide-react'
import { getAppealKeywordHints, INQUIRY_STATUS, fetchUserInquiriesPaged } from '../lib/inquiryStorage'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'
import { parseListPageParam, patchSearchParamsPage } from '../lib/listPageNav'

/** MZ 파스텔 — 마이페이지·프로필 편집 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const STATUS_CONFIG = {
  [INQUIRY_STATUS.received]: {
    label: '접수완료',
    dot: 'bg-fuchsia-400',
    badge: 'bg-fuchsia-100/90 text-fuchsia-900 border border-fuchsia-200/60',
  },
  [INQUIRY_STATUS.processing]: {
    label: '접수완료',
    dot: 'bg-fuchsia-400',
    badge: 'bg-fuchsia-100/90 text-fuchsia-900 border border-fuchsia-200/60',
  },
  [INQUIRY_STATUS.replied]: {
    label: '수동답변완료',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/60',
  },
}

const PREVIEW_BY_STATUS = {
  [INQUIRY_STATUS.received]: '문의가 정상적으로 접수되었습니다.',
  [INQUIRY_STATUS.processing]: '담당 부서에서 확인 중입니다.',
  [INQUIRY_STATUS.replied]: '운영진의 답변이 도착했습니다.',
}

const AUTO_REPLIED_CONFIG = {
  label: '자동답변완료',
  dot: 'bg-sky-400',
  badge: 'bg-sky-100/90 text-sky-900 border border-sky-200/60',
  preview: '자동 응대 답변이 발송되었습니다.',
}

const PAGE_SIZE = 10

function formatCardDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

function InquiryRetentionNote() {
  return (
    <div className="mt-8 rounded-2xl overflow-hidden border border-amber-200/60 bg-gradient-to-br from-amber-50/95 via-orange-50/60 to-rose-50/40 shadow-sm">
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
            <Lightbulb size={14} className="text-white" />
          </span>
          <span className="text-sm font-black bg-gradient-to-r from-amber-700 to-orange-700 bg-clip-text text-transparent">참고해주세요</span>
        </div>
        <ul className="text-xs text-amber-900/70 space-y-1 leading-relaxed pl-1">
          <li>· 문의 내역은 최근 1년까지만 보관됩니다.</li>
        </ul>
      </div>
    </div>
  )
}

function InquiryCardTitle({ item, isReplied }) {
  const base = isReplied ? 'font-black text-fuchsia-950' : 'font-bold text-fuchsia-950/95'
  if (item.category === 'appeal') {
    const hints = getAppealKeywordHints(item, 2)
    return (
      <p className={cn('text-sm truncate transition-colors', base, 'group-hover:text-fuchsia-800')}>
        <span className="text-fuchsia-950">이의 신청</span>
        {hints.length > 0 && (
          <span className="text-fuchsia-600/75 font-bold"> · {hints.join(', ')}</span>
        )}
      </p>
    )
  }
  return (
    <p className={cn('text-sm truncate transition-colors', base, 'group-hover:text-fuchsia-800')}>
      {item.title || '제목 없음'}
    </p>
  )
}

export function InquiryHistoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const pageFromUrl = parseListPageParam(searchParams.get('page'))
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [autoRepliedIds, setAutoRepliedIds] = useState(new Set())
  const [manualRepliedIds, setManualRepliedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const prevUserIdRef = useRef(user?.id)
  useEffect(() => {
    if (prevUserIdRef.current === user?.id) return
    prevUserIdRef.current = user?.id
    patchSearchParamsPage(setSearchParams, null, {}, { replace: true })
  }, [user?.id, setSearchParams])

  const loadHistory = useCallback(async () => {
    if (!user) {
      setItems([])
      setTotalCount(0)
      setAutoRepliedIds(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { rows, totalCount: tc } = await fetchUserInquiriesPaged(user.id, { page: pageFromUrl, pageSize: PAGE_SIZE })
      setItems(rows)
      setTotalCount(tc)

      if (rows.length > 0) {
        const ids = rows.map((r) => r.id)
        const [{ data: autoReplies }, { data: manualReplies }] = await Promise.all([
          supabase
            .from('inquiry_replies')
            .select('inquiry_id')
            .eq('reply_type', 'auto')
            .in('inquiry_id', ids),
          supabase
            .from('inquiry_replies')
            .select('inquiry_id')
            .eq('reply_type', 'manual')
            .in('inquiry_id', ids),
        ])
        setAutoRepliedIds(new Set((autoReplies || []).map((r) => r.inquiry_id)))
        setManualRepliedIds(new Set((manualReplies || []).map((r) => r.inquiry_id)))
      } else {
        setAutoRepliedIds(new Set())
        setManualRepliedIds(new Set())
      }
    } catch {
      setItems([])
      setTotalCount(0)
      setAutoRepliedIds(new Set())
      setManualRepliedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [user, pageFromUrl])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const page = Math.min(pageFromUrl, totalPages)

  useEffect(() => {
    if (loading || pageFromUrl <= totalPages) return
    patchSearchParamsPage(setSearchParams, totalPages <= 1 ? null : totalPages, {}, { replace: true })
  }, [pageFromUrl, totalPages, loading, setSearchParams])

  const goPage = (p) => {
    patchSearchParamsPage(setSearchParams, p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={cn('min-h-screen relative overflow-hidden', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-gradient-radial from-fuchsia-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-gradient-radial from-pink-300/15 to-transparent blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-56 h-56 rounded-full bg-gradient-radial from-rose-300/12 to-transparent blur-3xl" />
      </div>
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto relative z-10')}>
        {/* 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2.5', HEADER_GLASS)}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-pink-200/60 hover:from-fuchsia-100 hover:to-pink-100 transition-all shrink-0 shadow-sm"
            aria-label="뒤로"
          >
            <ChevronLeft size={16} className="text-fuchsia-700" />
            <span className="text-xs font-bold text-fuchsia-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-md shadow-fuchsia-300/40">
              <ClipboardList size={14} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight">내 문의 내역</h1>
          </div>
          <Link
            to="/inquiry/form"
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white text-sm font-black shadow-[0_4px_14px_-4px_rgba(16,185,129,0.55)] hover:shadow-[0_4px_18px_-4px_rgba(16,185,129,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus size={16} strokeWidth={2.5} />
            문의
          </Link>
        </div>

        <div className="px-4 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={28} className="animate-spin text-fuchsia-400" />
              <p className="text-sm font-bold text-fuchsia-700/60">불러오는 중...</p>
            </div>
          ) : items.length === 0 ? (
            /* 빈 상태 */
            <div className="text-center py-16 space-y-4">
              <div className="text-4xl">📭</div>
              <p className="text-sm font-bold text-fuchsia-800/70">아직 문의하신 내역이 없어요.</p>
              <Link
                to="/inquiry/form"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-black shadow-[0_4px_20px_-4px_rgba(16,185,129,0.5)] hover:shadow-[0_6px_28px_-4px_rgba(16,185,129,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus size={18} strokeWidth={2.5} />
                1:1 문의하기
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-black bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent">전체</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-sm">{totalCount}건</span>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const isManualReplied = manualRepliedIds.has(item.id)
                  const isAutoReplied = !isManualReplied && autoRepliedIds.has(item.id)
                  const isCompleted = item.status === 'completed'
                  const config = isManualReplied
                    ? STATUS_CONFIG[INQUIRY_STATUS.replied]
                    : isAutoReplied
                    ? AUTO_REPLIED_CONFIG
                    : isCompleted
                    ? STATUS_CONFIG[INQUIRY_STATUS.replied]
                    : STATUS_CONFIG[INQUIRY_STATUS.received]
                  const preview = isManualReplied
                    ? PREVIEW_BY_STATUS[INQUIRY_STATUS.replied]
                    : isAutoReplied
                    ? AUTO_REPLIED_CONFIG.preview
                    : isCompleted
                    ? PREVIEW_BY_STATUS[INQUIRY_STATUS.replied]
                    : PREVIEW_BY_STATUS[INQUIRY_STATUS.received]
                  const rid = item.receipt_id || item.id
                  const accentColor = isCompleted || isAutoReplied
                    ? 'from-emerald-400 to-teal-500'
                    : 'from-fuchsia-400 to-pink-500'

                  return (
                    <Link
                      key={item.id}
                      to={item.category === 'appeal'
                        ? `/inquiry/appeal/${encodeURIComponent(rid)}`
                        : `/inquiry/history/${encodeURIComponent(rid)}`}
                      className={cn(
                        'relative flex items-center gap-3 p-4 rounded-2xl overflow-hidden',
                        'border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]',
                        'hover:border-fuchsia-300/70 hover:shadow-[0_8px_32px_-10px_rgba(192,38,211,0.28)] hover:-translate-y-0.5',
                        'active:translate-y-0 transition-all duration-200 ease-out group'
                      )}
                    >
                      {/* 좌측 컬러 액센트 바 */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accentColor} rounded-l-2xl opacity-70 group-hover:opacity-100 transition-opacity`} />
                      <div className="flex-1 min-w-0 pl-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black ${config.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                            {config.label}
                          </span>
                        </div>
                        <InquiryCardTitle item={{ ...item, receiptId: rid }} isReplied={isCompleted} />
                        <p className="text-xs text-fuchsia-700/50 mt-1">{preview}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-xs text-fuchsia-600/45 font-medium">
                          {formatCardDate(item.created_at)}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-50 to-pink-50/80 border border-pink-100/60 group-hover:from-fuchsia-100 group-hover:to-pink-100 flex items-center justify-center transition-all">
                          <ChevronRight size={16} className="text-fuchsia-400 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button onClick={() => goPage(Math.max(1, page - 1))} disabled={page === 1}
                    className="w-9 h-9 rounded-xl border border-pink-200/80 bg-white/80 flex items-center justify-center text-fuchsia-700 hover:bg-gradient-to-br hover:from-fuchsia-50 hover:to-pink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : Math.max(1, page - 2 + i)
                    if (p > totalPages) return null
                    return (
                      <button key={p} onClick={() => goPage(p)}
                        className={cn('w-9 h-9 rounded-xl text-sm font-black transition-all',
                          page === p
                            ? 'bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white shadow-[0_4px_14px_-4px_rgba(192,38,211,0.5)] scale-105 ring-1 ring-white/50'
                            : 'border border-pink-200/80 bg-white/80 text-fuchsia-800 hover:bg-gradient-to-br hover:from-fuchsia-50 hover:to-pink-50 shadow-sm')}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => goPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                    className="w-9 h-9 rounded-xl border border-pink-200/80 bg-white/80 flex items-center justify-center text-fuchsia-700 hover:bg-gradient-to-br hover:from-fuchsia-50 hover:to-pink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              <InquiryRetentionNote />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
