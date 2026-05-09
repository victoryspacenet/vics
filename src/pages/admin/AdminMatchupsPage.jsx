import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, AlertTriangle, Square, SquareCheck } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../store/uiStore'
import { Modal } from '../../components/ui/Modal'
import {
  getMatchups,
  bulkUpdateStatus,
  getMatchupStatusLabel,
  STATUS_OPTIONS,
} from '../../lib/matchupsAdminStorage'
import { getAdminMatchupCategoryFilterOptions } from '../../lib/categoryAdminStorage'
import { useAdminGranularForMenu } from '../../hooks/useAdminGranularForMenu'

const PAGE_SIZE = 10

const FILTER_SELECT_BASE =
  'min-w-[8.5rem] cursor-pointer rounded-xl border-2 px-3 py-2 text-sm font-bold shadow-sm transition-all hover:brightness-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-1'

const FILTER_SELECT_STYLES = {
  status:
    'border-blue-300/80 bg-gradient-to-br from-blue-50 to-sky-50/90 text-blue-950 focus:ring-blue-400/50',
  category:
    'border-violet-300/80 bg-gradient-to-br from-violet-50 to-fuchsia-50/80 text-violet-950 focus:ring-violet-400/50',
  report:
    'border-rose-300/80 bg-gradient-to-br from-rose-50 to-orange-50/70 text-rose-950 focus:ring-rose-400/50',
  sort:
    'border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-teal-50/80 text-emerald-950 focus:ring-emerald-400/50',
}

function statusBadgeClass(status) {
  switch (status) {
    case 'active':
      return 'bg-blue-100 text-blue-700'
    case 'review':
      return 'bg-amber-100 text-amber-700'
    case 'ended':
      return 'bg-gray-100 text-gray-700'
    case 'blocked':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

export function AdminMatchupsPage() {
  const { showToast } = useUIStore()
  const { canWrite } = useAdminGranularForMenu('matchups')
  const [matchups, setMatchups] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [reportFilter, setReportFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('default') // 'default' | 'reports_desc'
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmModal, setConfirmModal] = useState(null) // 'end' | 'block'
  const [categoryOptionsRev, setCategoryOptionsRev] = useState(0)

  useEffect(() => {
    const onCategories = () => setCategoryOptionsRev((n) => n + 1)
    window.addEventListener('vics_categories_changed', onCategories)
    return () => window.removeEventListener('vics_categories_changed', onCategories)
  }, [])

  const categoryFilterOptions = useMemo(
    () => getAdminMatchupCategoryFilterOptions(),
    [categoryOptionsRev]
  )

  useEffect(() => {
    if (categoryFilter === 'all') return
    if (!categoryFilterOptions.some((c) => c.value === categoryFilter)) {
      setCategoryFilter('all')
      setPage(1)
    }
  }, [categoryFilterOptions, categoryFilter])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    void getMatchups().then((list) => {
      if (!cancelled) {
        setMatchups(list)
        setListLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(
    () => ({
      active: matchups.filter((m) => m.status === 'active').length,
      review: matchups.filter((m) => m.status === 'review').length,
      ended: matchups.filter((m) => m.status === 'ended').length,
      blocked: matchups.filter((m) => m.status === 'blocked').length,
    }),
    [matchups]
  )

  const parseCreatedAt = (createdAt) => {
    if (!createdAt) return null
    const match = String(createdAt).match(/^(\d{1,2})\.(\d{1,2})/)
    if (!match) return null
    const [, month, day] = match
    const year = new Date().getFullYear()
    return new Date(year, Number(month) - 1, Number(day))
  }

  const filtered = useMemo(() => {
    let list = [...matchups]
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter)
    if (categoryFilter !== 'all') list = list.filter((m) => m.category === categoryFilter)
    if (reportFilter === '5+') list = list.filter((m) => m.reports >= 5)
    const q = searchQuery.trim().toLowerCase()
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q) || String(m.id).includes(q))
    if (dateFrom) {
      const from = new Date(dateFrom)
      list = list.filter((m) => {
        const d = parseCreatedAt(m.createdAt)
        return d && d >= from
      })
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      list = list.filter((m) => {
        const d = parseCreatedAt(m.createdAt)
        return d && d <= to
      })
    }
    if (sortBy === 'reports_desc') {
      list = [...list].sort((a, b) => (b.reports ?? 0) - (a.reports ?? 0))
    } else {
      list = [...list].sort((a, b) => {
        const da = parseCreatedAt(a.createdAt)?.getTime() ?? 0
        const db = parseCreatedAt(b.createdAt)?.getTime() ?? 0
        return db - da
      })
    }
    return list
  }, [matchups, statusFilter, categoryFilter, reportFilter, searchQuery, dateFrom, dateTo, sortBy])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const refresh = async () => {
    const list = await getMatchups()
    setMatchups(list)
  }

  const toggleSelect = (id) => {
    if (!canWrite) {
      showToast('매치업 수정 권한이 없어요.', 'error')
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!canWrite) {
      showToast('매치업 수정 권한이 없어요.', 'error')
      return
    }
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginated.map((m) => m.id)))
    }
  }

  const openBulkEndModal = () => {
    if (!canWrite) {
      showToast('매치업 수정 권한이 없어요.', 'error')
      return
    }
    if (selectedIds.size === 0) {
      showToast('선택된 항목이 없어요.', 'error')
      return
    }
    setConfirmModal('end')
  }

  const openBulkBlockModal = () => {
    if (!canWrite) {
      showToast('매치업 수정 권한이 없어요.', 'error')
      return
    }
    if (selectedIds.size === 0) {
      showToast('선택된 항목이 없어요.', 'error')
      return
    }
    setConfirmModal('block')
  }

  const handleBulkEndConfirm = async () => {
    const count = await bulkUpdateStatus([...selectedIds], 'ended')
    await refresh()
    setSelectedIds(new Set())
    setConfirmModal(null)
    showToast(`${count}건이 종료됐어요.`, 'success')
  }

  const handleBulkBlockConfirm = async () => {
    const count = await bulkUpdateStatus([...selectedIds], 'blocked')
    await refresh()
    setSelectedIds(new Set())
    setConfirmModal(null)
    showToast(`${count}건이 블라인드 처리됐어요.`, 'success')
  }

  if (listLoading) {
    return (
      <div className="max-w-6xl py-12 text-center text-gray-500">불러오는 중…</div>
    )
  }

  return (
    <div className="max-w-6xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-[#22282E]">📋 매치업 관리</h1>
      </div>

      {/* 상태별 퀵 스탯 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50">
          <p className="text-xs font-medium text-gray-600 mb-1">진행 중</p>
          <p className="text-2xl font-black text-[#22282E]">{stats.active}</p>
        </div>
        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
          <p className="text-xs font-medium text-gray-600 mb-1">검토 대기</p>
          <p className="text-2xl font-black text-red-600 flex items-center gap-1">
            {stats.review}
            <span className="text-base">🔥</span>
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
          <p className="text-xs font-medium text-gray-600 mb-1">종료</p>
          <p className="text-2xl font-black text-[#22282E]">{stats.ended}</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-xs font-medium text-gray-600 mb-1">차단</p>
          <p className="text-2xl font-black text-[#22282E]">{stats.blocked}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5 sm:gap-3">
        <span className="w-full shrink-0 text-sm font-black tracking-tight text-[#22282E] sm:w-auto">
          필터 및 검색
        </span>
        <select
          className={cn(FILTER_SELECT_BASE, FILTER_SELECT_STYLES.status)}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === 'all' ? '상태: ' : ''}{o.label}
            </option>
          ))}
        </select>
        <select
          className={cn(FILTER_SELECT_BASE, FILTER_SELECT_STYLES.category)}
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
        >
          {categoryFilterOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value === 'all' ? '카테고리: ' : ''}{c.label}
            </option>
          ))}
        </select>
        <select
          className={cn(FILTER_SELECT_BASE, FILTER_SELECT_STYLES.report)}
          value={reportFilter}
          onChange={(e) => { setReportFilter(e.target.value); setPage(1) }}
        >
          <option value="all">신고수: 전체</option>
          <option value="5+">5회 이상</option>
        </select>
        <select
          className={cn(FILTER_SELECT_BASE, FILTER_SELECT_STYLES.sort)}
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
        >
          <option value="default">정렬: 최신순</option>
          <option value="reports_desc">신고 많은 순</option>
        </select>
        <div
          className="flex items-center gap-1.5 rounded-xl border-2 border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 to-slate-50/80 px-2 py-1.5 shadow-sm"
          title="기간별 검색"
        >
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="w-[138px] rounded-lg border border-indigo-200/80 bg-white/90 px-2 py-1.5 text-xs font-semibold text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            aria-label="시작일"
          />
          <span className="text-indigo-400/90 text-sm font-bold">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="w-[138px] rounded-lg border border-indigo-200/80 bg-white/90 px-2 py-1.5 text-xs font-semibold text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            aria-label="종료일"
          />
        </div>
        <div className="relative min-w-[180px] flex-1 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-emerald-600/80" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="검색어 입력…"
            className="w-full rounded-xl border-2 border-emerald-300/80 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 py-2.5 pl-10 pr-4 text-sm font-semibold text-[#22282E] shadow-sm placeholder:text-emerald-800/35 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
          매치업 목록
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 w-10">
                  <button
                    type="button"
                    title={canWrite ? undefined : '수정 권한이 필요해요'}
                    disabled={!canWrite}
                    onClick={toggleSelectAll}
                    className="p-1 rounded hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {selectedIds.size === paginated.length && paginated.length > 0 ? (
                      <SquareCheck size={18} className="text-emerald-600" />
                    ) : (
                      <Square size={18} className="text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-16">ID</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-28">카테고리</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-48 max-w-48">매치업 타이틀 (A vs B)</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-20">신고</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-16">상태</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-28 whitespace-nowrap">등록일</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 ${
                    m.reports >= 5 ? 'bg-amber-50/50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title={canWrite ? undefined : '수정 권한이 필요해요'}
                      disabled={!canWrite}
                      onClick={() => toggleSelect(m.id)}
                      className="p-1 rounded hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {selectedIds.has(m.id) ? (
                        <SquareCheck size={18} className="text-emerald-600" />
                      ) : (
                        <Square size={18} className="text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/admin/matchups/${m.id}`} className="hover:underline text-emerald-600">
                      {m.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.categoryLabel}</td>
                  <td className="px-4 py-3 w-48 max-w-48">
                    <Link
                      to={`/admin/matchups/${m.id}`}
                      className={`block truncate hover:underline cursor-pointer ${m.reports >= 5 ? 'font-bold text-amber-800' : ''}`}
                      title={m.title}
                    >
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={m.reports >= 5 ? 'font-bold text-red-600' : ''}>
                      {m.reports >= 5 ? `[${m.reports}🔥]` : `[${m.reports}]`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      title="매치업 상세 검토의 관리자 조치에서 설정된 상태입니다."
                      className={`inline-flex min-w-[4.25rem] items-center justify-center rounded px-2 py-1 text-xs font-bold tabular-nums ${statusBadgeClass(m.status)}`}
                    >
                      {getMatchupStatusLabel(m.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paginated.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">검색 결과가 없습니다.</div>
        )}
      </div>

      {/* 벌크 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">선택 항목 조치:</span>
          <button
            type="button"
            disabled={!canWrite}
            title={canWrite ? undefined : '수정 권한이 필요해요'}
            onClick={openBulkEndModal}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-bold hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <AlertTriangle size={14} />
            일괄 종료
          </button>
          <button
            type="button"
            disabled={!canWrite}
            title={canWrite ? undefined : '수정 권한이 필요해요'}
            onClick={openBulkBlockModal}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-700 text-white text-sm font-bold hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Square size={14} />
            일괄 블라인드
          </button>
        </div>
      </div>

      {/* 경고 확인 모달 */}
      <Modal
        isOpen={confirmModal === 'end'}
        onClose={() => setConfirmModal(null)}
        title="일괄 종료 확인"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            선택한 <strong>{selectedIds.size}개</strong>의 매치업을 <strong>종료</strong>하시겠습니까?
            <br />
            종료된 매치업은 더 이상 투표가 불가능합니다.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmModal(null)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
            >
              취소
            </button>
            <button
              onClick={handleBulkEndConfirm}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700"
            >
              확인
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={confirmModal === 'block'}
        onClose={() => setConfirmModal(null)}
        title="일괄 블라인드 확인"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            선택한 <strong>{selectedIds.size}개</strong>의 매치업을 <strong>블라인드</strong> 처리하시겠습니까?
            <br />
            블라인드된 매치업은 목록에서 숨겨지며, 사용자에게 노출되지 않습니다.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmModal(null)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
            >
              취소
            </button>
            <button
              onClick={handleBulkBlockConfirm}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white text-sm font-bold hover:bg-gray-600"
            >
              확인
            </button>
          </div>
        </div>
      </Modal>

      {/* 페이지네이션 */}
      <div className="flex justify-center gap-1">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          &lt;
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i
          if (p > totalPages) return null
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                p === page ? 'bg-emerald-600 text-white' : 'border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          &gt;
        </button>
      </div>
    </div>
  )
}
