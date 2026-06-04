import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  List,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { NoticeDeleteConfirmModal } from '../components/notice/NoticeDeleteConfirmModal'
import { NoticeExposureBadge } from '../components/notice/NoticeExposureBadge'
import { useUIStore } from '../store/uiStore'
import { deleteNotice, deleteNotices, getAdminNotices } from '../lib/noticeStorage'
import { cn } from '../lib/utils'

const PAGE_SIZE = 10

const PAGE_BG =
  'min-h-full w-full min-w-0 bg-gradient-to-b from-slate-100/90 via-white to-emerald-50/35 pb-16'

const fieldClass =
  'rounded-xl border-2 border-gray-200/90 bg-white px-3 py-2 text-sm font-semibold text-[#22282E] shadow-sm transition placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/25'

const filterBtnClass =
  'flex items-center gap-1.5 rounded-xl border-2 border-gray-200/90 bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40'

const CATEGORY_OPTIONS = [
  { id: 'all', label: '전체' },
  { id: 'notice', label: '공지' },
  { id: 'event', label: '이벤트' },
  { id: 'update', label: '업데이트' },
  { id: 'winner', label: '당첨자' },
]

function dropdownItemClass(active) {
  return cn(
    'block w-full px-3 py-2 text-left text-sm font-bold transition',
    active ? 'bg-emerald-50 text-emerald-900' : 'text-gray-700 hover:bg-gray-50'
  )
}

export function NoticeAdminListPage() {
  const { showToast, incrementNoticeListRefresh } = useUIStore()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [singleDelete, setSingleDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getAdminNotices()
      setList(rows)
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onUpd = () => void refresh()
    window.addEventListener('vics:notices:updated', onUpd)
    return () => window.removeEventListener('vics:notices:updated', onUpd)
  }, [refresh])

  const filteredList = useMemo(() => {
    return list.filter((n) => {
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        if (!(n.title || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [list, categoryFilter, searchQuery])

  const { totalPages, paginatedList } = useMemo(() => {
    const total = filteredList.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const start = (page - 1) * PAGE_SIZE
    return {
      totalPages,
      paginatedList: filteredList.slice(start, start + PAGE_SIZE),
    }
  }, [filteredList, page])

  useEffect(() => {
    setPage(1)
  }, [categoryFilter, searchQuery])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === paginatedList.length && paginatedList.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(paginatedList.map((n) => n.id)))
    }
  }

  const afterDelete = async (removedCount) => {
    incrementNoticeListRefresh()
    setSelected(new Set())
    const newTotal = Math.max(0, list.length - removedCount)
    const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    setPage((p) => Math.min(p, newTotalPages))
    await refresh()
    showToast('삭제됐어요.', 'success')
  }

  const handleSingleDeleteConfirm = async () => {
    if (!singleDelete?.id) return
    setDeleting(true)
    try {
      await deleteNotice(singleDelete.id)
      setSingleDelete(null)
      await afterDelete(1)
    } catch (e) {
      showToast(e?.message || '삭제에 실패했어요.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    try {
      const ids = [...selected]
      await deleteNotices(ids)
      setBulkDeleteOpen(false)
      await afterDelete(ids.length)
    } catch (e) {
      showToast(e?.message || '삭제에 실패했어요.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={PAGE_BG}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="relative mb-8 overflow-hidden rounded-2xl border-2 border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/40 px-5 py-6 shadow-sm sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600/90">Notice · Admin</p>
              <h1 className="mt-1.5 flex flex-wrap items-center gap-2 text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-400/30">
                  <List size={20} strokeWidth={2.25} />
                </span>
                공지 목록
              </h1>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-gray-600">
                게시된 공지를 조회·수정·삭제할 수 있어요.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                to="/admin/notice/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105"
              >
                <Plus size={18} strokeWidth={2.5} />
                새 공지 작성
              </Link>
              <Link
                to="/notice"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                <ExternalLink size={14} />
                유저 공지 화면 보기
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="relative z-20 overflow-visible rounded-2xl border border-gray-200/80 bg-white/95 shadow-sm ring-1 ring-emerald-100/40">
            <div className="overflow-hidden rounded-t-2xl border-b border-emerald-100/60 bg-gradient-to-r from-emerald-50/95 via-white to-teal-50/40 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-200/60">
                  <Filter size={18} strokeWidth={2.25} />
                </span>
                <div>
                  <h2 className="text-sm font-black text-[#22282E]">필터 & 검색</h2>
                  <p className="text-xs font-medium text-gray-500">카테고리·제목으로 찾아요.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
              <div className="relative z-30">
                <button
                  type="button"
                  onClick={() => setCategoryOpen((o) => !o)}
                  className={filterBtnClass}
                >
                  카테고리: {CATEGORY_OPTIONS.find((o) => o.id === categoryFilter)?.label || '전체'}
                  <ChevronDown size={16} className={cn('shrink-0 transition-transform', categoryOpen && 'rotate-180')} />
                </button>
                {categoryOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-gray-200/90 bg-white py-1 shadow-xl">
                    {CATEGORY_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(o.id)
                          setCategoryOpen(false)
                        }}
                        className={dropdownItemClass(categoryFilter === o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative min-w-[12rem] flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목 검색…"
                  className={cn(fieldClass, 'w-full pl-9')}
                />
              </div>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200/80 bg-red-50/60 px-4 py-3">
              <span className="text-sm font-bold text-red-800">{selected.size}건 선택됨</span>
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-red-700"
              >
                <Trash2 size={16} />
                선택 삭제
              </button>
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm font-medium text-gray-500">
              불러오는 중…
            </div>
          ) : list.length === 0 ? (
            <div className="overflow-hidden rounded-2xl border border-dashed border-emerald-200/80 bg-white/90 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Megaphone size={28} strokeWidth={2} />
              </div>
              <p className="mb-1 text-base font-black text-[#22282E]">등록된 공지가 없어요</p>
              <p className="text-sm text-gray-500">새 공지를 작성하면 목록에 표시돼요.</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
              검색 조건에 맞는 공지가 없어요.
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-emerald-100/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-white to-teal-50/30">
                        <th className="w-10 px-3 py-3.5 text-left">
                          <input
                            type="checkbox"
                            checked={paginatedList.length > 0 && selected.size === paginatedList.length}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            aria-label="현재 페이지 전체 선택"
                          />
                        </th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">
                          카테고리
                        </th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">
                          제목
                        </th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">
                          게시일
                        </th>
                        <th className="px-3 py-3.5 text-left text-xs font-black uppercase tracking-wide text-gray-500">
                          노출
                        </th>
                        <th className="px-3 py-3.5 text-right text-xs font-black uppercase tracking-wide text-gray-500">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedList.map((n) => (
                        <tr
                          key={n.id}
                          className="border-b border-emerald-50/50 last:border-b-0 hover:bg-emerald-50/25"
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(n.id)}
                              onChange={() => toggleSelect(n.id)}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={cn(
                                'inline-flex rounded-lg px-2 py-0.5 text-[11px] font-black',
                                n.tagColor
                              )}
                            >
                              {n.tag}
                            </span>
                          </td>
                          <td className="max-w-[14rem] px-3 py-3">
                            <Link
                              to={`/notice/${n.id}`}
                              className="block truncate font-semibold text-[#22282E] hover:text-emerald-700"
                            >
                              {n.title}
                            </Link>
                            {n.isBanner && (
                              <span className="mt-0.5 inline-block text-[10px] font-bold text-amber-600">
                                상단 고정
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-600">{n.date}</td>
                          <td className="px-3 py-3">
                            <NoticeExposureBadge notice={n} className="text-[10px]" />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                to={`/admin/notice/edit/${n.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100"
                              >
                                <Pencil size={14} />
                                수정
                              </Link>
                              <button
                                type="button"
                                onClick={() => setSingleDelete(n)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                              >
                                <Trash2 size={14} />
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    이전
                  </button>
                  <span className="text-sm font-bold text-gray-600">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40"
                  >
                    다음
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <NoticeDeleteConfirmModal
        isOpen={!!singleDelete}
        onClose={() => !deleting && setSingleDelete(null)}
        onConfirm={handleSingleDeleteConfirm}
        itemLabel={singleDelete?.title}
        confirming={deleting}
      />

      <NoticeDeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => !deleting && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={`선택한 공지 ${selected.size}건을 삭제할까요?`}
        description="삭제하면 복구할 수 없어요. 선택한 공지가 유저 화면에서 모두 사라져요."
        confirming={deleting}
      />
    </div>
  )
}
