import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Zap, X } from 'lucide-react'
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
import { saveInquirySatisfaction, getInquirySatisfaction } from '../lib/inquirySatisfactionStorage'
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
    label: '답변완료',
    badge: 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/60',
  },
}

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
  const [satisfaction, setSatisfaction] = useState(null)
  const [satisfactionSubmitted, setSatisfactionSubmitted] = useState(false)

  useEffect(() => {
    const id = inquiry?.receiptId || inquiry?.id
    if (!id || !user?.id) {
      setSatisfaction(null)
      return
    }
    void getInquirySatisfaction(id, user.id).then((v) => setSatisfaction(v))
  }, [inquiry?.receiptId, inquiry?.id, user?.id])
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [autoReplyMessage, setAutoReplyMessage] = useState(null)

  useEffect(() => {
    const rid = inquiry?.receiptId || inquiry?.id
    if (!rid) return
    async function fetchAutoReply() {
      const { data: inqRow } = await supabase
        .from('inquiries')
        .select('id')
        .eq('receipt_id', rid)
        .maybeSingle()
      if (!inqRow?.id) return
      const { data: replyRow } = await supabase
        .from('inquiry_replies')
        .select('content')
        .eq('inquiry_id', inqRow.id)
        .eq('reply_type', 'auto')
        .maybeSingle()
      if (replyRow?.content) setAutoReplyMessage(replyRow.content)
    }
    fetchAutoReply()
  }, [inquiry?.receiptId, inquiry?.id])

  const hasAutoReply = !!autoReplyMessage

  const isReplied = status === INQUIRY_STATUS.replied
  const hasReply = isReplied && inquiry?.reply

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

  const handleSatisfaction = async (value) => {
    if (satisfactionSubmitted || satisfaction) return
    const id = inquiry?.receiptId || inquiry?.id
    if (id && user?.id) {
      const ok = await saveInquirySatisfaction(id, value, user.id)
      if (ok) {
        setSatisfaction(value)
        setSatisfactionSubmitted(true)
      }
    }
  }

  if (authLoading) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <p className="text-sm text-fuchsia-700/80">불러오는 중…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <p className="text-sm text-fuchsia-800">로그인이 필요해요.</p>
      </div>
    )
  }

  if (inquiryLoading) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <p className="text-sm text-fuchsia-700/80">불러오는 중…</p>
      </div>
    )
  }

  if (!inquiry && loadErr) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <p className="text-sm font-medium text-fuchsia-800/75 mb-4">해당 문의를 찾을 수 없어요.</p>
          <Link
            to="/inquiry/history"
            className="inline-flex items-center justify-center gap-1 text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
          >
            문의 내역으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen', PAGE_BG)}>
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-3', HEADER_GLASS)}>
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-fuchsia-900" />
          </button>
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 line-clamp-1 tracking-tight">문의 답변 상세</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          {/* 상태 배지 + 날짜/유형 */}
          <div className="flex flex-wrap items-center gap-2">
            {status && (
              <span
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-black',
                  STATUS_CONFIG[status]?.badge || STATUS_CONFIG[INQUIRY_STATUS.received].badge
                )}
              >
                {STATUS_CONFIG[status]?.label || '대기중'}
              </span>
            )}
            <span className="text-sm font-medium text-fuchsia-700/65">
              {formatCardDate(inquiry.receiptTime || inquiry.createdAt)} | {inquiry.categoryLabel || inquiry.category}
            </span>
          </div>

          {/* 문의 내용 */}
          <div className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
            <h3 className="text-[11px] font-black text-fuchsia-500/80 uppercase tracking-wider mb-2">문의 내용</h3>
            <p className="text-sm font-black text-fuchsia-950 mb-2">{inquiry.title}</p>
            <p className="text-sm text-fuchsia-900/85 whitespace-pre-wrap leading-relaxed">
              {inquiry.content || inquiry.title || '-'}
            </p>
          </div>

          {/* VICTORYSPACE 답변 (답변완료 시) */}
          {hasReply ? (
            <div
              className={cn(
                SECTION_CARD,
                'p-5 border-emerald-200/55 bg-gradient-to-br from-emerald-50/95 via-teal-50/70 to-cyan-50/50 shadow-[0_8px_32px_-14px_rgba(16,185,129,0.2)]'
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/90 border border-emerald-200/60 flex items-center justify-center shadow-sm">
                  <Zap size={18} className="text-emerald-600" />
                </div>
                <span className="text-sm font-black text-fuchsia-950">VICTORYSPACE 답변</span>
              </div>
              <p className="text-sm text-fuchsia-900/88 whitespace-pre-wrap leading-relaxed">
                {inquiry.reply}
              </p>
            </div>
          ) : hasAutoReply ? (
            /* 자동응대 메시지 */
            <div
              className={cn(
                SECTION_CARD,
                'p-5 border-emerald-200/55 bg-gradient-to-br from-emerald-50/95 via-teal-50/70 to-cyan-50/50 shadow-[0_8px_32px_-14px_rgba(16,185,129,0.2)]'
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/90 border border-emerald-200/60 flex items-center justify-center shadow-sm">
                  <Zap size={18} className="text-emerald-600" />
                </div>
                <span className="text-sm font-black text-fuchsia-950">VICTORYSPACE 답변</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600 border border-emerald-200">AUTO</span>
              </div>
              <p className="text-sm text-fuchsia-900/88 whitespace-pre-wrap leading-relaxed">
                {autoReplyMessage}
              </p>
            </div>
          ) : (
            /* 답변 대기 시 (자동응대 없을 때) */
            <div
              className={cn(
                SECTION_CARD,
                'p-4 space-y-3 border-amber-200/50 bg-gradient-to-br from-amber-50/95 via-orange-50/40 to-rose-50/30'
              )}
            >
              <p className="text-sm text-fuchsia-900/85 leading-relaxed">
                운영진이 내용을 확인 중입니다. 평균{' '}
                <strong className="text-amber-700 font-black">24시간 이내</strong>에 답변을 드려요.
              </p>
              <p className="text-xs text-fuchsia-700/55">(주말/공휴일 제외)</p>
              {canCancelInquiry && (
                <button
                  type="button"
                  onClick={() => setCancelConfirmOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border-2 border-amber-300/80 bg-white/95 text-sm font-black text-amber-950 shadow-sm hover:bg-amber-50 hover:border-amber-400 transition-colors ring-1 ring-white/60"
                >
                  문의 취소
                </button>
              )}
            </div>
          )}

          {/* 만족도 체크 (답변완료 시) */}
          {hasReply && (
            <div className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
              <p className="text-sm font-black text-fuchsia-950 mb-4">답변이 도움이 되었나요?</p>
              {satisfactionSubmitted || satisfaction ? (
                <p className="flex flex-row items-center justify-center sm:justify-start text-sm font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-200/50 rounded-xl px-4 py-3 w-full whitespace-nowrap [word-break:keep-all]">
                  감사합니다! 피드백이 반영돼요.
                </p>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleSatisfaction('good')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-pink-200/80 bg-white/95 hover:border-emerald-300 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-teal-50/80 transition-all font-black shadow-sm"
                  >
                    <span className="text-2xl">👍</span>
                    <span className="text-sm text-fuchsia-900">최고</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSatisfaction('bad')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-pink-200/80 bg-white/95 hover:border-rose-300 hover:bg-rose-50/90 transition-all font-black shadow-sm"
                  >
                    <span className="text-2xl">👎</span>
                    <span className="text-sm text-fuchsia-900">아쉬워요</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center py-3">
            <Link
              to="/inquiry/form"
              className="inline-flex flex-row items-center text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2 whitespace-nowrap [word-break:keep-all]"
            >
              추가 문의하기 →
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
