import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight, Lightbulb, Loader2 } from 'lucide-react'
import { getAppealKeywordHints, INQUIRY_STATUS } from '../lib/inquiryStorage'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { cn } from '../lib/utils'

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
    label: '답변완료',
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
    <div
      className={cn(
        SECTION_CARD,
        'mt-8 p-4 border-amber-200/50 bg-gradient-to-br from-amber-50/95 via-orange-50/50 to-rose-50/40'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-amber-100/90 border border-amber-200/60 flex items-center justify-center shadow-sm">
          <Lightbulb size={18} className="text-amber-600" />
        </div>
        <span className="text-sm font-black text-fuchsia-950">참고해주세요</span>
      </div>
      <ul className="text-xs text-fuchsia-800/75 space-y-1 leading-relaxed">
        <li>· 문의 내역은 최근 1년까지만 보관됩니다.</li>
      </ul>
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
  const { user } = useAuthStore()
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])       // Supabase 조회 결과
  const [autoRepliedIds, setAutoRepliedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      // 내 문의 목록 조회
      const { data: rows } = await supabase
        .from('inquiries')
        .select('id, receipt_id, category, category_label, title, content, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const list = rows || []
      setItems(list)

      // 자동응대 완료 inquiry_id 목록
      if (list.length > 0) {
        const { data: replies } = await supabase
          .from('inquiry_replies')
          .select('inquiry_id')
          .eq('reply_type', 'auto')
          .in('inquiry_id', list.map((r) => r.id))
        setAutoRepliedIds(new Set((replies || []).map((r) => r.inquiry_id)))
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadHistory() }, [loadHistory])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const paginatedList = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className={cn('min-h-screen', PAGE_BG)}>
      <div className="max-w-screen-lg mx-auto">
        {/* 헤더: 뒤로 + 제목 + [+문의] */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-3', HEADER_GLASS)}>
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-fuchsia-900" />
          </button>
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 tracking-tight">내 문의 내역</h1>
          <Link
            to="/inquiry/form"
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black shadow-md shadow-emerald-300/45 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/50"
          >
            <Plus size={18} strokeWidth={2.5} />
            문의
          </Link>
        </div>

        <div className="px-4 py-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-fuchsia-400" />
            </div>
          ) : items.length === 0 ? (
            /* 빈 상태 */
            <div className="text-center py-16">
              <p className="text-sm font-medium text-fuchsia-800/70 mb-6">아직 문의하신 내역이 없어요.</p>
              <Link
                to="/inquiry/form"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] font-black shadow-lg shadow-emerald-300/45 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/50"
              >
                <Plus size={20} strokeWidth={2.5} />
                1:1 문의하기
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-fuchsia-800/70 mb-4">전체 {items.length}건</p>
              <div className="space-y-3">
                {paginatedList.map((item) => {
                  const isAutoReplied = autoRepliedIds.has(item.id)
                  const isCompleted = item.status === 'completed'
                  const config = isAutoReplied
                    ? AUTO_REPLIED_CONFIG
                    : isCompleted
                    ? STATUS_CONFIG[INQUIRY_STATUS.replied]
                    : STATUS_CONFIG[INQUIRY_STATUS.received]
                  const preview = isAutoReplied
                    ? AUTO_REPLIED_CONFIG.preview
                    : isCompleted
                    ? PREVIEW_BY_STATUS[INQUIRY_STATUS.replied]
                    : PREVIEW_BY_STATUS[INQUIRY_STATUS.received]
                  const rid = item.receipt_id || item.id

                  return (
                    <Link
                      key={item.id}
                      to={item.category === 'appeal'
                        ? `/inquiry/appeal/${encodeURIComponent(rid)}`
                        : `/inquiry/history/${encodeURIComponent(rid)}`}
                      className={cn(
                        SECTION_CARD,
                        'group block p-4 border-pink-100/70',
                        'hover:border-fuchsia-300/70 hover:shadow-[0_8px_32px_-12px_rgba(192,38,211,0.25)] hover:-translate-y-0.5',
                        'active:translate-y-0 active:shadow-md',
                        'transition-all duration-200 ease-out'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black ${config.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                              {config.label}
                            </span>
                          </div>
                          <InquiryCardTitle item={{ ...item, receiptId: rid }} isReplied={isCompleted} />
                          <p className="text-xs text-fuchsia-700/55 mt-1">{preview}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs text-fuchsia-600/50 font-medium">
                            {formatCardDate(item.created_at)}
                          </span>
                          <div className="w-8 h-8 rounded-xl bg-fuchsia-50/90 border border-pink-100/60 group-hover:bg-fuchsia-100 group-hover:border-fuchsia-200/70 flex items-center justify-center transition-all">
                            <ChevronRight size={18} className="text-fuchsia-400 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-9 h-9 rounded-xl border border-pink-200/80 bg-white/80 flex items-center justify-center text-fuchsia-800 hover:bg-fuchsia-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ArrowLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : Math.max(1, page - 2 + i)
                    if (p > totalPages) return null
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={cn('w-9 h-9 rounded-xl text-sm font-black transition-all',
                          page === p ? 'bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white shadow-md shadow-fuchsia-300/40 ring-1 ring-white/50'
                            : 'border border-pink-200/80 bg-white/80 text-fuchsia-800 hover:bg-fuchsia-50')}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-9 h-9 rounded-xl border border-pink-200/80 bg-white/80 flex items-center justify-center text-fuchsia-800 hover:bg-fuchsia-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
