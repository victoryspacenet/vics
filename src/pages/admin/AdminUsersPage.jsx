import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  getUsersPaged,
  STATUS_OPTIONS,
  REPORT_SORT_OPTIONS,
  ACTIVITY_SORT_OPTIONS,
} from '../../lib/userAdminStorage'

const PAGE_SIZE = 10

const USER_FILTER_SELECT_BASE =
  'min-w-[9.5rem] cursor-pointer rounded-xl border-2 px-3 py-2 text-sm font-bold shadow-sm transition-all hover:brightness-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-1'

const USER_FILTER_SELECT_STYLES = {
  status:
    'border-blue-300/80 bg-gradient-to-br from-blue-50 to-sky-50/90 text-blue-950 focus:ring-blue-400/50',
  reportSort:
    'border-violet-300/80 bg-gradient-to-br from-violet-50 to-fuchsia-50/80 text-violet-950 focus:ring-violet-400/50',
  pointsSort:
    'border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50/80 text-amber-950 focus:ring-amber-400/50',
}

const STATUS_LABEL = {
  active: '활성',
  caution: '주의',
  suspended: '정지',
  blocked: '차단',
  withdrawn: '탈퇴',
}

export function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('')
  const [page, setPage] = useState(1)
  const [fullListFallback, setFullListFallback] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await getUsersPaged({
        page,
        pageSize: PAGE_SIZE,
        searchTrim: debouncedSearch,
        statusFilter,
        sortBy,
      })
      setUsers(res.users || [])
      setTotalCount(typeof res.totalCount === 'number' ? res.totalCount : 0)
      setFullListFallback(Boolean(res.usedFullListFallback))
    } catch {
      setUsers([])
      setTotalCount(0)
      setFullListFallback(false)
    } finally {
      setListLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, sortBy])

  useEffect(() => {
    void loadList()
    const onUpdated = () => {
      void loadList()
    }
    window.addEventListener('vics:adminUsers:updated', onUpdated)
    return () => window.removeEventListener('vics:adminUsers:updated', onUpdated)
  }, [loadList])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const isReportSort = ['reports_desc', 'reports_asc'].includes(sortBy)
  const isActivitySort = ['created_desc', 'created_asc', 'votes_desc', 'votes_asc'].includes(sortBy)

  const formatPointCell = (n) => `${(n ?? 0).toLocaleString()}P`

  if (listLoading && users.length === 0 && totalCount === 0) {
    return (
      <div className="max-w-6xl py-12 text-center text-gray-500">불러오는 중…</div>
    )
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-[#22282E]">유저 관리 센터</h1>
        {fullListFallback ? (
          <p className="mt-1 text-xs text-amber-800/90">
            프로필 DB가 비어 있어 데모 목록을 전부 불러옵니다. 실서비스에서는 서버 페이징만 사용합니다.
          </p>
        ) : null}
      </div>

      {/* 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="relative min-w-[180px] flex-1 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-emerald-600/80" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            placeholder="검색: 닉네임/이메일"
            className="w-full rounded-xl border-2 border-emerald-300/80 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 py-2.5 pl-10 pr-4 text-sm font-semibold text-[#22282E] shadow-sm placeholder:text-emerald-800/35 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
          />
        </div>
        <select
          className={cn(USER_FILTER_SELECT_BASE, USER_FILTER_SELECT_STYLES.status)}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === 'all' ? '상태: ' : ''}{o.label}
            </option>
          ))}
        </select>
        <select
          className={cn(USER_FILTER_SELECT_BASE, USER_FILTER_SELECT_STYLES.reportSort)}
          value={isReportSort ? sortBy : ''}
          onChange={(e) => {
            setSortBy(e.target.value || '')
            setPage(1)
          }}
          aria-label="신고 수 정렬"
        >
          <option value="">신고 정렬</option>
          {REPORT_SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className={cn(USER_FILTER_SELECT_BASE, USER_FILTER_SELECT_STYLES.pointsSort)}
          value={isActivitySort ? sortBy : ''}
          onChange={(e) => {
            setSortBy(e.target.value || '')
            setPage(1)
          }}
          aria-label="생성·투표 포인트 정렬"
        >
          <option value="">생성·투표 포인트 정렬</option>
          {ACTIVITY_SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4 relative">
        {listLoading ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/60 text-sm text-gray-500">
            갱신 중…
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border-spacing-0">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300">
                <th className="px-4 py-3 text-left font-bold text-gray-600">닉네임</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-[7.25rem]">생성 포인트</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-[7.25rem]">투표 포인트</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 min-w-[11rem]">생성 승/패(투표 승/패)</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-20">신고수</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 w-20">상태</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-gray-200 hover:bg-gray-50/50 ${
                    u.reportsCount >= 10 ? 'bg-amber-50/50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/admin/users/${u.id}`} className="hover:underline text-[#22282E]">
                      {u.nickname}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatPointCell(u.matchupResultPoints)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPointCell(u.voteParticipationPoints)}</td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap">
                    {u.matchupsWins ?? 0}/{u.matchupsLosses ?? 0} ({u.voteWins ?? 0}/{u.voteLosses ?? 0})
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.reportsCount >= 10 ? 'font-bold text-red-600' : ''}>
                      {u.reportsCount}건
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        u.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : u.status === 'caution'
                            ? 'bg-amber-100 text-amber-700'
                            : u.status === 'suspended'
                              ? 'bg-red-100 text-red-700'
                              : u.status === 'blocked'
                                ? 'bg-neutral-900 text-white'
                                : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">검색 결과가 없습니다.</div>
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="flex justify-center gap-1">
        <button
          type="button"
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
              type="button"
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
          type="button"
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
