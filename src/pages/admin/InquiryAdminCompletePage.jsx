import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X, SkipForward, List } from 'lucide-react'
import { getAdminInquiryById, getNextPendingInquiry, getPendingCount } from '../../lib/inquiryAdminStorage'
import { supabase } from '../../lib/supabase'

const isUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''))

function formatElapsed(createdAt, repliedAt) {
  const start = new Date(createdAt).getTime()
  const end = (repliedAt ? new Date(repliedAt) : new Date()).getTime()
  const diffMs = end - start
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${String(hours).padStart(2, '0')}시간 ${String(mins).padStart(2, '0')}분`
  return `${String(mins).padStart(2, '0')}분`
}

export function InquiryAdminCompletePage() {
  const location = useLocation()
  const state = location.state || {}
  const { inquiryId, emailSent } = state

  const [inquiry, setInquiry] = useState(null)
  const [nextPending, setNextPending] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!inquiryId) {
        setInquiry(null)
        setNextPending(null)
        setPendingCount(0)
        setLoading(false)
        return
      }
      let inv = null
      if (isUUID(inquiryId)) {
        const { data } = await supabase
          .from('inquiries')
          .select('id, receipt_id, user_id, created_at')
          .eq('id', inquiryId)
          .maybeSingle()
        if (data) {
          let nickname = '(알 수 없음)'
          if (data.user_id) {
            const { data: prof } = await supabase.from('profiles').select('nickname').eq('id', data.user_id).maybeSingle()
            if (prof?.nickname) nickname = prof.nickname
          }
          inv = {
            id: data.id,
            receiptId: data.receipt_id,
            nickname,
            createdAt: data.created_at,
            repliedAt: new Date().toISOString(),
          }
        }
      } else {
        inv = await getAdminInquiryById(inquiryId)
      }
      const [next, count] = await Promise.all([getNextPendingInquiry(), getPendingCount()])
      if (!cancelled) {
        setInquiry(inv)
        setNextPending(next)
        setPendingCount(count)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inquiryId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중…</p>
      </div>
    )
  }

  if (!inquiry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">발송 정보를 찾을 수 없어요.</p>
          <Link to="/admin/inquiry" className="text-emerald-600 font-bold hover:underline">
            목록으로
          </Link>
        </div>
      </div>
    )
  }

  const receiptDisplay = inquiry.receiptId || inquiry.id || '-'
  const elapsed = formatElapsed(inquiry.createdAt, inquiry.repliedAt)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/notice" className="hover:text-[#22282E]">고객문의 관리</Link>
            <span>/</span>
            <span className="text-[#22282E] font-semibold">답변 발송 결과</span>
          </div>
          <Link
            to="/admin/inquiry"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="닫기"
          >
            <X size={20} />
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <span className="text-3xl">📩</span>
          </div>
          <h1 className="text-xl font-black text-[#22282E] mb-2">답변 발송이 완료되었습니다!</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            문의 번호 <strong>#{receiptDisplay}</strong> 건에 대한 답변이<br />
            {emailSent === true ? (
              <>
                유저(<strong>{inquiry.nickname}</strong>)의 앱 내 알림 및 가입 이메일로 발송되었습니다.
              </>
            ) : emailSent === false ? (
              <>
                유저(<strong>{inquiry.nickname}</strong>)의 앱 내 알림으로 발송되었습니다.
                <span className="block mt-2 text-xs text-gray-500">
                  이메일은 Netlify에 Resend·SERVICE_ROLE 등이 설정된 경우에만 발송됩니다.
                </span>
              </>
            ) : emailSent === null ? (
              <>
                유저(<strong>{inquiry.nickname}</strong>) 문의(목업)에 답변이 저장되었습니다.
                <span className="block mt-2 text-xs text-gray-500">
                  실제 Supabase 문의에서는 앱 알림과(설정 시) 이메일로 발송됩니다.
                </span>
              </>
            ) : (
              <>
                유저(<strong>{inquiry.nickname}</strong>)의 앱 내 알림으로 발송되었습니다.
              </>
            )}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-[#22282E] mb-4">처리 요약 정보</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex justify-between">
              <span className="text-gray-500">처리 상태</span>
              <span className="font-semibold text-emerald-600">답변 완료 (대기 → 완료)</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-500">소요 시간</span>
              <span className="font-semibold">{elapsed} (SLA 준수 ✅)</span>
            </li>
          </ul>
        </div>

        {pendingCount > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 mb-6">
            <p className="text-sm text-gray-700 mb-4">
              현재 처리 대기 중인 문의가 아직 <strong className="text-amber-700">{pendingCount}건</strong> 더 남아있습니다.
            </p>
            {nextPending ? (
              <Link
                to={`/admin/inquiry/${nextPending.id}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-white font-bold shadow-lg hover:shadow-xl transition-all"
              >
                <SkipForward size={20} />
                다음 대기 문의 처리하기
              </Link>
            ) : null}
          </div>
        )}

        <div className="flex justify-center mb-6">
          <Link
            to="/admin/inquiry"
            className="flex items-center gap-2 px-8 py-3 rounded-xl border border-gray-200 bg-white text-base font-bold text-gray-600 hover:bg-gray-50"
          >
            <List size={18} />
            목록으로
          </Link>
        </div>
      </div>
    </div>
  )
}
