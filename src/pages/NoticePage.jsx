import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Flame, LayoutTemplate, List, Pencil, MessageCircle } from 'lucide-react'
import { getAdminNoticesPaged, getAdminPinnedNoticeCandidates } from '../lib/noticeStorage'
import { filterPublicNoticeRows } from '../lib/noticePublicFeed'
import { useAuthStore } from '../store/authStore'
import { canAccessAdmin } from '../lib/adminAuth'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'
import { canViewNotice } from '../lib/tiers'
import { NoticeExposureBadge } from '../components/notice/NoticeExposureBadge'
import {
  parseNoticePageParam,
  buildNoticeListSearchParams,
  buildNoticeListSearchString,
} from '../lib/noticeListNav'

/** MZ 파스텔 — 문의·마이페이지 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const FILTER_TABS = [
  { id: 'all', label: '전체' },
  { id: 'notice', label: '공지' },
  { id: 'event', label: '이벤트' },
  { id: 'update', label: '업데이트' },
  { id: 'winner', label: '당첨자' },
]

const PAGE_SIZE = 5

export function NoticePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterFromUrl = searchParams.get('filter')
  const filter = FILTER_TABS.some((t) => t.id === filterFromUrl) ? filterFromUrl : 'all'

  const [adminListRows, setAdminListRows] = useState([])
  const [adminTotalCount, setAdminTotalCount] = useState(0)
  const [bannerNotice, setBannerNotice] = useState(null)
  const [listLoading, setListLoading] = useState(true)

  const pageFromUrl = parseNoticePageParam(searchParams.get('page'))
  const totalPages = Math.max(1, Math.ceil(adminTotalCount / PAGE_SIZE))
  const page = Math.min(pageFromUrl, totalPages)

  useEffect(() => {
    let cancelled = false
    const reload = async () => {
      setListLoading(true)
      try {
        const [pinned, pageData] = await Promise.all([
          getAdminPinnedNoticeCandidates({ category: filter, limit: 10, forPublicFeed: true }),
          getAdminNoticesPaged({
            page,
            pageSize: PAGE_SIZE,
            category: filter,
            listOnly: true,
            forPublicFeed: true,
          }),
        ])
        if (cancelled) return
        const prof = profile ?? null
        const visibleRows = filterPublicNoticeRows(pageData.notices).filter((n) =>
          canViewNotice(n, prof),
        )
        const pinnedVisible = filterPublicNoticeRows(pinned)
        const banner =
          pinnedVisible.find((n) => canViewNotice(n, prof)) ||
          visibleRows.find((n) => canViewNotice(n, prof)) ||
          null
        setBannerNotice(banner)
        const list = banner
          ? visibleRows.filter((n) => n.id !== banner.id)
          : visibleRows
        setAdminListRows(list)
        setAdminTotalCount(pageData.totalCount)
      } catch {
        if (!cancelled) {
          setAdminListRows([])
          setAdminTotalCount(0)
          setBannerNotice(null)
        }
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    void reload()
    window.addEventListener('vics:notices:updated', reload)
    return () => {
      cancelled = true
      window.removeEventListener('vics:notices:updated', reload)
    }
  }, [filter, page, profile])

  const handleFilterChange = (newFilter) => {
    setSearchParams(buildNoticeListSearchParams(newFilter, 1))
  }

  const goToPage = (nextPage) => {
    const p = buildNoticeListSearchParams(filter, nextPage)
    setSearchParams(p)
  }

  useEffect(() => {
    if (pageFromUrl <= totalPages) return
    const p = buildNoticeListSearchParams(filter, totalPages)
    setSearchParams(p, { replace: true })
  }, [pageFromUrl, totalPages, filter, setSearchParams])

  const paginatedList = adminListRows
  const listQs = buildNoticeListSearchString(filter, page)

  return (
    <div className={cn('min-h-screen w-full min-w-0', PAGE_BG)}>
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto w-full')}>
        {/* 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2 sm:gap-3 flex-wrap', HEADER_GLASS)}>
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors shrink-0"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-fuchsia-900" />
          </button>
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 min-w-0 tracking-tight">공지사항</h1>
          {canAccessAdmin(user) && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <Link
                to="/admin/notice/list"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 to-cyan-50/80 text-sky-900 text-xs font-black hover:border-sky-300 hover:shadow-md transition-all"
                title="공지 목록·삭제"
              >
                <List size={17} className="shrink-0" />
                <span className="hidden sm:inline">목록</span>
              </Link>
              <Link
                to="/admin/notice/popup/list"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-indigo-50/80 text-violet-800 text-xs font-black hover:border-violet-300 hover:shadow-md transition-all"
                title="팝업 공지"
              >
                <LayoutTemplate size={17} className="shrink-0" />
                <span className="hidden sm:inline">팝업</span>
              </Link>
              <Link
                to="/admin/notice/new"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-teal-50/70 text-emerald-900 text-xs font-black hover:border-emerald-300 hover:shadow-md transition-all"
                title="공지 작성"
              >
                <Pencil size={17} className="shrink-0" />
                <span className="hidden sm:inline">작성</span>
              </Link>
              <Link
                to="/admin/inquiry"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/60 text-amber-900 text-xs font-black hover:border-amber-300 hover:shadow-md transition-all"
                title="1:1 문의 관리"
              >
                <MessageCircle size={17} className="shrink-0" />
                <span className="hidden sm:inline">1:1 문의</span>
              </Link>
            </div>
          )}
        </div>

        <div className="px-4 py-4">
          {/* 필터 탭 */}
          <div className="flex justify-center gap-2 mb-6 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleFilterChange(tab.id)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-2xl text-sm font-black transition-all',
                  filter === tab.id
                    ? 'bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white shadow-md shadow-fuchsia-300/40 ring-1 ring-white/50'
                    : 'bg-white/90 text-fuchsia-800/80 border border-pink-200/80 hover:bg-fuchsia-50 hover:border-fuchsia-300/60'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 🔥 지금 가장 핫한 소식 - 배너 */}
          {bannerNotice && (
            <section className="mb-8">
              <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-orange-200/60 bg-gradient-to-br from-orange-200 to-rose-300 shadow-sm">
                  <Flame size={18} className="text-orange-600" />
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 flex-row items-center whitespace-nowrap rounded-lg px-2.5 py-0.5 text-xs font-black [writing-mode:horizontal-tb]',
                    bannerNotice.tagColor,
                  )}
                >
                  {bannerNotice.tag}
                </span>
                <NoticeExposureBadge notice={bannerNotice} />
                <h2 className="min-w-0 text-sm font-black tracking-tight text-fuchsia-950">
                  지금 가장 핫한 소식
                </h2>
              </div>
              <Link
                to={`/notice/${bannerNotice.id}${listQs}`}
                className="block rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-fuchsia-500 to-rose-500 shadow-[0_12px_40px_-12px_rgba(244,114,182,0.45)] hover:shadow-[0_16px_48px_-12px_rgba(192,38,211,0.4)] hover:scale-[1.01] transition-all ring-2 ring-white/50"
              >
                <div className="flex flex-col justify-end gap-1 px-4 py-3.5 sm:px-5 sm:py-4 text-white">
                  <p className="text-base font-black leading-snug drop-shadow-md sm:text-lg">
                    {bannerNotice.title}
                  </p>
                  <p className="text-sm text-white/95 font-semibold leading-snug drop-shadow">
                    {bannerNotice.summary}
                  </p>
                </div>
              </Link>
            </section>
          )}

          {/* 최신 게시글 */}
          <section>
            <h2 className="text-sm font-black text-fuchsia-950 mb-3 tracking-tight">최신 게시글</h2>
            <div className="space-y-2.5">
              {listLoading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(SECTION_CARD, 'h-20 animate-pulse border-pink-100/60 bg-fuchsia-50/40')}
                    />
                  ))}
                </div>
              ) : paginatedList.length === 0 ? (
                <div className={cn(SECTION_CARD, 'py-12 text-center text-sm text-fuchsia-700/60 font-medium')}>
                  등록된 공지가 없어요
                </div>
              ) : (
                paginatedList.map((notice) => (
                <Link
                  key={notice.id}
                  to={`/notice/${notice.id}${listQs}`}
                  className={cn(
                    SECTION_CARD,
                    'flex items-center gap-3 p-4 border-pink-100/70',
                    'hover:border-fuchsia-300/60 hover:shadow-[0_8px_28px_-12px_rgba(192,38,211,0.22)] hover:-translate-y-0.5',
                    'transition-all duration-200 group'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black ${notice.tagColor}`}>
                        {notice.tag}
                      </span>
                      <NoticeExposureBadge notice={notice} />
                      {notice.isHighlighted && (
                        <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-500 text-white text-[9px] font-black shadow-sm">
                          N
                        </span>
                      )}
                      <p className="text-sm font-bold text-fuchsia-950 truncate group-hover:text-fuchsia-800">
                        {notice.title}
                      </p>
                    </div>
                    <p className="text-xs text-fuchsia-700/55 font-medium">
                      {notice.date} | {notice.author}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-fuchsia-50/90 border border-pink-100/60 group-hover:bg-fuchsia-100 flex items-center justify-center transition-colors shrink-0">
                    <ChevronRight size={18} className="text-fuchsia-400 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))
              )}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-xl border border-pink-200/80 bg-white/80 flex items-center justify-center text-fuchsia-800 hover:bg-fuchsia-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="이전 페이지"
                >
                  <ArrowLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : Math.max(1, page - 2 + i)
                  if (p > totalPages) return null
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      className={cn(
                        'w-9 h-9 rounded-xl text-sm font-black transition-all',
                        page === p
                          ? 'bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white shadow-md shadow-fuchsia-300/40 ring-1 ring-white/50'
                          : 'border border-pink-200/80 bg-white/80 text-fuchsia-800 hover:bg-fuchsia-50'
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-xl border border-pink-200/80 bg-white/80 flex items-center justify-center text-fuchsia-800 hover:bg-fuchsia-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="다음 페이지"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
