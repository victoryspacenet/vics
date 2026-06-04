import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { ArrowLeft, X, CheckCircle2, FolderOpen, Home, Lightbulb } from 'lucide-react'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

export function AppealCompletePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}

  const {
    receiptId = '',
    receiptTime = new Date().toISOString(),
  } = state

  const hasState = receiptId || state.receiptTime
  if (!hasState) {
    return <Navigate to="/inquiry" replace />
  }

  const displayReceiptNo = receiptId ? (receiptId.startsWith('#') ? receiptId : `#${receiptId}`) : '-'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>
        {/* 헤더: 뒤로 + 제목 + X */}
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-[#22282E] flex-1">이의 신청 완료</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
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

          {/* 이의 신청이 정상적으로 접수되었습니다. */}
          <div className="text-center mb-8">
            <h2 className="text-lg font-black text-[#22282E] leading-tight">
              이의 신청이 정상적으로
              <br />
              접수되었습니다.
            </h2>
          </div>

          {/* 접수 정보 */}
          <section className="mb-6">
            <h3 className="text-sm font-bold text-[#22282E] mb-3">접수 정보</h3>
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
              <p className="text-sm text-gray-700">
                <span className="text-gray-500">접수 번호:</span>{' '}
                <span className="font-bold text-[#22282E]">{displayReceiptNo}</span>
              </p>
              <p className="text-sm text-gray-700">
                <span className="text-gray-500">처리 상태:</span>{' '}
                <span className="font-medium text-[#22282E]">검토 대기 중</span>
              </p>
            </div>
          </section>

          {/* 향후 절차 안내 */}
          <section className="mb-6">
            <h3 className="text-sm font-bold text-[#22282E] mb-3">향후 절차 안내</h3>
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                운영팀에서 신청 내용을 면밀히 검토한 뒤{' '}
                <strong className="text-[#22282E]">영업일 기준 3~5일 이내</strong>에
                결과를 알려드립니다.
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                검토 결과는 가입 시 등록하신 <strong className="text-[#22282E]">이메일</strong>과
                {' '}<strong className="text-[#22282E]">앱 내 알림</strong>으로 발송됩니다.
              </p>
            </div>
          </section>

          {/* 알려드립니다 */}
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={18} className="text-amber-600" />
              <span className="text-sm font-bold text-[#22282E]">알려드립니다</span>
            </div>
            <ul className="text-sm text-gray-700 space-y-1.5">
              <li>• 소명이 부족할 경우 추가 자료를 요청할 수 있습니다.</li>
            </ul>
          </div>

          {/* 버튼 */}
          <div className="space-y-3">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] font-bold shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all"
            >
              <Home size={20} />
              메인 화면으로 이동
            </Link>
            <Link
              to="/inquiry/history"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border-2 border-emerald-200 bg-white text-emerald-700 font-bold hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <FolderOpen size={20} />
              문의 내역 확인하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
