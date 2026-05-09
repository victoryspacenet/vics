import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, X, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { getOperatorDetail, deleteOperator } from '../../lib/operatorAdminStorage'

export function AdminOperatorDeletePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUIStore()
  const user = useAuthStore((s) => s.user)
  const [adminPassword, setAdminPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [notifyTarget, setNotifyTarget] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [operator, setOperator] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getOperatorDetail(id).then((op) => {
      if (!op) setNotFound(true)
      else setOperator(op)
    })
  }, [id])

  const handleDeleteClick = () => {
    setPasswordError('')
    if (!adminPassword.trim()) {
      setPasswordError('관리자 비밀번호를 입력해주세요.')
      return
    }
    setConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setConfirmOpen(false)
    const ok = await deleteOperator(id, { actorLabel: user?.email || '관리자' })
    if (ok) {
      showToast('계정이 삭제됐어요.', 'success')
      navigate('/admin/settings/operators')
    } else {
      showToast('삭제 중 오류가 발생했어요.', 'error')
    }
  }

  if (notFound) {
    return (
      <div className="max-w-3xl">
        <p className="text-gray-500">운영자를 찾을 수 없어요.</p>
        <Link to="/admin/settings/operators" className="text-emerald-600 font-bold hover:underline mt-2 inline-block">
          ← 목록으로
        </Link>
      </div>
    )
  }

  if (!operator) {
    return <div className="py-20 text-center text-gray-400 text-sm">불러오는 중...</div>
  }

  return (
    <div className="max-w-2xl">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/settings/operators" className="text-gray-500 hover:text-emerald-600">
            [👤 운영자 관리]
          </Link>
          <ChevronRight size={16} className="text-gray-300" />
          <span className="font-black text-[#22282E]">계정 삭제 확인</span>
        </div>
        <Link
          to={`/admin/settings/operators/${id}`}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="닫기"
        >
          <X size={20} />
        </Link>
      </div>

      {/* 경고 */}
      <section className="bg-amber-50 rounded-xl border border-amber-200 p-5 mb-6">
        <h2 className="text-base font-bold text-amber-800 mb-2">⚠️ 정말로 이 계정을 삭제하시겠습니까?</h2>
        <p className="text-sm text-amber-700">
          삭제된 계정은 어드민 접속이 즉시 차단되며, 다시 복구할 수 없습니다.
        </p>
      </section>

      {/* 삭제 대상 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-bold text-[#22282E] mb-3">삭제 대상 계정</h3>
        <ul className="space-y-2 text-sm">
          <li>아이디: <strong className="text-[#22282E]">{operator.id}</strong></li>
          <li>이름: <strong className="text-[#22282E]">{operator.name}</strong> ({operator.department} / {operator.permission})</li>
        </ul>
      </section>

      {/* 삭제 전 확인 사항 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-bold text-[#22282E] mb-3">💡 삭제 전 확인 사항</h3>
        <ol className="space-y-3 text-sm text-gray-600 list-decimal list-inside">
          <li>
            <strong className="text-[#22282E]">활동 이력 보존:</strong> 해당 운영자가 작성한 매치업, 조치 이력, 로그 데이터는
            삭제되지 않고 시스템에 영구 보관됩니다.
          </li>
          <li>
            <strong className="text-[#22282E]">대체 담당자 지정:</strong> 이 운영자가 관리하던 예약 작업이나 자동화 시나리오가
            있다면 다른 운영자에게 권한을 인계했는지 확인하세요.
          </li>
        </ol>
      </section>

      {/* 삭제 승인 확인 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-bold text-[#22282E] mb-2">삭제 승인 확인</h3>
        <p className="text-sm text-gray-600 mb-3">보안을 위해 현재 로그인한 관리자의 비밀번호를 입력해주세요.</p>
        <div>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => { setAdminPassword(e.target.value); setPasswordError('') }}
            placeholder="관리자 비밀번호"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
            autoComplete="current-password"
          />
          <p className="text-xs text-gray-500 mt-1">(필수 입력)</p>
          {passwordError && (
            <p className="text-sm text-red-600 font-medium mt-2">{passwordError}</p>
          )}
        </div>
      </section>

      {/* 피삭제자 알림 설정 */}
      <section className="mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyTarget}
            onChange={(e) => setNotifyTarget(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-gray-600">삭제 전 피삭제자에게 이메일 알림 발송</span>
        </label>
      </section>

      {/* 하단 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={`/admin/settings/operators/${id}`}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/80 text-emerald-700 text-sm font-bold hover:border-emerald-300 hover:bg-emerald-100 transition-all duration-200 shadow-sm"
        >
          취소 (유지하기)
        </Link>
        <button
          onClick={handleDeleteClick}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-600 shadow-md shadow-red-200/50 transition-all duration-200"
        >
          <Trash2 size={18} />
          삭제 승인
        </button>
      </div>

      {/* 최종 삭제 확인 모달 */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="최종 삭제 확인"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong className="text-red-600">{operator?.name}</strong> ({operator?.id}) 계정을 최종 삭제합니다.
            <br />
            <span className="text-red-600 font-medium">이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?</span>
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-600 text-sm font-bold hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              취소
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 text-white text-sm font-bold hover:bg-red-600 transition-all duration-200"
            >
              <Trash2 size={16} />
              최종 삭제
            </button>
          </div>
        </div>
      </Modal>

      {/* 하단 유의사항 */}
      <p className="mt-6 text-xs text-gray-500 leading-relaxed">
        * 만약 퇴사자가 아닌 휴직자라면, 삭제 대신{' '}
        <Link to={`/admin/settings/operators/${id}`} className="text-emerald-600 font-bold hover:underline">
          [계정 정지]
        </Link>
        {' '}상태로 변경하는 것을 권장합니다.
      </p>
    </div>
  )
}
