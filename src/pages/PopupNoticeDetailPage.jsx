import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BarChart3, List, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { useUIStore } from '../store/uiStore'
import { getPopupNotice, deletePopupNotice } from '../lib/popupNoticeStorage'
import { TIERS } from '../lib/tiers'

function formatFrequencyLine(popup) {
  if (popup?.frequency === 'hide_for_day') return '하루동안 보지않기'
  return '매번 노출'
}

function formatPopupTargetLine(popup) {
  const t = popup?.target
  if (t === 'all') return '전체 유저 (신규/기존 포함)'
  if (t === 'new_user') return '신규 유저(가입 7일 이내)'
  if (t === 'tier') {
    const tier = TIERS.find((x) => x.id === popup.targetTierId) || TIERS[0]
    const base = `${tier.emoji} ${tier.name}`
    return popup.targetTierExact === true ? `${base} (해당 티어만)` : `${base} 이상 열람`
  }
  return t || '-'
}

const LINK_LABELS = {
  notice: '상세 공지로 이동',
  matchup: '특정 매치업으로 이동',
  external: '외부 링크',
}

export function PopupNoticeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast, incrementPopupRefresh } = useUIStore()
  const [popup, setPopup] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!id) {
      setPopup(null)
      setLoadState('idle')
      return
    }
    setLoadState('loading')
    void getPopupNotice(id).then((p) => {
      setPopup(p)
      setLoadState(p ? 'ok' : 'missing')
    })
  }, [id])

  const handleDeleteConfirm = async () => {
    if (!id) return
    await deletePopupNotice(id)
    incrementPopupRefresh()
    setDeleteOpen(false)
    showToast('삭제됐어요.', 'success')
    navigate('/admin/notice/popup/list')
  }

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen w-full min-w-0 bg-gray-50">
        <div className="mx-auto w-full max-w-2xl px-4 py-12">
          <p className="text-center text-sm font-medium text-gray-500">불러오는 중…</p>
        </div>
      </div>
    )
  }

  if (!popup) {
    return (
      <div className="min-h-screen bg-gray-50 w-full min-w-0">
        <div className="max-w-2xl mx-auto w-full px-4 py-8">
          <p className="text-gray-500 text-center">팝업을 찾을 수 없어요.</p>
          <Link
            to="/admin/notice/popup/list"
            className="block mt-4 text-center text-sm font-bold text-emerald-600 hover:underline"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const startDate = popup.startAt ? new Date(popup.startAt) : null
  const endDate = popup.endAt ? new Date(popup.endAt) : null
  const now = new Date()
  const isScheduled = startDate && startDate > now
  const isEnded = endDate && endDate < now

  return (
    <div className="min-h-screen bg-gray-50 w-full min-w-0">
      <div className="max-w-2xl mx-auto w-full">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to="/admin/notice/popup/list"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="목록으로"
            >
              <ArrowLeft size={20} />
            </Link>
            <span className="text-sm font-bold text-[#22282E] truncate">{popup.name || '(제목 없음)'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/admin/notice/popup/${id}/stats`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-xl border border-violet-200 bg-white text-violet-800 hover:bg-violet-50 transition-colors"
            >
              <BarChart3 size={16} />
              통계
            </Link>
            <Link
              to="/admin/notice/popup"
              state={{ editPopup: popup }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-xl bg-[#22282E] text-white hover:bg-[#363d46] transition-colors"
            >
              <Pencil size={16} />
              수정
            </Link>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={16} />
              삭제
            </button>
          </div>
        </div>

        <div className="px-4 py-6 space-y-6">
          {/* 이미지 미리보기 */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {popup.imageUrl ? (
              <div className="aspect-[3/4] max-h-[80vh] overflow-hidden">
                <img src={popup.imageUrl} alt={popup.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[3/4] flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                이미지 없음
              </div>
            )}
          </div>

          {/* 상태 및 기본 정보 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
            <h2 className="text-sm font-black text-[#22282E]">기본 정보</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">상태</p>
                <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${
                  isScheduled ? 'bg-amber-100 text-amber-700' :
                  isEnded ? 'bg-gray-100 text-gray-500' :
                  popup.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isScheduled ? '배포 예약 중' : isEnded ? '종료됨' : popup.isActive ? '노출 중' : '비활성'}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">노출 기간</p>
                <p className="text-sm font-medium text-gray-800">
                  {startDate?.toLocaleString('ko-KR')} ~ {endDate?.toLocaleString('ko-KR')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">노출 대상</p>
                <p className="text-sm font-medium text-gray-800">{formatPopupTargetLine(popup)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">노출 빈도</p>
                <p className="text-sm font-medium text-gray-800">{formatFrequencyLine(popup)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">클릭 시 이동</p>
                <p className="text-sm font-medium text-gray-800">
                  {LINK_LABELS[popup.linkType] || popup.linkType}
                  {popup.linkType === 'external' && popup.linkUrl && (
                    <span className="block mt-1 text-xs text-gray-500 truncate">{popup.linkUrl}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 목록으로 */}
          <Link
            to="/admin/notice/popup/list"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-50 to-indigo-50 text-sky-700 hover:from-sky-100 hover:to-indigo-100 border border-sky-100 hover:border-sky-200 transition-all shadow-sm hover:shadow"
          >
            <List size={18} className="shrink-0" />
            목록으로 돌아가기
          </Link>
        </div>
      </div>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        className="max-w-[min(22rem,calc(100vw-2rem))]"
        bodyClassName="p-0"
      >
        <div className="p-6 pt-5">
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-2 ring-red-100">
              <AlertTriangle size={26} className="text-red-500" strokeWidth={2.25} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black tracking-tight text-[#22282E]">이 팝업을 삭제할까요?</h3>
              <p className="text-sm font-medium leading-relaxed text-gray-500">
                삭제하면 복구할 수 없어요. 노출·통계 기록도 함께 사라져요.
              </p>
              {popup?.name && (
                <p className="truncate text-xs font-bold text-gray-400">&ldquo;{popup.name}&rdquo;</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-gray-200/90 bg-white py-2.5 text-sm font-black text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-black text-white shadow-md shadow-red-500/25 transition hover:bg-red-700"
              >
                <Trash2 size={16} />
                삭제하기
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
