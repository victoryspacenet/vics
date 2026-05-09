import { Link, useLocation } from 'react-router-dom'
import { FolderOpen, Plus } from 'lucide-react'

export function PopupNoticeCompletePage() {
  const { state } = useLocation()
  const data = state || {}

  const startAt = data.startAt || ''

  const startDate = startAt ? new Date(startAt) : null
  const now = new Date()
  const isScheduled = startDate && startDate > now
  const statusLabel = isScheduled ? '배포 예약 중' : '노출 중'
  const formatDateTime = (d) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''
  const statusDesc = isScheduled && startDate
    ? `${formatDateTime(startDate)}에 자동으로 노출이 시작됩니다`
    : '현재 팝업이 노출 중입니다'

  return (
    <div className="min-h-screen bg-gray-50 w-full min-w-0">
      <div className="max-w-xl mx-auto w-full">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">[ 운영 관리 ] &gt; 팝업 공지 관리 &gt; <span className="font-bold text-[#22282E]">등록 완료</span></p>
        </div>

        <div className="px-4 py-8">
          {/* 성공 메시지 */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-xl font-black text-[#22282E] mb-2">팝업 공지 등록이 완료되었습니다!</h1>
          </div>

          {/* 상태 카드 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <p className="text-sm font-bold text-[#22282E] mb-2">현재 상태:</p>
            <p className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold mb-2 ${isScheduled ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isScheduled ? '🗓️' : '📢'} {statusLabel}
            </p>
            <p className="text-sm text-gray-600">{statusDesc}</p>
          </div>

          {/* 관리자 액션 안내 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
            <h2 className="text-sm font-black text-[#22282E] mb-3">관리자 액션</h2>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• 등록된 팝업은 <Link to="/admin/notice/popup/list" className="font-bold text-emerald-600 hover:underline">팝업 목록</Link>에서 언제든지 수정하거나 중단할 수 있습니다.</li>
              <li>• 노출이 시작되면 &#39;클릭률&#39; 및 &#39;닫기 비율&#39; 통계가 집계됩니다.</li>
            </ul>
          </div>

          {/* 퀵 버튼 */}
          <div className="space-y-3">
            <Link
              to="/admin/notice/popup/list"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold bg-[#22282E] text-white hover:bg-[#363d46] transition-colors"
            >
              <FolderOpen size={18} />
              전체 팝업 목록으로
            </Link>
            <Link
              to="/admin/notice/popup"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-colors"
            >
              <Plus size={18} />
              새로운 팝업 등록하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
