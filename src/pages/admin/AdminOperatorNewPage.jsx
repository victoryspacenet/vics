import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, X, Save, UserPlus } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { addOperator, getPermissionPreset, DEPARTMENTS } from '../../lib/operatorAdminStorage'
import { MENU_ITEMS } from '../../lib/permissionGroupStorage'

const DEFAULT_GRANULAR = {
  dashboard: { r: false, w: false, d: false, e: false },
  matchups:  { r: false, w: false, d: false, e: false },
  users:     { r: false, w: false, d: false, e: false },
  settings:  { r: false, w: false, d: false, e: false },
}

export function AdminOperatorNewPage() {
  const navigate = useNavigate()
  const { showToast } = useUIStore()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [form, setForm] = useState({
    id: '',
    name: '',
    department: DEPARTMENTS[0],
    email: '',
    password: '',
    confirmPassword: '',
    status: 'active',
    permission: 'Editor',
    otpEnabled: false,
    granular: JSON.parse(JSON.stringify(DEFAULT_GRANULAR)),
  })

  const [errors, setErrors] = useState({})

  // 권한 그룹 변경 시 상세 권한 자동 동기화 (Custom 제외)
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

  const validate = () => {
    const newErrors = {}
    if (!form.id.trim()) newErrors.id = '아이디를 입력해주세요.'
    else if (!/^[a-zA-Z0-9_]{4,20}$/.test(form.id.trim())) newErrors.id = '아이디는 영문·숫자·언더바 4~20자로 입력해주세요.'
    if (!form.name.trim()) newErrors.name = '이름을 입력해주세요.'
    if (!form.email.trim()) newErrors.email = '이메일을 입력해주세요.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) newErrors.email = '올바른 이메일 형식이 아니에요.'
    if (!form.password) newErrors.password = '비밀번호를 입력해주세요.'
    else if (form.password.length < 8) newErrors.password = '비밀번호는 8자 이상이어야 해요.'
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = '비밀번호가 일치하지 않아요.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRegisterClick = () => {
    if (!validate()) return
    setConfirmOpen(true)
  }

  const handleRegisterConfirm = async () => {
    setConfirmOpen(false)
    const result = await addOperator(form)
    if (result.ok) {
      showToast(`${form.name} 계정이 등록됐어요.`, 'success')
      navigate('/admin/settings/operators')
    } else {
      const hint = result.error?.includes('last_access_at') || result.error?.includes('column')
        ? ' DB 마이그레이션(supabase_admin_operator_dormancy_and_security_log.sql 등) 적용 여부를 확인해 주세요.'
        : ''
      showToast(`등록에 실패했어요.${hint} ${result.error || ''}`.trim(), 'error')
    }
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
          <span className="font-black text-[#22282E]">신규 계정 등록</span>
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
        <h3 className="text-base font-bold text-[#22282E] mb-4">1️⃣ 계정 기본 정보</h3>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-2">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0 pt-2">아이디(ID):</span>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={form.id}
                onChange={(e) => { updateForm({ id: e.target.value }); setErrors((p) => ({ ...p, id: '' })) }}
                placeholder="예) admin_03 (영문·숫자·언더바 4~20자)"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${errors.id ? 'border-red-400 focus:ring-red-500/30' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
              />
              {errors.id && <p className="text-xs text-red-500 mt-1">{errors.id}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0 pt-2">운영자 이름:</span>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={form.name}
                onChange={(e) => { updateForm({ name: e.target.value }); setErrors((p) => ({ ...p, name: '' })) }}
                placeholder="실명 입력"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${errors.name ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
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
            <div className="flex items-start gap-2 flex-1 min-w-[200px]">
              <span className="text-sm font-bold text-gray-600 shrink-0 pt-2">이메일:</span>
              <div className="flex-1">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => { updateForm({ email: e.target.value }); setErrors((p) => ({ ...p, email: '' })) }}
                  placeholder="example@vsmatch.com"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${errors.email ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
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

      {/* 2️⃣ 초기 비밀번호 설정 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-base font-bold text-[#22282E] mb-4">2️⃣ 초기 비밀번호 설정</h3>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-2">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0 pt-2">비밀번호:</span>
            <div className="flex-1 min-w-[200px]">
              <input
                type="password"
                value={form.password}
                onChange={(e) => { updateForm({ password: e.target.value }); setErrors((p) => ({ ...p, password: '' })) }}
                placeholder="8자 이상 입력"
                autoComplete="new-password"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${errors.password ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <span className="text-sm font-bold text-gray-600 w-28 shrink-0 pt-2">비밀번호 확인:</span>
            <div className="flex-1 min-w-[200px]">
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => { updateForm({ confirmPassword: e.target.value }); setErrors((p) => ({ ...p, confirmPassword: '' })) }}
                placeholder="다시 입력"
                autoComplete="new-password"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${errors.confirmPassword ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
              />
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>
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
              <span className="text-sm">OTP 인증 사용</span>
            </label>
          </div>
        </div>
      </section>

      {/* 3️⃣ 권한 그룹 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-base font-bold text-[#22282E] mb-4">3️⃣ 권한 그룹 설정</h3>
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          to="/admin/settings/operators"
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
        >
          취소
        </Link>
        <button
          onClick={handleRegisterClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
        >
          <UserPlus size={18} />
          계정 등록
        </button>
      </div>

      {/* 등록 확인 모달 */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="신규 계정 등록 확인"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            아래 정보로 운영자 계정을 등록할까요?
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <p><span className="text-gray-500">아이디 </span><strong className="text-[#22282E]">{form.id}</strong></p>
            <p><span className="text-gray-500">이름 </span><strong className="text-[#22282E]">{form.name}</strong></p>
            <p><span className="text-gray-500">부서 </span><strong className="text-[#22282E]">{form.department}</strong></p>
            <p><span className="text-gray-500">권한 </span><strong className="text-[#22282E]">{form.permission}</strong></p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-600 text-sm font-bold hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              취소
            </button>
            <button
              onClick={handleRegisterConfirm}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-all duration-200"
            >
              <UserPlus size={16} />
              등록하기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
