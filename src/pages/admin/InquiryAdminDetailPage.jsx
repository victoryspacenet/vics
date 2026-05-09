import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, FileText, Send, Loader2 } from 'lucide-react'
import {
  getAdminInquiryById,
  updateAdminInquiry,
  getReplyTemplates,
  getTemplateBody,
  ADMIN_STATUS,
} from '../../lib/inquiryAdminStorage'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'

const STATUS_LABELS = {
  [ADMIN_STATUS.pending]: '미답변',
  [ADMIN_STATUS.completed]: '완료',
}

/** UUID 형식 여부 확인 */
const isUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

function formatFullDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function InquiryAdminDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useUIStore()

  const [inquiry, setInquiry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [internalMemo, setInternalMemo] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [templates, setTemplates] = useState([])
  const isSbInquiry = isUUID(id)

  useEffect(() => {
    void getReplyTemplates().then(setTemplates)
  }, [])

  useEffect(() => {
    async function load() {
      if (isSbInquiry) {
        // Supabase에서 조회
        const { data } = await supabase
          .from('inquiries')
          .select('id, receipt_id, user_id, category, category_label, title, content, status, image_urls, created_at')
          .eq('id', id)
          .single()
        if (data) {
          // profiles 별도 조회
          let nickname = '(알 수 없음)'
          let userTier = '-'
          let userJoinedAt = null
          if (data.user_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('nickname, tier, created_at')
              .eq('id', data.user_id)
              .single()
            if (prof) {
              nickname = prof.nickname || nickname
              userTier = prof.tier || userTier
              userJoinedAt = prof.created_at
            }
          }

          // inquiry_replies에서 수동 답변 조회
          const { data: replyRow } = await supabase
            .from('inquiry_replies')
            .select('content')
            .eq('inquiry_id', id)
            .eq('reply_type', 'manual')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          setInquiry({
            id: data.id,
            receiptId: data.receipt_id,
            userId: data.user_id || null,
            status: data.status === 'completed' ? ADMIN_STATUS.completed : ADMIN_STATUS.pending,
            category: data.category,
            categoryLabel: data.category_label || data.category,
            title: data.title,
            content: data.content,
            nickname,
            userTier,
            userJoinedAt,
            attachments: data.image_urls || [],
            reply: replyRow?.content || '',
            _source: 'supabase',
          })
          setReply(replyRow?.content || '')
        }
      } else {
        const data = await getAdminInquiryById(id)
        setInquiry(data)
        setReply(data?.reply || '')
        setInternalMemo(data?.internalMemo || '')
      }
      setLoading(false)
    }
    load()
  }, [id, isSbInquiry])

  const handleLoadTemplate = async (templateId) => {
    const body = await getTemplateBody(templateId, inquiry?.nickname)
    setReply(body)
    setTemplateOpen(false)
  }

  const handleSaveDraft = async () => {
    if (isSbInquiry) {
      await supabase.from('inquiry_replies').upsert(
        { inquiry_id: id, reply_type: 'manual', content: reply, replied_by: '운영자' },
        { onConflict: 'inquiry_id,reply_type' }
      )
    } else {
      await updateAdminInquiry(id, { reply, internalMemo, status: inquiry?.status })
    }
    showToast('임시 저장됐어요.', 'success')
  }

  const handleSendClick = () => {
    if (!reply.trim()) {
      showToast('답변 내용을 입력해 주세요.', 'error')
      return
    }
    setSendConfirmOpen(true)
  }

  const handleSendConfirm = async () => {
    setSendConfirmOpen(false)
    let emailSent = false
    if (isSbInquiry) {
      // Supabase: inquiry_replies INSERT + inquiries 상태 완료 (앱 알림은 DB 트리거로 생성)
      const { error: repErr } = await supabase.from('inquiry_replies').insert({
        inquiry_id: id,
        reply_type: 'manual',
        content: reply,
        replied_by: '운영자',
      })
      if (repErr) {
        showToast(repErr.message || '답변 저장에 실패했어요.', 'error')
        return
      }
      const { error: stErr } = await supabase
        .from('inquiries')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (stErr) {
        showToast(stErr.message || '문의 상태 갱신에 실패했어요.', 'error')
        return
      }
      try {
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (token && inquiry?.userId) {
          const r = await fetch('/api/inquiry-reply-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              userId: inquiry.userId,
              receiptId: inquiry.receiptId,
              inquiryTitle: inquiry.title,
              replyText: reply,
            }),
          })
          if (r.ok) {
            const j = await r.json().catch(() => ({}))
            emailSent = Boolean(j.emailSent)
          }
        }
      } catch {
        /* 로컬 Vite만 켠 경우 /api 미프록시 — 무시 */
      }
    } else {
      await updateAdminInquiry(id, {
        reply,
        internalMemo,
        status: ADMIN_STATUS.completed,
        repliedAt: new Date().toISOString(),
      })
    }
    navigate('/admin/inquiry/complete', {
      state: { inquiryId: id, emailSent: isSbInquiry ? emailSent : null },
      replace: true,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!inquiry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">문의를 찾을 수 없어요.</p>
          <Link to="/admin/inquiry" className="text-emerald-600 font-bold hover:underline">
            목록으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/admin/inquiry"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#22282E]"
          >
            <ArrowLeft size={18} />
            목록으로 돌아가기
          </Link>
          <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
            inquiry.status === ADMIN_STATUS.pending ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            상태: {STATUS_LABELS[inquiry.status] ?? inquiry.status}
          </span>
        </div>

        {/* 유저 정보 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <h3 className="text-sm font-bold text-[#22282E] mb-3">유저 정보</h3>
          <p className="text-sm text-gray-600">
            닉네임: <strong>{inquiry.nickname}</strong>
            {inquiry.userLevel ? ` (lv.${inquiry.userLevel})` : ''}
            {inquiry.userTier ? ` | 티어: ${inquiry.userTier}` : ''}
            {inquiry.userJoinedAt ? ` | 가입일: ${formatFullDate(inquiry.userJoinedAt)}` : ''}
          </p>
          {isSbInquiry && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">✓ 실시간 문의 (Supabase)</p>
          )}
        </div>

        {/* Q. 문의 내용 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-[#22282E] mb-3">Q. 문의 내용</h3>
          <p className="text-xs text-gray-500 mb-2">
            [{inquiry.categoryLabel || inquiry.category}] <strong>{inquiry.title}</strong>
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{inquiry.content}</p>
          {inquiry.attachments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {inquiry.attachments.map((url, i) => (
                url.startsWith('http') ? (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`첨부 ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                  </a>
                ) : (
                  <span key={i} className="text-xs text-gray-500">{url}</span>
                )
              ))}
            </div>
          )}
        </div>

        {/* A. 답변 작성 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-[#22282E] mb-3">A. 답변 작성</h3>
          <div className="relative mb-3">
            <button
              onClick={() => setTemplateOpen(!templateOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              <FileText size={16} />
              자주 쓰는 템플릿 불러오기
              <ChevronDown size={14} className={templateOpen ? 'rotate-180' : ''} />
            </button>
            {templateOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTemplateOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-white rounded-lg border shadow-lg z-20 max-h-48 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleLoadTemplate(t.id)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="답변 내용을 입력해 주세요."
            rows={8}
            disabled={inquiry.status === ADMIN_STATUS.completed}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* 내부 메모 (mock 문의만) */}
        {!isSbInquiry && (
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-5 mb-6">
            <h3 className="text-sm font-bold text-[#22282E] mb-2">내부 메모</h3>
            <p className="text-xs text-gray-500 mb-2">(운영자끼리만 공유 가능)</p>
            <textarea
              value={internalMemo}
              onChange={(e) => setInternalMemo(e.target.value)}
              placeholder="예: 결제 담당팀에 확인 요청 완료 - 담당자 김철수"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
            />
          </div>
        )}

        {/* 버튼 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveDraft}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            임시 저장
          </button>
          {inquiry.status !== ADMIN_STATUS.completed && (
            <button
              onClick={handleSendClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
            >
              <Send size={16} />
              답변 완료 및 발송
            </button>
          )}
        </div>
      </div>

      {/* 답변 발송 확인 모달 */}
      <Modal
        isOpen={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        title="답변 완료 및 발송"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong className="text-[#22282E]">{inquiry.nickname}</strong>님의 문의에 답변을 발송하시겠습니까?
            <br />
            <span className="text-gray-500">발송 후 상태가 <strong>완료</strong>로 변경됩니다.</span>
          </p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {reply}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setSendConfirmOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSendConfirm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
            >
              <Send size={15} />
              발송
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
