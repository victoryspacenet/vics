import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import {
  getPermissionGroups,
  getPermissionGroup,
  copyPermissionGroup,
  updatePermissionGroup,
  deletePermissionGroup,
  addPermissionGroup,
  MENU_ITEMS,
} from '../../lib/permissionGroupStorage'

export function AdminPermissionGroupPage() {
  const { showToast } = useUIStore()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [editingPermissions, setEditingPermissions] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingDesc, setEditingDesc] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [nameError, setNameError] = useState('')
  const [descError, setDescError] = useState('')
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)

  const resetErrors = () => { setNameError(''); setDescError('') }

  const validate = () => {
    const nErr = editingName.trim() ? '' : '그룹명을 입력해주세요.'
    const dErr = editingDesc.trim() ? '' : '설명 요약을 입력해주세요.'
    setNameError(nErr)
    setDescError(dErr)
    return !nErr && !dErr
  }

  const refreshGroups = () => {
    setLoading(true)
    return getPermissionGroups().then((list) => {
      setGroups(list)
      setLoading(false)
      return list
    })
  }

  useEffect(() => { refreshGroups() }, [])

  const selected = groups.find((g) => g.id === selectedId) || null

  const hasAnyPerm = editingPermissions
    ? Object.values(editingPermissions).some((perms) => Object.values(perms).some(Boolean))
    : false

  const handleCopy = async (id) => {
    const newId = await copyPermissionGroup(id)
    if (!newId) {
      showToast('복사 중 오류가 발생했어요.', 'error')
      return
    }
    await refreshGroups()
    const newGroup = await getPermissionGroup(newId)
    if (newGroup) {
      setSelectedId(newId)
      setEditingPermissions(JSON.parse(JSON.stringify(newGroup.permissions)))
      setEditingName(newGroup.name)
      setEditingDesc(newGroup.desc || '')
      setHasChanges(false)
    }
    showToast('그룹이 복사됐어요.', 'success')
  }

  const handleEdit = async (id) => {
    const g = await getPermissionGroup(id)
    if (g) {
      setSelectedId(id)
      setEditingPermissions(JSON.parse(JSON.stringify(g.permissions)))
      setEditingName(g.name)
      setEditingDesc(g.desc || '')
      setHasChanges(false)
      resetErrors()
    }
  }

  const handleSaveClick = () => {
    if (!selectedId || !editingPermissions) return
    if (!validate()) return
    if (!hasAnyPerm) {
      showToast('접근 가능한 메뉴 권한을 하나 이상 설정해주세요.', 'error')
      return
    }
    setSaveConfirmOpen(true)
  }

  const handleSaveConfirm = async () => {
    setSaveConfirmOpen(false)
    const ok = await updatePermissionGroup(selectedId, { name: editingName, desc: editingDesc, permissions: editingPermissions })
    if (ok) {
      await refreshGroups()
      setHasChanges(false)
      resetErrors()
      showToast('그룹 권한이 저장됐어요.', 'success')
    } else {
      showToast('저장 중 오류가 발생했어요.', 'error')
    }
  }

  const handleCancel = async () => {
    const g = await getPermissionGroup(selectedId)
    if (g) {
      setEditingPermissions(JSON.parse(JSON.stringify(g.permissions)))
      setEditingName(g.name)
      setEditingDesc(g.desc || '')
    }
    setHasChanges(false)
    resetErrors()
  }

  const setPerm = (menuKey, key, value) => {
    setEditingPermissions((prev) => ({
      ...prev,
      [menuKey]: { ...prev[menuKey], [key]: value },
    }))
    setHasChanges(true)
  }

  const handleAddNew = async () => {
    const newId = `custom_${Date.now()}`
    const newGroup = {
      id:          newId,
      name:        '',
      icon:        '📋',
      desc:        '',
      is_system:   false,
      permissions: { dashboard: { r: false, w: false, d: false, e: false }, matchups: { r: false, w: false, d: false, e: false }, users: { r: false, w: false, d: false, e: false }, settings: { r: false, w: false, d: false, e: false } },
    }
    const inserted = await addPermissionGroup(newGroup)
    if (!inserted) {
      showToast('그룹 추가 중 오류가 발생했어요.', 'error')
      return
    }
    await refreshGroups()
    setSelectedId(newId)
    setEditingPermissions(JSON.parse(JSON.stringify(newGroup.permissions)))
    setEditingName('')
    setEditingDesc('')
    setHasChanges(false)
    resetErrors()
    showToast('새 그룹이 추가됐어요. 그룹명과 설명을 입력한 후 저장해주세요.', 'success')
  }

  const openDeleteModal = (g) => {
    if (g?.isSystem) {
      showToast('시스템 필수 그룹은 삭제할 수 없어요.', 'error')
      return
    }
    setDeleteTarget(g)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    const ok = await deletePermissionGroup(id)
    if (ok) {
      refreshGroups()
      if (selectedId === id) {
        setSelectedId(null)
        setEditingPermissions(null)
        setEditingName('')
        setEditingDesc('')
      }
      showToast('그룹이 삭제됐어요.', 'success')
    } else {
      showToast('삭제 중 오류가 발생했어요.', 'error')
    }
  }

  return (
    <div className="max-w-5xl">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/settings" className="text-gray-500 hover:text-emerald-600">
            [⚙️ 설정]
          </Link>
          <ChevronRight size={16} className="text-gray-300" />
          <span className="font-black text-[#22282E]">권한 그룹 설정</span>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
        >
          <Plus size={18} />
          새 그룹 추가
        </button>
      </div>

      {/* 설명 */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <h2 className="text-base font-bold text-[#22282E] mb-1">권한 그룹 정의 및 관리</h2>
        <p className="text-sm text-gray-600">
          직무에 맞는 권한 세트를 미리 구성하여 운영자 계정에 간편하게 부여하세요.
        </p>
      </div>

      {/* 그룹 리스트 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
          권한 그룹 리스트
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-32">그룹명</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">설명 요약</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 w-24">할당 인원</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-28">최종 수정일</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-36">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">불러오는 중...</td>
                </tr>
              ) : groups.map((g) => (
                <tr
                  key={g.id}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer ${selectedId === g.id ? 'bg-emerald-50/50' : ''}`}
                  onClick={() => handleEdit(g.id)}
                >
                  <td className="px-4 py-3 font-medium">
                    <span className="mr-1">{g.icon}</span>
                    {g.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.desc}</td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      to={`/admin/settings/operators?permission=${g.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-600 font-bold hover:underline"
                    >
                      {g.assignedCount}명
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.lastModified}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopy(g.id)}
                        className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
                      >
                        복사
                      </button>
                      {!g.isSystem && (
                        <button
                          onClick={() => openDeleteModal(g)}
                          className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 설정 */}
      {selected && editingPermissions && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
            🔍 상세 설정: <strong>{selected.icon} {editingName || selected.name}</strong> 그룹
          </h3>
          <div className="px-4 py-3 space-y-3 border-b border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                그룹명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => { setEditingName(e.target.value); setHasChanges(true); if (e.target.value.trim()) setNameError('') }}
                placeholder="그룹명을 입력해주세요"
                className={`w-full max-w-xs px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                  nameError ? 'border-red-400 focus:ring-red-500/30' : 'border-gray-200 focus:ring-emerald-500/30'
                }`}
              />
              {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                설명 요약 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingDesc}
                onChange={(e) => { setEditingDesc(e.target.value); setHasChanges(true); if (e.target.value.trim()) setDescError('') }}
                placeholder="설명을 입력해주세요"
                className={`w-full max-w-md px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                  descError ? 'border-red-400 focus:ring-red-500/30' : 'border-gray-200 focus:ring-emerald-500/30'
                }`}
              />
              {descError && <p className="text-xs text-red-500 mt-1">{descError}</p>}
            </div>
          </div>
          <p className="px-4 py-2 text-sm text-gray-600">
            이 그룹에 속한 운영자가 접근 가능한 메뉴와 액션 범위를 설정합니다.
          </p>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 font-bold text-gray-600 w-24">대메뉴</th>
                  <th className="text-left py-3 font-bold text-gray-600 w-24">중메뉴</th>
                  <th className="text-center py-3 font-bold text-gray-600 w-20">조회(R)</th>
                  <th className="text-center py-3 font-bold text-gray-600 w-20">수정(W)</th>
                  <th className="text-center py-3 font-bold text-gray-600 w-20">삭제(D)</th>
                  <th className="text-center py-3 font-bold text-gray-600 w-20">엑셀(E)</th>
                </tr>
              </thead>
              <tbody>
                {MENU_ITEMS.map((menu) => {
                  const perms = editingPermissions[menu.menuKey] || { r: false, w: false, d: false, e: false }
                  return (
                    <tr key={menu.menuKey} className="border-b border-gray-100">
                      <td className="py-3 font-medium">{menu.menuLabel}</td>
                      <td className="py-3">{menu.subLabel}</td>
                      <td className="py-3 text-center">
                        <input type="checkbox" checked={perms.r} onChange={(e) => setPerm(menu.menuKey, 'r', e.target.checked)} className="w-4 h-4 rounded" />
                      </td>
                      <td className="py-3 text-center">
                        <input type="checkbox" checked={perms.w} onChange={(e) => setPerm(menu.menuKey, 'w', e.target.checked)} className="w-4 h-4 rounded" />
                      </td>
                      <td className="py-3 text-center">
                        <input type="checkbox" checked={perms.d} onChange={(e) => setPerm(menu.menuKey, 'd', e.target.checked)} className="w-4 h-4 rounded" />
                      </td>
                      <td className="py-3 text-center">
                        <input type="checkbox" checked={perms.e} onChange={(e) => setPerm(menu.menuKey, 'e', e.target.checked)} className="w-4 h-4 rounded" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 justify-end p-4 border-t border-gray-100">
            <button
              onClick={handleCancel}
              disabled={!hasChanges}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-slate-50/80 text-slate-700 text-sm font-bold hover:border-slate-300 hover:bg-slate-100 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Undo2 size={16} />
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={!hasChanges || !editingName.trim() || !editingDesc.trim() || !hasAnyPerm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              그룹 권한 변경사항 저장
            </button>
          </div>
        </div>
      )}

      {/* 저장 확인 모달 */}
      <Modal
        isOpen={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title="그룹 권한 변경사항 저장"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            아래 내용으로 그룹 권한을 저장하시겠습니까?
          </p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 text-sm">
            <div className="flex gap-3">
              <span className="text-gray-500 w-16 shrink-0">그룹명</span>
              <span className="font-bold text-[#22282E]">{editingName}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-gray-500 w-16 shrink-0">설명 요약</span>
              <span className="text-[#22282E]">{editingDesc}</span>
            </div>
          </div>
          <p className="text-xs text-amber-600">
            ⚠️ 저장 후 해당 그룹에 속한 운영자 권한에 즉시 반영됩니다.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setSaveConfirmOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSaveConfirm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
            >
              <Save size={16} />
              저장
            </button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="권한 그룹 삭제"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong className="text-[#22282E]">{deleteTarget.icon} {deleteTarget.name}</strong> 그룹을 삭제하시겠습니까?
              <br />
              <span className="text-red-600 font-medium">삭제된 그룹은 복구할 수 없습니다.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-500"
              >
                <Trash2 size={16} />
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
