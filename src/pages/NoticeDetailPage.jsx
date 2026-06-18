import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bell, ChevronLeft, ChevronUp, ChevronDown, List, Pencil, Share2, Swords, Trash2, Vote } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { copyToClipboard, cn } from '../lib/utils'
import { getNoticeById, getAdminNoticesPaged, deleteNotice } from '../lib/noticeStorage'
import { canAccessAdmin } from '../lib/adminAuth'
import { canViewNotice, getTierById } from '../lib/tiers'
import { NoticeExposureBadge } from '../components/notice/NoticeExposureBadge'
import { buildNoticeListSearchString, parseNoticePageParam } from '../lib/noticeListNav'
import { refreshMatchupMediaImagesInHtmlRoot } from '../lib/noticeInlineImageUpload'
import { NoticeDeleteConfirmModal } from '../components/notice/NoticeDeleteConfirmModal'

/** MZ 파스텔 — 공지 목록과 동일 계열 */
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

function isUuidParam(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))
}

function sortNoticesForNav(a, b) {
  const pinnedA = a.isBanner ? 1 : 0
  const pinnedB = b.isBanner ? 1 : 0
  if (pinnedB !== pinnedA) return pinnedB - pinnedA
  const da = a.date?.replace(/\./g, '') || '0'
  const db = b.date?.replace(/\./g, '') || '0'
  return db.localeCompare(da)
}

/** 본문 HTML의 Supabase 스토리지 이미지를 서명 URL 등으로 바꿔 비공개 버킷에서도 보이게 합니다. */
function NoticeArticleHtml({ html, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    void refreshMatchupMediaImagesInHtmlRoot(el)
  }, [html])
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function NoticeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filter = searchParams.get('filter') || 'all'
  const { showToast, openCreateDrawer, openLoginModal } = useUIStore()
  const { user, profile } = useAuthStore()

  const [notice, setNotice] = useState(null)
  const [navList, setNavList] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filterParam = FILTER_TABS.some((t) => t.id === filter) ? filter : 'all'

  useEffect(() => {
    let cancelled = false
    const reload = async () => {
      setLoadState('loading')
      const prof = profile ?? null
      try {
        const forPublicFeed = true
        const n = isUuidParam(id) ? await getNoticeById(id, { forPublicFeed }) : null
        if (cancelled) return
        setNotice(n)

        const { notices: dbRows } = await getAdminNoticesPaged({
          page: 1,
          pageSize: 100,
          category: filterParam,
          listOnly: false,
          forPublicFeed,
        })
        if (cancelled) return
        const visible = dbRows.filter((x) => canViewNotice(x, prof))
        const banner = visible.find((x) => x.isBanner) || visible[0]
        const nav = banner ? [banner, ...visible.filter((x) => x.id !== banner.id)] : visible
        setNavList(nav)
        setLoadState(n ? 'ok' : 'notfound')
      } catch {
        if (!cancelled) {
          setNotice(null)
          setNavList([])
          setLoadState('notfound')
        }
      }
    }
    void reload()
    window.addEventListener('vics:notices:updated', reload)
    return () => {
      cancelled = true
      window.removeEventListener('vics:notices:updated', reload)
    }
  }, [id, filterParam, profile])

  const currentIndex = navList.findIndex((n) => String(n.id) === String(id))
  const prevNotice = currentIndex > 0 ? navList[currentIndex - 1] : null
  const nextNotice = currentIndex >= 0 && currentIndex < navList.length - 1 ? navList[currentIndex + 1] : null

  const listQs = buildNoticeListSearchString(filterParam, parseNoticePageParam(searchParams.get('page')))

  const canDeleteNotice =
    canAccessAdmin(user) && isUuidParam(id) && notice?.source === 'admin'

  const handleDeleteConfirm = async () => {
    if (!id || !canDeleteNotice) return
    setDeleting(true)
    try {
      await deleteNotice(id)
      setDeleteOpen(false)
      showToast('삭제됐어요.', 'success')
      navigate('/admin/notice/list')
    } catch (e) {
      showToast(e?.message || '삭제에 실패했어요.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'px-8 py-10 text-sm font-bold text-fuchsia-700/70 animate-pulse')}>불러오는 중…</div>
      </div>
    )
  }

  // 공지 없음
  if (loadState === 'notfound' || !notice) {
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full space-y-3')}>
          <p className="text-3xl">📭</p>
          <p className="text-sm font-bold text-fuchsia-800/75">존재하지 않는 공지입니다.</p>
          <Link
            to={`/notice${listQs}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-md shadow-fuchsia-300/35 hover:brightness-105 transition-all"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 티어 제한 공지 — 접근 차단
  if (!canViewNotice(notice, profile ?? null)) {
    const requiredTier = getTierById(notice.targetTierId)
    const exactOnly = notice.targetTierExact === true
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full space-y-4')}>
          <div className="text-5xl">{requiredTier?.emoji || '🔒'}</div>
          <p className="text-base font-black text-fuchsia-950">
            {exactOnly
              ? `${requiredTier?.name || '특정'} 티어 전용 공지예요`
              : `${requiredTier?.name || '특정'} 티어 이상 공지예요`}
          </p>
          <p className="text-sm font-medium leading-relaxed text-fuchsia-700/70">
            {user
              ? exactOnly
                ? `이 공지는 ${requiredTier?.emoji} ${requiredTier?.name} 티어와 정확히 일치할 때만 볼 수 있어요.\n현재 티어를 확인해 주세요.`
                : `이 공지는 ${requiredTier?.emoji} ${requiredTier?.name} 티어 이상에게 공개돼요.\n현재 티어를 확인해 주세요.`
              : '로그인 후 본인의 티어를 확인해야 열람할 수 있어요.'}
          </p>
          {!user && (
            <button
              type="button"
              onClick={openLoginModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-fuchsia-300/35 transition hover:brightness-105"
            >
              로그인하기
            </button>
          )}
          <Link
            to={`/notice${listQs}`}
            className="block text-sm font-black text-fuchsia-600 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
          >
            공지 목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen w-full min-w-0 relative overflow-hidden', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-gradient-radial from-fuchsia-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-gradient-radial from-pink-300/15 to-transparent blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-56 h-56 rounded-full bg-gradient-radial from-rose-300/12 to-transparent blur-3xl" />
      </div>
      <div className="max-w-2xl mx-auto w-full relative z-10">
        {/* 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center justify-between gap-3', HEADER_GLASS)}>
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-pink-200/60 hover:from-fuchsia-100 hover:to-pink-100 transition-all shrink-0 shadow-sm"
              aria-label="뒤로"
            >
              <ChevronLeft size={16} className="text-fuchsia-700" />
              <span className="text-xs font-bold text-fuchsia-700">뒤로</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-md shadow-fuchsia-300/40">
                <Bell size={14} className="text-white" />
              </span>
              <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent truncate tracking-tight">공지사항</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {notice.category === 'event' && (
              <button
                type="button"
                onClick={async () => {
                  const url = window.location.href
                  const text = `${notice.title}\n${url}`
                  await copyToClipboard(text)
                  showToast('친구에게 공유할 링크가 복사됐어요! 💬', 'success')
                }}
                className="p-2 rounded-xl border border-amber-200/70 bg-amber-50/90 text-amber-700 hover:bg-amber-100 transition-colors shadow-sm"
                aria-label="공유"
              >
                <Share2 size={20} />
              </button>
            )}
            {canDeleteNotice && (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-bold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <Trash2 size={16} />
                삭제
              </button>
            )}
          </div>
        </div>

        <article className="mx-4 mt-4 mb-4 rounded-2xl overflow-hidden border border-pink-100/70 bg-white/92 shadow-[0_6px_32px_-10px_rgba(244,114,182,0.25)] backdrop-blur-[2px]">
          {/* 상단 컬러 바 */}
          <div className="h-1.5 bg-gradient-to-r from-fuchsia-400 via-pink-500 to-rose-400" />
          <div className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex flex-row items-center px-2.5 py-0.5 rounded-lg text-xs font-black whitespace-nowrap [word-break:keep-all]',
                  notice.tagColor
                )}
              >
                {notice.tag}
              </span>
              <NoticeExposureBadge notice={notice} className="text-[11px]" />
            </div>
            <h2 className="text-xl font-black bg-gradient-to-r from-fuchsia-800 via-pink-700 to-rose-700 bg-clip-text text-transparent mb-2 leading-snug">{notice.title}</h2>
            <p className="text-sm text-fuchsia-700/55 font-medium mb-6">
              {notice.date} · {notice.author}
            </p>
            {notice.content?.includes('<') ? (
              <NoticeArticleHtml
                html={notice.content}
                className="text-[15px] text-fuchsia-900/90 leading-[1.8] prose prose-p:my-2 prose-img:rounded-lg max-w-none prose-headings:text-fuchsia-950"
              />
            ) : (
              <div className="text-[15px] text-fuchsia-900/90 leading-[1.8] whitespace-pre-line">
                {notice.content || ''}
              </div>
            )}
          </div>
        </article>

        {/* CTA: 플랫폼 활동 유도 */}
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden border border-emerald-200/50 bg-gradient-to-br from-emerald-950/80 via-teal-950/75 to-cyan-950/70 px-4 py-5 text-center shadow-[0_4px_20px_-6px_rgba(16,185,129,0.35)]">
          <p className="text-sm font-black text-emerald-300 mb-3">이 공지를 읽고 바로 참여해보세요! 🚀</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-gradient-to-r from-lime-400 to-emerald-500 text-[#0f1f0f] hover:brightness-110 transition-all shadow-[0_4px_14px_-4px_rgba(132,204,22,0.5)] ring-1 ring-white/30"
            >
              <Vote size={18} />
              매치업 투표하러 가기
            </Link>
            <button
              type="button"
              onClick={() => (user ? openCreateDrawer() : openLoginModal())}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500 text-white hover:brightness-110 transition-all shadow-[0_4px_14px_-4px_rgba(192,38,211,0.45)]"
            >
              <Swords size={18} />
              매치업 만들기
            </button>
          </div>
        </div>

        {/* 하단 네비게이션 */}
        <div className="px-4 pb-8 pt-2">
          <div className="rounded-2xl border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px] p-4 flex flex-wrap gap-2 justify-center items-center">
            {prevNotice ? (
              <Link
                to={`/notice/${prevNotice.id}${listQs}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-gradient-to-r from-sky-100 to-blue-100/80 text-sky-700 border border-sky-200/60 hover:from-sky-200/80 hover:to-blue-200/60 transition-all shadow-sm"
              >
                <ChevronUp size={16} />
                이전글
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold bg-sky-50/60 text-sky-300/60 border border-sky-100/60 cursor-not-allowed">
                <ChevronUp size={16} />
                이전글
              </span>
            )}
            {nextNotice ? (
              <Link
                to={`/notice/${nextNotice.id}${listQs}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-gradient-to-r from-amber-100 to-orange-100/80 text-amber-700 border border-amber-200/60 hover:from-amber-200/80 hover:to-orange-200/60 transition-all shadow-sm"
              >
                <ChevronDown size={16} />
                다음글
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold bg-amber-50/60 text-amber-300/60 border border-amber-100/60 cursor-not-allowed">
                <ChevronDown size={16} />
                다음글
              </span>
            )}
            <Link
              to={`/notice${listQs}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white hover:brightness-105 transition-all shadow-[0_4px_14px_-4px_rgba(192,38,211,0.4)] ring-1 ring-white/30"
            >
              <List size={16} />
              목록으로
            </Link>
            {canAccessAdmin(user) && notice.source === 'admin' && (
              <Link
                to={`/admin/notice/edit/${notice.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-gradient-to-r from-violet-100 to-indigo-100/80 text-violet-800 border border-violet-200/70 hover:from-violet-200/80 hover:to-indigo-200/60 transition-all shadow-sm"
              >
                <Pencil size={16} />
                수정하기
              </Link>
            )}
          </div>
        </div>
      </div>  {/* max-w-2xl */}

      <NoticeDeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemLabel={notice.title}
        confirming={deleting}
      />
    </div>
  )
}
