import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Flame, FolderOpen, Search, Clock } from 'lucide-react'
import {
  getAdminInquiries,
  ADMIN_STATUS,
  INQUIRY_CATEGORIES,
} from '../../lib/inquiryAdminStorage'
import { supabase } from '../../lib/supabase'

async function loadSLAHours() {
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'sla')
    .single()
  return data?.value?.hours ?? 12
}

/** Supabase inquiries → 어드민 목록 공통 포맷으로 변환 */
function normalizeSupabaseInquiry(row) {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    status: row.status === 'completed' ? ADMIN_STATUS.completed : ADMIN_STATUS.pending,
    category: row.category,
    categoryLabel: row.category_label || row.category,
    title: row.title,
    content: row.content,
    nickname: row.profiles?.nickname || '(알 수 없음)',
    createdAt: row.created_at,
    attachments: row.image_urls || [],
    _source: 'supabase',
  }
}

const STATUS_LABELS = {
  [ADMIN_STATUS.pending]: '미답변',
  [ADMIN_STATUS.completed]: '완료',
}

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PAGE_SIZE = 10

export function InquiryAdminListPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [slaHours, setSlaHours] = useState(12)
  const [allInquiries, setAllInquiries] = useState([])
  const [loading, setLoading] = useState(true)

  const loadInquiries = useCallback(async () => {
    setLoading(true)
    try {
      const sla = await loadSLAHours()
      setSlaHours(sla)

      // inquiries 조회
      const { data: sbRows, error } = await supabase
        .from('inquiries')
        .select('id, receipt_id, user_id, category, category_label, title, content, status, image_urls, created_at')
        .order('created_at', { ascending: false })

      if (error || !sbRows) throw error || new Error('no data')

      // 자동응대가 발송된 inquiry_id 목록 조회 → 어드민 목록에서 제외
      const { data: autoReplied } = await supabase
        .from('inquiry_replies')
        .select('inquiry_id')
        .eq('reply_type', 'auto')
      const autoRepliedIds = new Set((autoReplied || []).map((r) => r.inquiry_id))

      // 자동응대 제외 필터링
      const filteredRows = sbRows.filter((r) => !autoRepliedIds.has(r.id))

      // user_id 목록으로 profiles 별도 조회
      const userIds = [...new Set(filteredRows.map((r) => r.user_id).filter(Boolean))]
      let profileMap = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nickname')
          .in('id', userIds)
        if (profiles) {
          profiles.forEach((p) => { profileMap[p.id] = p.nickname })
        }
      }

      const supabaseItems = filteredRows.map((row) => normalizeSupabaseInquiry({
        ...row,
        profiles: { nickname: profileMap[row.user_id] || '(알 수 없음)' },
      }))

      // 목 데이터 중복 제거 후 병합
      const sbReceiptIds = new Set(supabaseItems.map((i) => i.receiptId))
      const mockItems = (await getAdminInquiries()).filter(
        (m) => !sbReceiptIds.has(m.receiptId) && !sbReceiptIds.has(m.id)
      )
      setAllInquiries([...supabaseItems, ...mockItems])
    } catch {
      // Supabase 실패 시 목 데이터로 fallback
      setAllInquiries(await getAdminInquiries())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInquiries() }, [loadInquiries])

  const isSlaBreached = (inquiry) => {
    if (inquiry.status !== ADMIN_STATUS.pending) return false
    const ageMs = Date.now() - new Date(inquiry.createdAt).getTime()
    return ageMs > slaHours * 60 * 60 * 1000
  }

  const filtered = useMemo(() => {
    return allInquiries.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false
      if (categoryFilter && i.category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchTitle = (i.title || '').toLowerCase().includes(q)
        const matchNick = (i.nickname || '').toLowerCase().includes(q)
        if (!matchTitle && !matchNick) return false
      }
      return true
    })
  }, [allInquiries, statusFilter, categoryFilter, searchQuery])

  const stats = useMemo(() => ({
    pending:   allInquiries.filter((i) => i.status === ADMIN_STATUS.pending).length,
    completed: allInquiries.filter((i) => i.status === ADMIN_STATUS.completed).length,
  }), [allInquiries])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const slaBreachedCount = allInquiries.filter(isSlaBreached).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/notice" className="hover:text-[#22282E]">고객지원 관리</Link>
            <span>/</span>
            <span className="text-[#22282E] font-semibold">1:1 문의 내역</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/inquiry/hot-faq"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800 hover:bg-orange-100"
            >
              <Flame size={14} />
              메인 FAQ
            </Link>
            <Link
              to="/admin/inquiry/category-faq"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100"
            >
              <FolderOpen size={14} />
              카테고리 FAQ
            </Link>
          </div>
        </div>

        {/* SLA 초과 경고 배너 */}
        {slaBreachedCount > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm">
            <Clock size={16} className="text-red-500 shrink-0" />
            <span className="text-red-700 font-bold">
              SLA {slaHours}h 초과 미처리 문의 {slaBreachedCount}건
            </span>
            <span className="text-red-500">— 즉시 확인이 필요합니다.</span>
          </div>
        )}

        {/* 현황 요약 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-white border border-red-100">
            <p className="text-xs text-gray-500 mb-0.5">미답변</p>
            <p className="text-2xl font-black text-red-600">{stats.pending}건</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-emerald-100">
            <p className="text-xs text-gray-500 mb-0.5">완료</p>
            <p className="text-2xl font-black text-emerald-600">{stats.completed}건</p>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative">
            <button
              onClick={() => { setStatusOpen(!statusOpen); setCategoryOpen(false) }}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
            >
              상태: {statusFilter ? STATUS_LABELS[statusFilter] : '전체'}
              <ChevronDown size={16} className={statusOpen ? 'rotate-180' : ''} />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute top-full left-0 mt-1 py-1 bg-white rounded-lg border shadow-lg z-20 min-w-[120px]">
                  <button onClick={() => { setStatusFilter(''); setStatusOpen(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">전체</button>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => { setStatusFilter(k); setStatusOpen(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">{v}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setCategoryOpen(!categoryOpen); setStatusOpen(false) }}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
            >
              유형: {categoryFilter ? INQUIRY_CATEGORIES.find((c) => c.id === categoryFilter)?.label : '전체'}
              <ChevronDown size={16} className={categoryOpen ? 'rotate-180' : ''} />
            </button>
            {categoryOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCategoryOpen(false)} />
                <div className="absolute top-full left-0 mt-1 py-1 bg-white rounded-lg border shadow-lg z-20 min-w-[140px] max-h-60 overflow-y-auto">
                  <button onClick={() => { setCategoryFilter(''); setCategoryOpen(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">전체</button>
                  {INQUIRY_CATEGORIES.map((c) => (
                    <button key={c.id} onClick={() => { setCategoryFilter(c.id); setCategoryOpen(false) }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">{c.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex-1 min-w-[180px] flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                placeholder="닉네임/제목 검색..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-20">상태</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-24">유형</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 min-w-[160px]">제목</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-24">닉네임</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-20">등록일시</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600 w-20">관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      불러오는 중...
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                ) : paginated.map((row) => {
                  const breached = isSlaBreached(row)
                  return (
                    <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${breached ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        {row.status === ADMIN_STATUS.pending ? (
                          breached ? (
                            <div className="flex flex-col gap-1">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 whitespace-nowrap">미답변</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
                                <Clock size={10} />SLA초과
                              </span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600">미답변</span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-600">완료</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.categoryLabel || row.category}</td>
                      <td className="px-4 py-3 font-medium text-[#22282E] truncate max-w-[200px]">{row.title}</td>
                      <td className="px-4 py-3 text-gray-600">{row.nickname}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/admin/inquiry/${row.id}`}
                          className="text-emerald-600 font-bold hover:underline"
                        >
                          {row.status === ADMIN_STATUS.completed ? '보기' : '답변'}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-40"
            >
              <ArrowLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : Math.max(1, page - 2 + i)
              if (p > totalPages) return null
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold ${page === p ? 'bg-[#22282E] text-white' : 'border hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-40"
            >
              <span className="rotate-180 inline-block"><ArrowLeft size={16} /></span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
