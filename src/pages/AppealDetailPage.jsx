import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Home, FolderOpen, ImageIcon, X } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import {
  getInquiryByReceiptId,
  getInquiryHistoryForDisplay,
  getDisplayStatus,
  removeInquiryByReceiptId,
  INQUIRY_STATUS,
} from '../lib/inquiryStorage'
import { saveInquirySatisfaction, getInquirySatisfaction } from '../lib/inquirySatisfactionStorage'
import { getAppealFollowUps, addAppealFollowUp, removeAppealFollowUpsForReceipt } from '../lib/appealFollowUpStorage'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

/** MZ 파스텔 — 문의·이의 내역과 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const STATUS_CONFIG = {
  [INQUIRY_STATUS.received]: {
    label: '검토 중',
    badge: 'bg-amber-100/90 text-amber-900 border border-amber-200/60',
  },
  [INQUIRY_STATUS.processing]: {
    label: '검토 중',
    badge: 'bg-amber-100/90 text-amber-900 border border-amber-200/60',
  },
  [INQUIRY_STATUS.replied]: {
    label: '✅ 답변 완료',
    badge: 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/60',
  },
}

function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = d.getHours()
  const ampm = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 || 12
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${hour12}:${min} ${ampm}`
}

function formatShortTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const h = d.getHours()
  const ampm = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 || 12
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${hour12}:${min} ${ampm}`
}

export function AppealDetailPage() {
  const navigate = useNavigate()
  const { receiptId } = useParams()
  const { showToast } = useUIStore()
  const { user, loading: authLoading } = useAuthStore()
  const [inquiry, setInquiry] = useState(null)
  const [history, setHistory] = useState([])
  const [inquiryLoading, setInquiryLoading] = useState(true)
  const [followUps, setFollowUps] = useState([])
  const [followUpRefreshKey, setFollowUpRefreshKey] = useState(0)

  useEffect(() => {
    if (!receiptId || !user?.id) {
      setInquiry(null)
      setHistory([])
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
      setInquiryLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [receiptId, user?.id])

  const index = inquiry ? history.findIndex((h) => (h.receiptId || h.id) === (inquiry.receiptId || inquiry.id)) : -1
  const status = inquiry ? getDisplayStatus(inquiry, index >= 0 ? index : 0) : null

  useEffect(() => {
    let cancelled = false
    const id = inquiry?.receiptId || inquiry?.id
    if (id) {
      getAppealFollowUps(id).then((list) => {
        if (!cancelled) setFollowUps(list)
      })
    } else {
      setFollowUps([])
    }
    return () => {
      cancelled = true
    }
  }, [inquiry?.receiptId, inquiry?.id, receiptId, followUpRefreshKey])

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
  const [followUpContent, setFollowUpContent] = useState('')
  const [followUpSending, setFollowUpSending] = useState(false)
  const [followUpConfirmOpen, setFollowUpConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  const isReplied = status === INQUIRY_STATUS.replied
  const hasReply = isReplied && inquiry?.reply

  const canCancelAppeal =
    status === INQUIRY_STATUS.received && !inquiry?._virtual && !hasReply

  const handleConfirmCancelAppeal = async () => {
    const id = inquiry?.receiptId || inquiry?.id
    if (!id || !user?.id) return
    const ok = await removeInquiryByReceiptId(id, user.id)
    setCancelConfirmOpen(false)
    if (ok) {
      await removeAppealFollowUpsForReceipt(id)
      showToast('이의제기가 취소되었어요.', 'success')
      navigate('/inquiry/history', { replace: true })
    } else {
      showToast('이의제기를 취소할 수 없어요.', 'error')
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

  const handleFollowUpSubmit = (e) => {
    e?.preventDefault()
    if (!followUpContent.trim() || !inquiry) return
    setFollowUpConfirmOpen(true)
  }

  const handleFollowUpConfirm = async () => {
    if (!followUpContent.trim() || !inquiry) return
    const id = inquiry.receiptId || inquiry.id
    setFollowUpConfirmOpen(false)
    setFollowUpSending(true)
    await addAppealFollowUp(id, followUpContent.trim())
    setFollowUpContent('')
    setFollowUpSending(false)
    setFollowUpRefreshKey((k) => k + 1)
    showToast('추가 이의제기가 전송됐어요.', 'success')
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

  if (!inquiry || inquiry.category !== 'appeal') {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <p className="text-sm font-medium text-fuchsia-800/75 mb-4">해당 이의제기를 찾을 수 없어요.</p>
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

  const displayReceiptNo = (inquiry.receiptId || inquiry.id)?.startsWith('#')
    ? inquiry.receiptId || inquiry.id
    : `#${inquiry.receiptId || inquiry.id}`

  return (
    <div className={cn('min-h-screen', PAGE_BG)}>
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>
        {/* 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-3', HEADER_GLASS)}>
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-fuchsia-900" />
          </button>
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 tracking-tight">이의제기 내역</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          {/* 이의제기 요약 */}
          <section>
            <h2 className="text-sm font-black text-fuchsia-950 mb-3 tracking-tight">이의제기 요약</h2>
            <div className={cn(SECTION_CARD, 'p-4 space-y-2.5 border-pink-100/70')}>
              <p className="text-sm text-fuchsia-900/85">
                <span className="text-fuchsia-600/75 font-semibold">상태</span>{' '}
                <span
                  className={cn(
                    'font-black px-2.5 py-1 rounded-xl text-xs inline-flex items-center',
                    STATUS_CONFIG[status]?.badge || STATUS_CONFIG[INQUIRY_STATUS.received].badge
                  )}
                >
                  {STATUS_CONFIG[status]?.label || '검토 중'}
                </span>
              </p>
              <p className="text-sm text-fuchsia-900/85">
                <span className="text-fuchsia-600/75 font-semibold">번호</span>{' '}
                <span className="font-bold text-fuchsia-950">{displayReceiptNo}</span>
              </p>
              <p className="text-sm text-fuchsia-900/85">
                <span className="text-fuchsia-600/75 font-semibold">접수</span>{' '}
                <span className="font-medium">{formatDateTime(inquiry.receiptTime || inquiry.createdAt)}</span>
              </p>
            </div>
          </section>

          {!hasReply && canCancelAppeal && (
            <div
              className={cn(
                SECTION_CARD,
                'p-4 space-y-3 border-amber-200/50 bg-gradient-to-br from-amber-50/95 via-orange-50/40 to-rose-50/30'
              )}
            >
              <p className="text-sm text-fuchsia-900/85 leading-relaxed">
                운영진이 내용을 검토 중입니다. 평균 <strong className="text-amber-700 font-black">48시간 이내</strong>에 답변을 드려요.
              </p>
              <p className="text-xs text-fuchsia-700/55">(주말/공휴일 제외)</p>
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border-2 border-amber-300/80 bg-white/95 text-sm font-black text-amber-950 shadow-sm hover:bg-amber-50 hover:border-amber-400 transition-colors ring-1 ring-white/60"
              >
                이의제기 취소
              </button>
            </div>
          )}

          {/* 대화 내역 */}
          <section>
            <h2 className="text-sm font-black text-fuchsia-950 mb-4 tracking-tight">대화 내역</h2>
            <div className="space-y-4">
              {/* (나) 유저 질문 */}
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <p className="text-xs font-black text-fuchsia-600/80 mb-1">(나)</p>
                  <div className="rounded-2xl rounded-tl-md px-4 py-3 border border-pink-200/60 bg-gradient-to-br from-fuchsia-50/95 via-rose-50/50 to-white/90 shadow-sm shadow-pink-200/20">
                    <p className="text-sm font-black text-fuchsia-950 mb-1">{inquiry.title}</p>
                    <p className="text-sm text-fuchsia-900/85 whitespace-pre-wrap leading-relaxed">
                      {inquiry.content || '-'}
                    </p>
                    {inquiry.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {inquiry.attachments.map((att, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-white/90 border border-pink-100/80 text-xs font-medium text-fuchsia-800/80"
                          >
                            <ImageIcon size={14} className="text-fuchsia-500 shrink-0" />
                            {att}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-fuchsia-600/45 font-medium mt-1">
                    {formatShortTime(inquiry.receiptTime || inquiry.createdAt)}
                  </p>
                </div>
              </div>

              {/* (운영진) 답변 */}
              {hasReply && (
                <div className="flex justify-end">
                  <div className="max-w-[85%]">
                    <p className="text-xs font-black text-emerald-700 mb-1 text-right">(운영진) VS-관리자</p>
                    <div className="rounded-2xl rounded-tr-md px-4 py-3 border border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-teal-50/75 to-cyan-50/50 shadow-sm shadow-emerald-200/25">
                      <p className="text-sm text-fuchsia-900/88 whitespace-pre-wrap leading-relaxed">
                        {inquiry.reply}
                      </p>
                    </div>
                    <p className="text-xs text-fuchsia-600/45 font-medium mt-1 text-right">
                      {formatShortTime(inquiry.replyAt || inquiry.createdAt)}
                    </p>
                  </div>
                </div>
              )}

              {/* 추가 이의제기 내역 */}
              {followUps.map((msg, i) => (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%]">
                    <p className="text-xs font-black text-fuchsia-600/80 mb-1">(나)</p>
                    <div className="rounded-2xl rounded-tl-md px-4 py-3 border border-pink-200/60 bg-gradient-to-br from-fuchsia-50/95 via-rose-50/50 to-white/90 shadow-sm shadow-pink-200/20">
                      <p className="text-sm text-fuchsia-900/85 whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                    <p className="text-xs text-fuchsia-600/45 font-medium mt-1">
                      {formatShortTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 만족도 평가 (답변완료 시) */}
          {hasReply && (
            <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
              <p className="text-sm font-black text-fuchsia-950 mb-3">이 답변이 도움이 되셨나요?</p>
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
                    <span className="text-sm text-fuchsia-900">만족</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSatisfaction('bad')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-pink-200/80 bg-white/95 hover:border-rose-300 hover:bg-rose-50/90 transition-all font-black shadow-sm"
                  >
                    <span className="text-2xl">👎</span>
                    <span className="text-sm text-fuchsia-900">불만족</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 추가 이의제기 (선택) */}
          {hasReply && (
            <>
              <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
                <p className="text-sm font-black text-fuchsia-950 mb-2">추가 이의제기 (선택)</p>
                <form onSubmit={handleFollowUpSubmit} className="space-y-3">
                  <textarea
                    value={followUpContent}
                    onChange={(e) => setFollowUpContent(e.target.value)}
                    placeholder="추가로 전달할 내용이 있으시면 입력해 주세요."
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl border border-pink-200/80 bg-white/95 text-sm text-fuchsia-950 placeholder:text-fuchsia-300/90 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/50 focus:border-fuchsia-400 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!followUpContent.trim() || followUpSending}
                    className="w-full py-2.5 rounded-2xl border-2 border-emerald-300/80 text-emerald-800 font-black bg-white/90 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm ring-1 ring-white/50"
                  >
                    추가 전송
                  </button>
                </form>
              </section>

              {/* 추가 전송 확인 모달 */}
              <Modal
                isOpen={followUpConfirmOpen}
                onClose={() => setFollowUpConfirmOpen(false)}
                title="추가 이의제기 전송"
                className="border border-pink-100/70 bg-gradient-to-b from-white via-rose-50/50 to-fuchsia-50/35 shadow-2xl shadow-pink-200/35 ring-2 ring-white/85"
              >
                <div className="space-y-4">
                  <p className="text-sm text-fuchsia-900/80 leading-relaxed">
                    추가 이의제기 내용을 전송하시겠습니까?
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFollowUpConfirmOpen(false)}
                      className="flex-1 py-2.5 rounded-2xl border-2 border-pink-200/90 text-fuchsia-800 font-black bg-white hover:bg-fuchsia-50 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleFollowUpConfirm}
                      className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] font-black shadow-md shadow-emerald-300/40 hover:shadow-lg active:scale-[0.98] transition-all ring-1 ring-white/50"
                    >
                      전송
                    </button>
                  </div>
                </div>
              </Modal>
            </>
          )}

          {/* 하단 버튼 */}
          <div className="flex gap-3 pt-4">
            <Link
              to="/"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] font-black shadow-md shadow-emerald-300/45 hover:shadow-lg active:scale-[0.98] transition-all ring-1 ring-white/50"
            >
              <Home size={20} strokeWidth={2.25} />
              홈으로
            </Link>
            <Link
              to="/inquiry/history"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-pink-200/90 bg-white/95 text-fuchsia-800 font-black hover:bg-fuchsia-50 hover:border-fuchsia-300/70 transition-colors shadow-sm"
            >
              <FolderOpen size={20} strokeWidth={2.25} className="text-fuchsia-600" />
              목록보기
            </Link>
          </div>
        </div>
      </div>

      <Modal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="이의제기 취소"
        className="border border-pink-100/70 bg-gradient-to-b from-white via-rose-50/50 to-fuchsia-50/35 shadow-2xl shadow-pink-200/35 ring-2 ring-white/85"
      >
        <div className="space-y-4">
          <p className="text-sm text-fuchsia-900/80 leading-relaxed">
            이의제기를 취소하면 내역에서 삭제되며 복구할 수 없어요. 취소할까요?
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
              onClick={handleConfirmCancelAppeal}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 text-white text-sm font-black hover:brightness-105 transition-all min-w-[7rem] shadow-md shadow-rose-300/40"
            >
              이의제기 취소
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
