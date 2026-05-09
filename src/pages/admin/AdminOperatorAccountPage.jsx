import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { getOperatorsList, deleteOperator } from '../../lib/operatorAdminStorage'

const PERMISSION_STYLES = {
  Master:    'font-black text-violet-700 bg-violet-100',
  Editor:    'font-bold text-blue-700 bg-blue-100',
  CS_Viewer: 'font-medium text-gray-700 bg-gray-100',
}

const PAGE_SIZE = 6
const GROUP_TO_PERM = { master: 'Master', editor: 'Editor', cs_viewer: 'CS_Viewer' }

export function AdminOperatorAccountPage() {
  const { showToast } = useUIStore()
  const user = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()
  const permFromUrl = searchParams.get('permission')
  const initialPerm = permFromUrl && GROUP_TO_PERM[permFromUrl] ? GROUP_TO_PERM[permFromUrl] : 'all'

  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [permissionFilter, setPermissionFilter] = useState(initialPerm)
  const [statusFilter, setStatusFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const reload = () => {
    setLoading(true)
    getOperatorsList().then((list) => {
      setOperators(list)
      setLoading(false)
    })
  }

  useEffect(() => { reload() }, [])

  useEffect(() => {
    if (permFromUrl && GROUP_TO_PERM[permFromUrl]) {
      setPermissionFilter(GROUP_TO_PERM[permFromUrl])
    }
  }, [permFromUrl])

  const filtered = useMemo(() => {
    return operators.filter((op) => {
      const matchPermission = permissionFilter === 'all' || op.permission === permissionFilter
      const matchStatus = statusFilter === 'all' || op.status === statusFilter
      const q = searchQuery.trim().toLowerCase()
      const matchSearch = !q || op.id.toLowerCase().includes(q) || op.name.toLowerCase().includes(q)
      return matchPermission && matchStatus && matchSearch
    })
  }, [operators, permissionFilter, statusFilter, searchQuery])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const stats = useMemo(() => {
    const total = operators.length
    const online = 3
    const suspended = operators.filter((o) => o.status === 'suspended').length
    return { total, online, suspended }
  }, [operators])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const name = deleteTarget.name
    const ok = await deleteOperator(deleteTarget.id, { actorLabel: user?.email || '관리자' })
    setDeleteTarget(null)
    if (ok) {
      reload()
      showToast(`${name} 계정이 삭제됐어요.`, 'success')
    } else {
      showToast('삭제 중 오류가 발생했어요.', 'error')
    }
  }

  return (
    <div className="max-w-5xl">
      {/* 브레드크럼 + 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/settings" className="text-gray-500 hover:text-emerald-600">
            [⚙️ 설정]
          </Link>
          <ChevronRight size={16} className="text-gray-300" />
          <span className="font-black text-[#22282E]">운영자 계정 관리</span>
        </div>
        <Link
          to="/admin/settings/operators/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
        >
          <Plus size={18} />
          신규 계정 등록
        </Link>
      </div>

      {/* 통계 */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <h2 className="text-base font-bold text-[#22282E] mb-3">어드민 접속 권한 관리</h2>
        <p className="text-sm text-gray-600">
          현재 등록된 운영자: <strong className="text-[#22282E]">{stats.total}명</strong>
          {' | '}
          접속 중: <strong className="text-emerald-600">{stats.online}명</strong>
          {' | '}
          정지 계정: <strong className="text-red-600">{stats.suspended}명</strong>
        </p>
      </div>

      {/* 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-gray-600">목록 필터 및 검색</span>
        <select
          value={permissionFilter}
          onChange={(e) => { setPermissionFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium"
        >
          <option value="all">권한: 전체</option>
          <option value="Master">Master</option>
          <option value="Editor">Editor</option>
          <option value="CS_Viewer">CS_Viewer</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium"
        >
          <option value="all">상태: 전체</option>
          <option value="active">활성</option>
          <option value="suspended">정지</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="🔍 운영자 ID 또는 이름 검색..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
          운영자 계정 목록
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-28">ID (계정)</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-24">이름</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-28">권한 그룹</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-36">최근 접속일</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-20">상태</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">불러오는 중...</td>
                </tr>
              ) : paginated.map((op) => (
                <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{op.id}</td>
                  <td className="px-4 py-3">{op.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${PERMISSION_STYLES[op.permission] || 'bg-gray-100 text-gray-700'}`}>
                      {op.permission}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{op.lastAccess}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      op.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {op.status === 'active' ? '활성' : '정지'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/admin/settings/operators/${op.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200"
                      >
                        <Pencil size={12} />
                        수정
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(op)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200"
                      >
                        <Trash2 size={12} />
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && paginated.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">검색 결과가 없습니다.</div>
        )}
      </div>

      {/* 보안 안내 */}
      <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <h3 className="text-sm font-bold text-amber-800 mb-2">🔐 보안 안내</h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• 90일 이상 미접속 계정은 자동으로 [정지] 상태로 전환됩니다. (운영자 목록을 불러올 때마다 서버에서 적용)</li>
          <li>• 권한 변경 및 계정 삭제 내역은 아래 보안 로그에 기록됩니다.</li>
        </ul>
        <Link
          to="/admin/settings/operators/security-log"
          className="mt-3 inline-flex text-sm font-black text-amber-900 underline-offset-2 hover:underline"
        >
          보안 로그 보기 →
        </Link>
      </div>

      {/* 페이지네이션 */}
      <div className="flex justify-center gap-1">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          &lt;
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
              p === page ? 'bg-emerald-600 text-white' : 'border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          &gt;
        </button>
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="계정 삭제 확인"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong className="text-[#22282E]">{deleteTarget.name}</strong> ({deleteTarget.id}) 계정을 삭제하시겠습니까?
              <br />
              <span className="text-red-600 font-medium">삭제된 계정은 복구할 수 없습니다.</span>
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
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-500"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
