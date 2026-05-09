import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  Layers,
  List,
  Play,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { useUIStore } from '../store/uiStore'
import { getPopupNotices, deletePopupNotice, savePopupNotice, activatePopupNow } from '../lib/popupNoticeStorage'
import { cn } from '../lib/utils'

const PAGE_SIZE = 10

const PAGE_BG =
  'min-h-full w-full min-w-0 bg-gradient-to-b from-slate-100/90 via-white to-violet-50/35 pb-16'

const fieldClass =
  'rounded-xl border-2 border-gray-200/90 bg-white px-3 py-2 text-sm font-semibold text-[#22282E] shadow-sm transition placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/25'

const filterBtnClass =
  'flex items-center gap-1.5 rounded-xl border-2 border-gray-200/90 bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40'

const STATUS_OPTIONS = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '운영중' },
  { id: 'scheduled', label: '예약' },
  { id: 'paused', label: '일시정지' },
  { id: 'ended', label: '종료' },
]

const TYPE_OPTIONS = [
  { id: 'all', label: '전체' },
]

function getPopupStatus(p) {
  const now = new Date()
  const start = p.startAt ? new Date(p.startAt) : null
  const end = p.endAt ? new Date(p.endAt) : null
  if (end && now > end) return 'ended'
  if (!p.isActive) return 'paused'
  if (start && now < start) return 'scheduled'
  return 'active'
}

function formatDateRange(startAt, endAt) {
  if (!startAt || !endAt) return '-'
  const s = new Date(startAt)
  const e = new Date(endAt)
  const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  return `${fmt(s)}~${fmt(e)}`
}

function StatusBadge({ status }) {
  const config = {
    active: { label: '운영중', className: 'bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-200/80' },
    scheduled: { label: '예약', className: 'bg-violet-100/90 text-violet-800 ring-1 ring-violet-200/80' },
    paused: { label: '일시정지', className: 'bg-amber-100/90 text-amber-800 ring-1 ring-amber-200/80' },
    ended: { label: '종료', className: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/80' },
  }
  const { label, className } = config[status] || config.ended
  return (
    <span className={cn('inline-block rounded-lg px-2 py-0.5 text-[11px] font-black', className)}>{label}</span>
  )
}

function getCTR(p) {
  const view = p.viewCount || 0
  const click = p.clickCount || 0
  if (view === 0) return null
  return ((click / view) * 100).toFixed(1)
}

export function PopupNoticeListPage() {
  const { showToast, incrementPopupRefresh } = useUIStore()
  const [list, setList] = useState([])
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const refresh = useCallback(async () => {
    const rows = await getPopupNotices()
    setList(rows)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredList = useMemo(() => {
    return list.filter((p) => {
      const status = getPopupStatus(p)
      if (statusFilter === 'active' && status !== 'active') return false
      if (statusFilter === 'scheduled' && status !== 'scheduled') return false
      if (statusFilter === 'paused' && status !== 'paused') return false
      if (statusFilter === 'ended' && status !== 'ended') return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        if (!(p.name || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [list, statusFilter, searchQuery])

  const { totalPages, paginatedList } = useMemo(() => {
    const total = filteredList.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const start = (page - 1) * PAGE_SIZE
    const paginatedList = filteredList.slice(start, start + PAGE_SIZE)
    return { totalPages, paginatedList }
  }, [filteredList, page])

  const activeCount = useMemo(() => list.filter((p) => getPopupStatus(p) === 'active').length, [list])

  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === paginatedList.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(paginatedList.map((p) => p.id)))
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 팝업을 삭제할까요?')) return
    await deletePopupNotice(id)
    incrementPopupRefresh()
    setSelected((s) => { const n = new Set(s); n.delete(id); return n })
    const newTotal = list.length - 1
    const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    setPage((p) => Math.min(p, newTotalPages))
    await refresh()
    showToast('삭제됐어요.', 'success')
  }

  const handleBulkDeactivate = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 ${selected.size}개 팝업의 노출을 중단할까요?`)) return
    const all = await getPopupNotices()
    for (const id of selected) {
      const p = all.find((x) => x.id === id)
      if (p) await savePopupNotice({ ...p, id, isActive: false })
    }
    incrementPopupRefresh()
    setSelected(new Set())
    await refresh()
    showToast('노출이 중단됐어요.', 'success')
  }

  const handleBulkCopy = async () => {
    if (selected.size === 0) return
    const all = await getPopupNotices()
    for (const id of selected) {
      const p = all.find((x) => x.id === id)
      if (p) {
        const { id: _, viewCount: __, clickCount: ___, viewByPath: ____, clickByPath: _____, ...rest } = p
        await savePopupNotice(rest)
      }
    }
    incrementPopupRefresh()
    setSelected(new Set())
    await refresh()
    showToast('복사 등록됐어요.', 'success')
  }

  const handleBulkDeleteClick = () => {
    if (selected.size === 0) return
    setBulkDeleteOpen(true)
  }

  const handleBulkDeleteConfirm = async () => {
    if (selected.size === 0) return
    for (const id of selected) {
      await deletePopupNotice(id)
    }
    incrementPopupRefresh()
    setBulkDeleteOpen(false)
    setSelected(new Set())
    await refresh()
    showToast('삭제됐어요.', 'success')
  }

  const handleBulkActivateNow = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 ${selected.size}개 팝업을 즉시 노출로 변경할까요?`)) return
    for (const id of selected) {
      await activatePopupNow(id)
    }
    incrementPopupRefresh()
    setSelected(new Set())
    await refresh()
    showToast('즉시 노출로 변경됐어요. 메인에서 확인해 보세요.', 'success')
  }

  const displayId = (p, idx) => {
    const globalIdx = (page - 1) * PAGE_SIZE + idx
    const order = filteredList.length - globalIdx
    return String(Math.max(1, order)).padStart(2, '0')
  }

  const dropdownItemClass = (active) =>
    cn(
      'w-full text-left px-3 py-2.5 text-sm font-semibold transition-colors',
      active ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white' : 'text-gray-700 hover:bg-violet-50/80',
    )

  return (
    <div className={PAGE_BG}>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-gradient-to-b from-violet-200/25 via-fuchsia-100/10 to-transparent blur-3xl"
        aria-hidden
      />
      <div className="relative z-[1] mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        {/* 히어로 */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/50 to-fuchsia-50/40 p-5 shadow-[0_12px_40px_-16px_rgba(109,40,217,0.25)] ring-1 ring-white/80 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600/90">Notice · Popup</p>
              <h1 className="mt-1.5 flex flex-wrap items-center gap-2 text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-400/30">
                  <Layers size={20} strokeWidth={2.25} />
                </span>
                팝업 목록
              </h1>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-gray-600">
                등록된 팝업을 한눈에 보고, 상태·통계·일괄 작업으로 운영해요.
              </p>
              <p className="mt-2 text-xs font-medium text-gray-400">운영 도구 · 팝업 관리</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                to="/admin/notice/popup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-105"
              >
                <Plus size={18} strokeWidth={2.5} />
                새 팝업 등록
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* 필터 카드 — overflow-hidden 금지: 드롭다운이 아래 테이블에 가려지지 않도록 */}
          <div className="relative z-20 overflow-visible rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_8px_30px_-12px_rgba(91,33,182,0.12)] ring-1 ring-violet-100/40 backdrop-blur-[2px]">
            <div className="overflow-hidden rounded-t-2xl border-b border-violet-100/60 bg-gradient-to-r from-violet-50/95 via-white to-fuchsia-50/50 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 text-violet-700 shadow-sm ring-1 ring-violet-200/60">
                  <Filter size={18} strokeWidth={2.25} />
                </span>
                <div>
                  <h2 className="text-sm font-black text-[#22282E]">필터 & 검색</h2>
                  <p className="text-xs font-medium text-gray-500">상태·유형으로 좁히고 이름으로 찾아요.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-b-2xl p-4 sm:p-5">
              <div className="relative z-30">
                <button
                  type="button"
                  onClick={() => {
                    setStatusOpen(!statusOpen)
                    setTypeOpen(false)
                  }}
                  className={filterBtnClass}
                >
                  상태: {STATUS_OPTIONS.find((o) => o.id === statusFilter)?.label || '전체'}
                  <ChevronDown size={16} className={cn('shrink-0 transition-transform', statusOpen && 'rotate-180')} />
                </button>
                {statusOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-gray-200/90 bg-white py-1 shadow-xl shadow-violet-900/10 ring-1 ring-violet-100/50">
                    {STATUS_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(o.id)
                          setStatusOpen(false)
                        }}
                        className={dropdownItemClass(statusFilter === o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative z-30">
                <button
                  type="button"
                  onClick={() => {
                    setTypeOpen(!typeOpen)
                    setStatusOpen(false)
                  }}
                  className={filterBtnClass}
                >
                  유형: {TYPE_OPTIONS.find((o) => o.id === typeFilter)?.label || '전체'}
                  <ChevronDown size={16} className={cn('shrink-0 transition-transform', typeOpen && 'rotate-180')} />
                </button>
                {typeOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-gray-200/90 bg-white py-1 shadow-xl shadow-violet-900/10 ring-1 ring-violet-100/50">
                    {TYPE_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setTypeFilter(o.id)
                          setTypeOpen(false)
                        }}
                        className={dropdownItemClass(typeFilter === o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-nowrap">
                <div className="relative min-w-[12rem] flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="팝업명 검색…"
                    className={cn(fieldClass, 'w-full pl-9')}
                  />
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2 text-sm font-black text-white shadow-md shadow-fuchsia-500/20 transition hover:brightness-105"
                >
                  검색
                </button>
              </div>
            </div>
          </div>

          {list.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border border-dashed border-violet-200/80 bg-white/90 py-16 text-center shadow-inner ring-1 ring-violet-100/30">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-600">
                <List size={28} strokeWidth={2} />
              </div>
              <p className="mb-1 text-base font-black text-[#22282E]">등록된 팝업이 없어요</p>
              <p className="text-sm text-gray-500">첫 팝업을 만들면 목록이 여기에 표시돼요.</p>
            </div>
          ) : (
            <>
              <div className="relative z-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-[0_8px_30px_-12px_rgba(91,33,182,0.15)] ring-1 ring-violet-100/40 backdrop-blur-[2px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-violet-100/80 bg-gradient-to-r from-violet-50/95 via-white to-fuchsia-50/40">
                        <th className="w-10 px-3 py-3.5 text-left">
                          <input
                            type="checkbox"
                            checked={paginatedList.length > 0 && selected.size === paginatedList.length}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                        </th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">ID</th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">팝업명</th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">노출 기간</th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">상태</th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">클릭률</th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedList.map((p, idx) => {
                        const status = getPopupStatus(p)
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-violet-50/50 transition-colors last:border-b-0 hover:bg-violet-50/30"
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selected.has(p.id)}
                                onChange={() => toggleSelect(p.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Link
                                to={`/admin/notice/popup/${p.id}`}
                                className="font-bold text-violet-700 hover:text-fuchsia-600 hover:underline"
                              >
                                {displayId(p, idx)}
                              </Link>
                            </td>
                            <td className="max-w-[12rem] px-3 py-3">
                              <Link
                                to={`/admin/notice/popup/${p.id}`}
                                className="block truncate font-semibold text-[#22282E] hover:text-violet-700"
                              >
                                {p.name || '(제목 없음)'}
                              </Link>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-gray-600">{formatDateRange(p.startAt, p.endAt)}</td>
                            <td className="px-3 py-3">
                              <StatusBadge status={status} />
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={cn(
                                  'font-bold',
                                  (getCTR(p) || '0') === '0' ? 'text-gray-400' : 'text-[#22282E]',
                                )}
                              >
                                {getCTR(p) != null ? `${getCTR(p)}%` : '0.0%'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap items-center gap-0.5">
                                <Link
                                  to={`/admin/notice/popup/${p.id}/stats`}
                                  className="rounded-lg p-1.5 text-gray-500 transition hover:bg-violet-100/80 hover:text-violet-800"
                                  title="통계"
                                >
                                  <BarChart3 size={16} />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void (async () => {
                                      const { id: _, viewCount: __, clickCount: ___, viewByPath: ____, clickByPath: _____, ...rest } = p
                                      await savePopupNotice(rest)
                                      incrementPopupRefresh()
                                      await refresh()
                                      showToast('복사 등록됐어요.', 'success')
                                    })()
                                  }}
                                  className="rounded-lg p-1.5 text-gray-500 transition hover:bg-sky-100 hover:text-sky-700"
                                  title="복사"
                                >
                                  <Copy size={16} />
                                </button>
                                {(status === 'scheduled' || status === 'paused' || status === 'ended') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void (async () => {
                                        await activatePopupNow(p.id)
                                        incrementPopupRefresh()
                                        await refresh()
                                        showToast('즉시 노출로 변경됐어요. 메인에서 확인해 보세요.', 'success')
                                      })()
                                    }}
                                    className="rounded-lg p-1.5 text-gray-500 transition hover:bg-emerald-100 hover:text-emerald-700"
                                    title="즉시 노출"
                                  >
                                    <Play size={16} />
                                  </button>
                                )}
                                {(status === 'active' || status === 'scheduled' || status === 'paused') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void (async () => {
                                        if (!window.confirm('이 팝업의 노출을 즉시 중단할까요?')) return
                                        await savePopupNotice({ ...p, id: p.id, isActive: false })
                                        incrementPopupRefresh()
                                        await refresh()
                                        showToast('노출이 중단됐어요.', 'success')
                                      })()
                                    }}
                                    className="rounded-lg p-1.5 text-gray-500 transition hover:bg-amber-100 hover:text-amber-700"
                                    title="중단"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50/80 via-white to-fuchsia-50/50 p-4 shadow-sm ring-1 ring-violet-100/50">
                  <span className="text-sm font-black text-violet-900">선택 {selected.size}건</span>
                  <span className="hidden h-4 w-px bg-violet-200 sm:inline" aria-hidden />
                  <button
                    type="button"
                    onClick={handleBulkActivateNow}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-200/80 transition hover:bg-emerald-500/25"
                  >
                    <Play size={16} />
                    즉시 노출
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDeactivate}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-black text-amber-900 ring-1 ring-amber-200/80 transition hover:bg-amber-500/25"
                  >
                    <XCircle size={16} />
                    노출 중단
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkCopy}
                    className="flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-2 text-sm font-black text-sky-900 ring-1 ring-sky-200/80 transition hover:bg-sky-500/25"
                  >
                    <Copy size={16} />
                    복사 등록
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDeleteClick}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-black text-red-700 ring-1 ring-red-200/80 transition hover:bg-red-500/20"
                  >
                    <Trash2 size={16} />
                    삭제
                  </button>
                </div>
              )}

              <div
                className={cn(
                  'overflow-hidden rounded-2xl border p-4 shadow-sm ring-1 backdrop-blur-[1px]',
                  activeCount > 5
                    ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-orange-50/50 ring-amber-100/60'
                    : 'border-gray-200/80 bg-white/95 ring-violet-100/40',
                )}
              >
                <p
                  className={cn(
                    'text-sm leading-relaxed',
                    activeCount > 5 ? 'font-bold text-amber-900' : 'font-medium text-gray-600',
                  )}
                >
                  현재 <strong className="text-[#22282E]">{activeCount}개</strong>의 팝업이 활성화되어 있습니다.
                  {activeCount > 5 &&
                    ' 권장 최대 5개를 초과했습니다. 유저 피로도를 고려해 조정해 주세요.'}
                  {activeCount <= 5 && ' (권장 최대 5개)'}
                </p>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-xl border-2 border-gray-200/90 bg-white p-2.5 text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="min-w-[5rem] rounded-xl border border-violet-100/80 bg-white px-4 py-2 text-center text-sm font-black text-[#22282E] shadow-sm">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-xl border-2 border-gray-200/90 bg-white p-2.5 text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="다음 페이지"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        className="max-w-[min(22rem,calc(100vw-2rem))]"
        bodyClassName="p-0"
      >
        <div className="p-6 pt-5">
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-2 ring-red-100">
              <AlertTriangle size={26} className="text-red-500" strokeWidth={2.25} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black tracking-tight text-[#22282E]">선택한 팝업을 삭제할까요?</h3>
              <p className="text-sm font-medium leading-relaxed text-gray-500">
                선택 <strong className="text-[#22282E]">{selected.size}건</strong>이 삭제되며 복구할 수 없어요.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-gray-200/90 bg-white py-2.5 text-sm font-black text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
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
