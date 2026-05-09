import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, X, Trash2, Save, Lock, Mail, Key } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { getOperatorDetail, updateOperator, getPermissionPreset, DEPARTMENTS } from '../../lib/operatorAdminStorage'
import { MENU_ITEMS } from '../../lib/permissionGroupStorage'

export function AdminOperatorEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUIStore()
  const user = useAuthStore((s) => s.user)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [form, setForm] = useState({
    name: '',
    department: '',
    email: '',
    status: 'active',
    permission: 'Editor',
    otpEnabled: false,
    granular: { dashboard: { r: false, w: false, d: false, e: false }, matchups: { r: false, w: false, d: false, e: false }, users: { r: false, w: false, d: false, e: false }, settings: { r: false, w: false, d: false, e: false } },
  })
  const [operator, setOperator] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getOperatorDetail(id).then((op) => {
      if (!op) { setNotFound(true); return }
      setOperator(op)
      setForm({
        name: op.name,
        department: op.department,
        email: op.email,
        status: op.status,
        permission: op.permission,
        otpEnabled: op.otpEnabled,
        granular: JSON.parse(JSON.stringify(op.granular)),
      })
    })
  }, [id])

  // 권한 그룹 변경 시 상세 권한 실시간 동기화 (Custom 제외)
  useEffect(() => {
    if (form.permission === 'Custom') return
    const preset = getPermissionPreset(form.permission)
    if (preset) setForm((prev) => ({ ...prev, granular: JSON.parse(JSON.stringify(preset)) }))
  }, [form.permission])

  const updateForm = (updates) => setForm((prev) => ({ ...prev, ...updates }))

  const setGranular = (menuKey, permKey, value) => {
    setForm((prev) => ({
      ...prev,
      granular: {
        ...prev.granular,
        [menuKey]: { ...prev.granular[menuKey], [permKey]: value },
      },
    }))
  }

  const handleSaveClick = () => {
    setSaveConfirmOpen(true)
  }

  const handleSaveConfirm = async () => {
    setSaveConfirmOpen(false)
    const actorLabel = user?.email || '관리자'
    const ok = await updateOperator(id, form, { actorLabel })
    if (ok) {
      showToast('변경사항이 저장됐어요.', 'success')
      navigate('/admin/settings/operators')
    } else {
      showToast('저장 중 오류가 발생했어요.', 'error')
    }
  }


  const handleSendPasswordReset = () => {
    showToast('비밀번호 재설정 이메일이 발송됐어요.', 'success')
  }

  const openPasswordModal = () => {
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordModalOpen(true)
  }

  const handleNewPasswordBlur = () => {
    if (newPassword.length > 0 && newPassword.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 해요.')
    }
  }

  const handleManualPasswordChange = (e) => {
    e?.preventDefault?.()
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 해요.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('비밀번호가 일치하지 않아요.')
      return
    }
    // TODO: 실제 API 연동 시 Supabase admin API로 비밀번호 변경
    showToast('비밀번호가 변경됐어요.', 'success')
    setPasswordModalOpen(false)
    setNewPassword('')
    setConfirmPassword('')
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

  const isCustom = form.permission === 'Custom'

  return (
    <div className="max-w-4xl">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/settings/operators" className="text-gray-500 hover:text-emerald-600">
            [👤 운영자 관리]
          </Link>
          <ChevronRight size={16} className="text-gray-300" />
          <span className="font-black text-[#22282E]">계정 정보 수정</span>
        </div>
        <Link
          to="/admin/settings/operators"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="닫기"
        >
          <X size={20} />
        </Link>
      </div>

      {/* 1️⃣ 계정 기본 정보 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-base font-bold text-[#22282E] mb-4">1️⃣ 계정 기본 정보 (Read-only & Edit)</h3>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0">아이디(ID):</span>
            <span className="text-[#22282E] font-medium">{operator.id}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">
              <Lock size={12} />
              고정됨
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0">운영자 이름:</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-48"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-600 w-28 shrink-0">담당 부서:</span>
              <select
                value={form.department}
                onChange={(e) => updateForm({ department: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-600 shrink-0">이메일:</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateForm({ email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-48"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0">계정 상태:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                checked={form.status === 'active'}
                onChange={() => updateForm({ status: 'active' })}
                className="w-4 h-4"
              />
              <span>활성</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                checked={form.status === 'suspended'}
                onChange={() => updateForm({ status: 'suspended' })}
                className="w-4 h-4"
              />
              <span>정지 (로그인 차단)</span>
            </label>
          </div>
        </div>
      </section>

      {/* 2️⃣ 보안 관리 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-base font-bold text-[#22282E] mb-4">2️⃣ 보안 관리 (Security)</h3>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0">비밀번호:</span>
            <button
              onClick={handleSendPasswordReset}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold hover:bg-emerald-200"
            >
              <Mail size={16} />
              비밀번호 재설정 이메일 발송
            </button>
            <button
              onClick={openPasswordModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 bg-slate-50/80 text-slate-700 text-sm font-bold hover:border-slate-300 hover:bg-slate-100 transition-all duration-200 shadow-sm"
            >
              <Key size={16} />
              수동 변경
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-bold w-28 shrink-0">최종 접속:</span>
            <span>{operator.lastAccess} (IP: {operator.lastAccessIp})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0">2단계 인증:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.otpEnabled}
                onChange={(e) => updateForm({ otpEnabled: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">OTP 인증 사용 중</span>
            </label>
          </div>
        </div>
      </section>

      {/* 3️⃣ 권한 그룹 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-base font-bold text-[#22282E] mb-4">3️⃣ 권한 그룹 변경 (Current: {form.permission})</h3>
        <div className="flex flex-wrap gap-6">
          {['Master', 'Editor', 'CS_Viewer', 'Custom'].map((role) => (
            <label key={role} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="permission"
                checked={form.permission === role}
                onChange={() => updateForm({ permission: role })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">{role}</span>
            </label>
          ))}
        </div>
      </section>

      {/* 4️⃣ 상세 권한 */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <h3 className="text-base font-bold text-[#22282E] p-5 pb-0">4️⃣ 상세 권한 조정 (Granular Control)</h3>
        <div className="overflow-x-auto p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-bold text-gray-600 w-28">대메뉴</th>
                <th className="text-left py-3 font-bold text-gray-600 w-28">중메뉴</th>
                <th className="text-center py-3 font-bold text-gray-600 w-20">조회(R)</th>
                <th className="text-center py-3 font-bold text-gray-600 w-20">수정(W)</th>
                <th className="text-center py-3 font-bold text-gray-600 w-20">삭제(D)</th>
                <th className="text-center py-3 font-bold text-gray-600 w-20">엑셀(E)</th>
              </tr>
            </thead>
            <tbody>
              {MENU_ITEMS.map((menu) => (
                  <tr key={menu.menuKey} className="border-b border-gray-100">
                    <td className="py-3 font-medium">{menu.menuLabel}</td>
                    <td className="py-3 text-gray-500 text-xs">{menu.subLabel}</td>
                    {['r', 'w', 'd', 'e'].map((permKey) => {
                      const checked = form.granular[menu.menuKey]?.[permKey] ?? false
                      return (
                        <td key={permKey} className="py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setGranular(menu.menuKey, permKey, e.target.checked)}
                            disabled={!isCustom}
                            className="w-4 h-4 rounded"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
          {!isCustom && (
            <p className="text-xs text-gray-500 mt-2">권한 그룹을 Custom으로 변경하면 상세 권한을 직접 조정할 수 있어요.</p>
          )}
        </div>
      </section>

      {/* 하단 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={`/admin/settings/operators/${id}/delete`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-bold hover:bg-red-100"
        >
          <Trash2 size={18} />
          계정 삭제
        </Link>
        <div className="flex gap-3">
          <Link
            to="/admin/settings/operators"
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSaveClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
          >
            <Save size={18} />
            변경사항 저장
          </button>
        </div>
      </div>

      {/* 변경사항 저장 확인 모달 */}
      <Modal
        isOpen={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title="변경사항 저장"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{operator.name}</strong> ({operator.id}) 계정의 변경사항을 저장할까요?
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setSaveConfirmOpen(false)}
              className="px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-600 text-sm font-bold hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              취소
            </button>
            <button
              onClick={handleSaveConfirm}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-all duration-200"
            >
              <Save size={16} />
              저장하기
            </button>
          </div>
        </div>
      </Modal>

      {/* 비밀번호 수동 변경 모달 */}
      <Modal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="비밀번호 수동 변경"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleManualPasswordChange(e) }} className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{operator.name}</strong> ({operator.id}) 계정의 비밀번호를 변경합니다.
          </p>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
              onBlur={handleNewPasswordBlur}
              placeholder="8자 이상 입력"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
              placeholder="다시 입력"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              autoComplete="new-password"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-red-600 font-medium" role="alert">{passwordError}</p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setPasswordModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-600 text-sm font-bold hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 shadow-sm"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 shadow-md shadow-emerald-200/50 transition-all duration-200"
            >
              변경 적용
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
