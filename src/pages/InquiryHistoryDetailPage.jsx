import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ClipboardList, MessageSquare, X, Zap } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import {
  getInquiryByReceiptId,
  getInquiryHistoryForDisplay,
  getDisplayStatus,
  removeInquiryByReceiptId,
  INQUIRY_STATUS,
} from '../lib/inquiryStorage'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

/** MZ 파스텔 — 문의 내역과 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const STATUS_CONFIG = {
  [INQUIRY_STATUS.received]: {
    label: '대기중',
    badge: 'bg-fuchsia-100/90 text-fuchsia-900 border border-fuchsia-200/60',
  },
  [INQUIRY_STATUS.processing]: {
    label: '접수완료',
    badge: 'bg-fuchsia-100/90 text-fuchsia-900 border border-fuchsia-200/60',
  },
  [INQUIRY_STATUS.replied]: {
    label: '수동답변완료',
    badge: 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/60',
  },
}
const AUTO_REPLIED_BADGE = 'bg-sky-100/90 text-sky-900 border border-sky-200/60'

function formatCardDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export function InquiryHistoryDetailPage() {
  const navigate = useNavigate()
  const { receiptId } = useParams()
  const { showToast } = useUIStore()
  const { user, loading: authLoading } = useAuthStore()
  const [inquiry, setInquiry] = useState(null)
  const [history, setHistory] = useState([])
  const [loadErr, setLoadErr] = useState(false)
  const [inquiryLoading, setInquiryLoading] = useState(true)

  useEffect(() => {
    if (!receiptId || !user?.id) {
      setInquiry(null)
      setHistory([])
      setLoadErr(false)
      setInquiryLoading(false)
      return
    }
    let cancelled = false
    setInquiryLoading(true)
    ;(async () => {
      const [inv, hist] = await Promise.all([
        getInquiryByReceiptId(receiptId, user.id),
        getInquiryHistoryForDisplay(user.id),
      ])
      if (cancelled) return
      setInquiry(inv)
      setHistory(hist)
      setLoadErr(!inv)
      setInquiryLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [receiptId, user?.id])

  const index = inquiry ? history.findIndex((h) => (h.receiptId || h.id) === (inquiry.receiptId || inquiry.id)) : -1
  const status = inquiry ? getDisplayStatus(inquiry, index >= 0 ? index : 0) : null
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [autoReplyMessage, setAutoReplyMessage] = useState(null)
  const [manualReplyMessage, setManualReplyMessage] = useState(null)

  useEffect(() => {
    const rid = inquiry?.receiptId || inquiry?.id
    if (!rid) return
    async function fetchReplies() {
      const { data: inqRow } = await supabase
        .from('inquiries')
        .select('id')
        .eq('receipt_id', rid)
        .maybeSingle()
      if (!inqRow?.id) return

      // 수동 답변(어드민 답변) 조회
      const { data: manualRow } = await supabase
        .from('inquiry_replies')
        .select('content')
        .eq('inquiry_id', inqRow.id)
        .eq('reply_type', 'manual')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (manualRow?.content) setManualReplyMessage(manualRow.content)

      // 자동 답변 조회
      const { data: autoRow } = await supabase
        .from('inquiry_replies')
        .select('content')
        .eq('inquiry_id', inqRow.id)
        .eq('reply_type', 'auto')
        .maybeSingle()
      if (autoRow?.content) setAutoReplyMessage(autoRow.content)
    }
    fetchReplies()
  }, [inquiry?.receiptId, inquiry?.id])

  const hasAutoReply = !!autoReplyMessage

  const isReplied = status === INQUIRY_STATUS.replied
  // 어드민 수동 답변이 있으면 우선 표시
  const hasReply = isReplied && !!manualReplyMessage

  const canCancelInquiry =
    status === INQUIRY_STATUS.received &&
    !inquiry?._virtual &&
    !hasReply

  const handleConfirmCancelInquiry = async () => {
    const id = inquiry?.receiptId || inquiry?.id
    if (!id || !user?.id) return
    const ok = await removeInquiryByReceiptId(id, user.id)
    setCancelConfirmOpen(false)
    if (ok) {
      showToast('문의가 취소되었어요.', 'success')
      navigate('/inquiry/history', { replace: true })
    } else {
      showToast('문의를 취소할 수 없어요.', 'error')
    }
  }

  if (authLoading || inquiryLoading) {
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center gap-3 px-4', PAGE_BG)}>
        <div className="w-10 h-10 rounded-full border-2 border-fuchsia-300 border-t-fuchsia-600 animate-spin" />
        <p className="text-sm font-bold text-fuchsia-700/70 animate-pulse">불러오는 중…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <div className="text-3xl mb-3">🔒</div>
          <p className="text-sm font-bold text-fuchsia-800/80">로그인이 필요해요.</p>
        </div>
      </div>
    )
  }

  if (!inquiry && loadErr) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <div className="text-3xl mb-3">📭</div>
          <p className="text-sm font-bold text-fuchsia-800/75 mb-5">해당 문의를 찾을 수 없어요.</p>
          <Link
            to="/inquiry/history"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-black shadow-md shadow-fuchsia-300/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            문의 내역으로
          </Link>
        </div>
      </div>
    )
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
              <MessageSquare size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight line-clamp-1">문의 답변 상세</h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-5">
          {/* 상태 배지 + 날짜/유형 */}
          <div className="flex flex-wrap items-center gap-2">
            {status && (
              <span
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-black',
                  hasAutoReply && !hasReply
                    ? AUTO_REPLIED_BADGE
                    : STATUS_CONFIG[status]?.badge || STATUS_CONFIG[INQUIRY_STATUS.received].badge
                )}
              >
                {hasAutoReply && !hasReply ? '자동답변완료' : STATUS_CONFIG[status]?.label || '대기중'}
              </span>
            )}
            <span className="text-xs font-medium text-fuchsia-700/60">
              {formatCardDate(inquiry.receiptTime || inquiry.createdAt)} · {inquiry.categoryLabel || inquiry.category}
            </span>
          </div>

          {/* 문의 내용 */}
          <div className="rounded-2xl overflow-hidden border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-sm">
                  <ClipboardList size={12} className="text-white" />
                </span>
                <h3 className="text-[11px] font-black bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent uppercase tracking-wider">문의 내용</h3>
              </div>
              <p className="text-sm font-black text-fuchsia-950 mb-2">{inquiry.title}</p>
              <p className="text-sm text-fuchsia-900/80 whitespace-pre-wrap leading-relaxed">
                {inquiry.content || inquiry.title || '-'}
              </p>
            </div>
          </div>

          {/* VICTORYSPACE 답변 (답변완료 시) */}
          {hasReply ? (
            <div className="rounded-2xl overflow-hidden border border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 via-teal-50/70 to-cyan-50/50 shadow-[0_8px_32px_-14px_rgba(16,185,129,0.25)]">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-300/40">
                    <Zap size={16} className="text-white" />
                  </span>
                  <span className="text-sm font-black bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">VICTORYSPACE 답변</span>
                </div>
                <p className="text-sm text-emerald-950/80 whitespace-pre-wrap leading-relaxed">
                  {manualReplyMessage}
                </p>
              </div>
            </div>
          ) : hasAutoReply ? (
            /* 자동응대 메시지 */
            <div className="rounded-2xl overflow-hidden border border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 via-teal-50/70 to-cyan-50/50 shadow-[0_8px_32px_-14px_rgba(16,185,129,0.25)]">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-300/40">
                    <Zap size={16} className="text-white" />
                  </span>
                  <span className="text-sm font-black bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">VICTORYSPACE 답변</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-sm">AUTO</span>
                </div>
                <p className="text-sm text-emerald-950/80 whitespace-pre-wrap leading-relaxed">
                  {autoReplyMessage}
                </p>
              </div>
            </div>
          ) : (
            /* 답변 대기 시 (자동응대 없을 때) */
            <div className="rounded-2xl overflow-hidden border border-amber-200/60 bg-gradient-to-br from-amber-50/95 via-orange-50/50 to-rose-50/30 shadow-sm">
              <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
              <div className="p-4 space-y-3">
                <p className="text-sm text-fuchsia-900/85 leading-relaxed">
                  운영진이 내용을 확인 중입니다. 평균{' '}
                  <strong className="text-amber-700 font-black">24시간 이내</strong>에 답변을 드려요.
                </p>
                <p className="text-xs text-fuchsia-700/55">(주말/공휴일 제외)</p>
                {canCancelInquiry && (
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-amber-300/80 bg-white/95 text-sm font-black text-amber-800 shadow-sm hover:bg-amber-50/90 hover:border-amber-400 transition-colors"
                  >
                    문의 취소
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 추가 문의 버튼 */}
          <div className="flex justify-center pt-1 pb-4">
            <Link
              to="/inquiry/form"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-500 text-white text-sm font-black shadow-[0_4px_18px_-4px_rgba(192,38,211,0.45)] hover:shadow-[0_4px_24px_-4px_rgba(192,38,211,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <MessageSquare size={16} />
              추가 문의하기
            </Link>
          </div>
        </div>
      </div>

      <Modal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="문의 취소"
        className="border border-pink-100/70 bg-gradient-to-b from-white via-rose-50/50 to-fuchsia-50/35 shadow-2xl shadow-pink-200/35 ring-2 ring-white/85"
      >
        <div className="space-y-4">
          <p className="text-sm text-fuchsia-900/80 leading-relaxed">
            이 문의를 취소하면 내역에서 삭제되며 복구할 수 없어요. 취소할까요?
          </p>
          <div className="flex flex-wrap gap-3 justify-end items-center">
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-pink-200/90 bg-white text-sm font-black text-fuchsia-800 hover:bg-fuchsia-50 transition-all"
            >
              <X size={15} />
              닫기
            </button>
            <button
              type="button"
              onClick={handleConfirmCancelInquiry}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 text-white text-sm font-black hover:brightness-105 transition-all min-w-[7rem] shadow-md shadow-rose-300/40"
            >
              문의 취소
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
