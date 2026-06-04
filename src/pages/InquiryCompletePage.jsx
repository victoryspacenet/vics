import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { X, CheckCircle2, FileText, Clock, Bell, FolderOpen, Home, Bot } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

function formatReceiptTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day} ${h}:${min}`
}

export function InquiryCompletePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}

  const {
    categoryLabel = '기타',
    title = '',
    receiptTime = new Date().toISOString(),
    receiptId = '',
    inquiryId = null,
  } = state

  const [autoReply, setAutoReply] = useState(null)

  useEffect(() => {
    if (!inquiryId) return
    // 자동 응대 메시지 조회 (트리거 처리 시간 고려해 약간 지연 후 조회)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('inquiry_replies')
        .select('content')
        .eq('inquiry_id', inquiryId)
        .eq('reply_type', 'auto')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      if (data?.content) setAutoReply(data.content)
    }, 1500)
    return () => clearTimeout(timer)
  }, [inquiryId])

  // 직접 URL 접근 시 문의 메인으로 (state가 없으면)
  const hasState = state.categoryLabel || state.title || state.receiptId
  if (!hasState) {
    return <Navigate to="/inquiry" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>
        {/* 헤더: 로고 + 닫기 */}
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="VictorySpace" width={28} height={28} className="object-contain" />
            <span className="font-black text-base text-[#22282E]">VictorySpace</span>
          </Link>
          <button
            onClick={() => navigate('/inquiry')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#22282E]"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-8">
          {/* ✅ 접수 완료 아이콘 */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={48} className="text-emerald-600" />
            </div>
          </div>

          {/* 문의가 정상적으로 접수되었습니다! */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-black text-[#22282E] leading-tight">
              문의가 정상적으로<br />접수되었습니다!
            </h1>
          </div>

          {/* 문의 내용 요약 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={18} className="text-emerald-600" />
              <span className="text-sm font-bold text-[#22282E]">문의 내용 요약</span>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 shrink-0 w-20">유형</dt>
                <dd className="text-[#22282E] font-medium">{categoryLabel}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 shrink-0 w-20">제목</dt>
                <dd className="text-[#22282E] font-medium break-words">{title || '-'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 shrink-0 w-20">접수시간</dt>
                <dd className="text-[#22282E] font-medium">{formatReceiptTime(receiptTime)}</dd>
              </div>
            </dl>
            {receiptId && (
              <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                접수 번호: {receiptId}
              </p>
            )}
          </div>

          {/* 🤖 자동 응대 메시지 */}
          {autoReply && (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={18} className="text-emerald-600" />
                <span className="text-sm font-bold text-emerald-800">자동 응대 안내</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-600 border border-emerald-200">BOT</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{autoReply}</p>
            </div>
          )}

          {/* ⏰ 답변 안내 — 자동 응대가 없을 때만 표시 */}
          {!autoReply && (
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={18} className="text-amber-600" />
                <span className="text-sm font-bold text-[#22282E]">답변 안내</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                운영진이 내용을 꼼꼼히 확인 중입니다.<br />
                평균 <strong className="text-amber-700">24시간 이내</strong>에 답변을 드려요!
              </p>
              <p className="text-xs text-gray-500 mt-1">(주말/공휴일 제외)</p>
            </div>
          )}

          {/* 푸시 알림 안내 — 자동 응대가 없을 때만 표시 */}
          {!autoReply && (
            <div className="flex items-start gap-2 mb-8 text-sm text-gray-600">
              <Bell size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <p>
                답변이 완료되면 <strong className="text-[#22282E]">앱 푸시 알림</strong>으로
                가장 먼저 알려드릴게요.
              </p>
            </div>
          )}

          {/* 다음 행동 유도 */}
          <div className="space-y-3">
            <Link
              to="/inquiry/history"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white border-2 border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
            >
              <FolderOpen size={20} />
              내 문의 내역 보기
            </Link>
            <Link
              to="/"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-white font-bold shadow-lg shadow-emerald-200/60 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              <Home size={20} />
              홈 화면으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
