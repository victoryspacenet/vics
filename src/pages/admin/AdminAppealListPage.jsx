import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import {
  getAdminAppealsPaged,
  getAdminAppealTotals,
  APPEAL_STATUS,
  SANCTION_TYPES,
} from '../../lib/appealAdminStorage'

const STATUS_LABELS = {
  [APPEAL_STATUS.pending]: '미처리',
  [APPEAL_STATUS.completed]: '답변 완료',
}

const STATUS_COLORS = {
  [APPEAL_STATUS.pending]: 'bg-red-100 text-red-700',
  [APPEAL_STATUS.completed]: 'bg-emerald-100 text-emerald-700',
}

const DATE_RANGES = [
  { id: 'all', label: '전체' },
  { id: '1w', label: '1주일' },
  { id: '2w', label: '2주일' },
  { id: '1m', label: '1개월' },
]

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 400

export function AdminAppealListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useUIStore()
  const [sanctionFilter, setSanctionFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sanctionOpen, setSanctionOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [page, setPage] = useState(1)

  const [stats, setStats] = useState({ pending: 0, completed: 0 })
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [listLoading, setListLoading] = useState(true)

  const [listTick, setListTick] = useState(0)

  const filterSig = `${sanctionFilter}|${dateFilter}|${debouncedSearch}`
  const prevFilterSigRef = useRef(filterSig)

  // 통보 완료 후 상세에서 리다이렉트 시 토스트 표시
  useEffect(() => {
    const toastMsg = location.state?.appealCompleteToast
    if (toastMsg) {
      showToast(toastMsg, 'success')
      navigate('/admin/appeals', { replace: true, state: {} })
    }
  }, [location.state?.appealCompleteToast, showToast, navigate])

  const loadTotals = useCallback(async () => {
    const t = await getAdminAppealTotals()
    setStats(t)
  }, [])

  useEffect(() => {
    void loadTotals()
  }, [loadTotals])

  useEffect(() => {
    const onUpd = () => {
      void loadTotals()
      setListTick((t) => t + 1)
    }
    window.addEventListener('vics:adminAppeals:updated', onUpd)
    return () => window.removeEventListener('vics:adminAppeals:updated', onUpd)
  }, [loadTotals])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchQuery])

  useEffect(() => {
    let cancelled = false
    const sigChanged = prevFilterSigRef.current !== filterSig
    if (sigChanged) prevFilterSigRef.current = filterSig

    const effectivePage = sigChanged ? 1 : page
    if (sigChanged && page !== 1) setPage(1)

    setListLoading(true)
    ;(async () => {
      const { appeals, totalCount: tc } = await getAdminAppealsPaged({
        page: effectivePage,
        pageSize: PAGE_SIZE,
        sanctionType: sanctionFilter,
        dateRange: dateFilter,
        search: debouncedSearch,
      })
      if (cancelled) return
      setRows(appeals)
      setTotalCount(tc)
      setListLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [page, filterSig, listTick])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const goPage = useCallback((p) => setPage(Math.min(Math.max(1, p), totalPages)), [totalPages])

  const applySearchNow = useCallback(() => {
    setDebouncedSearch(searchQuery.trim())
  }, [searchQuery])

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
      .reduce((acc, p, idx, arr) => {
        if (idx > 0 && p - arr[idx - 1] > 1) acc.push(`ellipsis-${p}`)
        acc.push(p)
        return acc
      }, [])
  }, [totalPages, page])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/admin/dashboard" className="hover:text-[#22282E]">
            커뮤니티 관리
          </Link>
          <span>/</span>
          <span className="text-[#22282E] font-semibold">이의 신청 검토 내역</span>
        </div>

        {/* 검토 현황 */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 mb-3">검토 현황</h2>
          <div className="flex flex-wrap gap-3">
            <span className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 font-bold">
              미처리: {stats.pending}건 🔴
            </span>
            <span className="px-4 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 font-bold">
              답변 완료: {stats.completed}건 🟢
            </span>
          </div>
        </section>

        {/* 검색 및 필터 */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 mb-3">검색 및 필터</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setSanctionOpen(!sanctionOpen); setDateOpen(false) }}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
              >
                제재 유형: {sanctionFilter ? SANCTION_TYPES.find((s) => s.id === sanctionFilter)?.label : '전체'}
                <ChevronDown size={16} className={sanctionOpen ? 'rotate-180' : ''} />
              </button>
              {sanctionOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSanctionOpen(false)} aria-hidden />
                  <div className="absolute top-full left-0 mt-1 py-1 bg-white rounded-lg border shadow-lg z-20 min-w-[140px]">
                    <button type="button" onClick={() => { setSanctionFilter(''); setSanctionOpen(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">전체</button>
                    {SANCTION_TYPES.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setSanctionFilter(s.id); setSanctionOpen(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">{s.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setDateOpen(!dateOpen); setSanctionOpen(false) }}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
              >
                접수일: {DATE_RANGES.find((d) => d.id === dateFilter)?.label}
                <ChevronDown size={16} className={dateOpen ? 'rotate-180' : ''} />
              </button>
              {dateOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDateOpen(false)} aria-hidden />
                  <div className="absolute top-full left-0 mt-1 py-1 bg-white rounded-lg border shadow-lg z-20 min-w-[120px]">
                    {DATE_RANGES.map((d) => (
                      <button key={d.id} type="button" onClick={() => { setDateFilter(d.id); setDateOpen(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">{d.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 min-w-[200px] flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="접수번호/닉네임 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySearchNow()
                  }}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <button
                type="button"
                onClick={applySearchNow}
                className="px-4 py-2 rounded-lg bg-[#22282E] text-white text-sm font-bold hover:bg-[#333]"
              >
                검색
              </button>
            </div>
          </div>
        </section>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-bold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">접수 번호</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">유저명(ID)</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">제재 사유</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">접수일시</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">검토</th>
                </tr>
              </thead>
              <tbody>
                {listLoading
                  ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                        불러오는 중…
                      </td>
                    </tr>
                    )
                  : rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#22282E]">#{row.receiptId}</td>
                      <td className="px-4 py-3 text-gray-700">{row.nickname} ({row.userId})</td>
                      <td className="px-4 py-3 text-gray-600">{row.sanctionTypeLabel || row.sanctionType}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/admin/appeals/${row.id}`}
                          className="inline-block px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200"
                        >
                          상세
                        </Link>
                      </td>
                    </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!listLoading && totalCount === 0 && (
            <div className="py-12 text-center text-gray-500">
              검색 결과가 없습니다.
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-6">
            <button
              type="button"
              onClick={() => goPage(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            {pageNumbers.map((p) =>
              typeof p === 'string' ? (
                <span key={p} className="px-1 text-gray-400 text-sm select-none">…</span>
              ) : (
                <button
                  type="button"
                  key={p}
                  onClick={() => goPage(p)}
                  className={`min-w-[36px] h-9 rounded-lg border text-sm font-bold transition
                    ${p === page
                      ? 'bg-[#22282E] border-[#22282E] text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => goPage(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {!listLoading && totalCount > 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            총 {totalCount}건 · {page} / {totalPages} 페이지
          </p>
        )}
      </div>
    </div>
  )
}
