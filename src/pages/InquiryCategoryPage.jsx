import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, MessageCircle } from 'lucide-react'
import {
  listCategoryHelpItems,
  INQUIRY_CATEGORY_HELP_LS_REV_KEY,
} from '../lib/inquiryCategoryHelp'
import { getHelpCategoryPresentation, listInquiryHelpCategories } from '../lib/inquiryHelpCategories'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

/** MZ 파스텔 — 문의 메인과 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

export function InquiryCategoryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams()
  const [categoryLabel, setCategoryLabel] = useState(null)
  const [categoryOk, setCategoryOk] = useState(null)
  const [items, setItems] = useState([])
  const [listLoading, setListLoading] = useState(true)

  const refreshList = useCallback(() => {
    if (!slug || categoryOk === false) {
      setItems([])
      setListLoading(false)
      return
    }
    if (categoryOk !== true) return
    setListLoading(true)
    listCategoryHelpItems(slug)
      .then((rows) => setItems(rows.map((r) => ({ id: r.id, title: r.title }))))
      .finally(() => setListLoading(false))
  }, [slug, categoryOk])

  useEffect(() => {
    const onUpdated = () => refreshList()
    window.addEventListener('vics:inquiry-category-help:updated', onUpdated)
    return () => window.removeEventListener('vics:inquiry-category-help:updated', onUpdated)
  }, [refreshList])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === INQUIRY_CATEGORY_HELP_LS_REV_KEY) refreshList()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refreshList])

  const wasHiddenRef = useRef(false)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') wasHiddenRef.current = true
      else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false
        refreshList()
      }
    }
    const onPageShow = (e) => {
      if (e.persisted) refreshList()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [refreshList])

  useEffect(() => {
    if (!slug) {
      setCategoryOk(false)
      setCategoryLabel(null)
      return
    }
    let cancelled = false
    setCategoryOk(null)
    listInquiryHelpCategories().then((rows) => {
      if (cancelled) return
      const row = rows.find((r) => r.slug === slug)
      if (!row) {
        setCategoryOk(false)
        setCategoryLabel(null)
        return
      }
      setCategoryOk(true)
      setCategoryLabel(row.label)
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    refreshList()
  }, [slug, location.key, refreshList])

  useEffect(() => {
    const onCat = () => {
      if (!slug) return
      listInquiryHelpCategories().then((rows) => {
        const row = rows.find((r) => r.slug === slug)
        if (row) {
          setCategoryOk(true)
          setCategoryLabel(row.label)
        }
      })
    }
    window.addEventListener('vics:inquiry-help-categories:updated', onCat)
    return () => window.removeEventListener('vics:inquiry-help-categories:updated', onCat)
  }, [slug])

  if (categoryOk === false) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-sm font-bold text-fuchsia-800/75 mb-5">존재하지 않는 카테고리예요.</p>
          <Link
            to="/inquiry"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-black shadow-md shadow-fuchsia-300/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            문의하기 메인으로
          </Link>
        </div>
      </div>
    )
  }

  if (categoryOk !== true || !categoryLabel) {
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center gap-3', PAGE_BG)}>
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
        <p className="text-sm font-bold text-fuchsia-700/60 animate-pulse">불러오는 중...</p>
      </div>
    )
  }

  const { Icon, color } = getHelpCategoryPresentation(slug)

  return (
    <div className={cn('min-h-screen relative overflow-hidden', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-gradient-radial from-fuchsia-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-gradient-radial from-pink-300/15 to-transparent blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-56 h-56 rounded-full bg-gradient-radial from-rose-300/12 to-transparent blur-3xl" />
      </div>

      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto relative z-10')}>
        {/* 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2.5', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-pink-200/60 hover:from-fuchsia-100 hover:to-pink-100 transition-all shrink-0 shadow-sm"
            aria-label="뒤로"
          >
            <ChevronLeft size={16} className="text-fuchsia-700" />
            <span className="text-xs font-bold text-fuchsia-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-md', color)}>
              <Icon size={14} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight truncate">{categoryLabel}</h1>
          </div>
        </div>

        <div className="px-4 py-6">
          {/* 카테고리 히어로 배너 */}
          <div className="rounded-2xl overflow-hidden mb-6 border border-pink-100/60 shadow-[0_4px_24px_-10px_rgba(244,114,182,0.2)]">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-white/95 via-fuchsia-50/40 to-pink-50/30">
              <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg ring-2 ring-white/80 shrink-0', color)}>
                <Icon size={28} className="text-white drop-shadow-sm" />
              </div>
              <div>
                <p className="text-[10px] font-black bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent uppercase tracking-widest mb-0.5">카테고리별 도움말</p>
                <p className="text-sm font-bold text-fuchsia-900/75">자주 묻는 질문을 골라 보세요</p>
              </div>
            </div>
          </div>

          {listLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
              <p className="text-sm font-bold text-fuchsia-700/60 animate-pulse">불러오는 중...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl overflow-hidden border border-pink-100/70 bg-white/92 shadow-sm text-center px-5 py-10">
              <div className="text-3xl mb-3">📂</div>
              <p className="text-sm font-bold text-fuchsia-800/80">이 카테고리에 등록된 도움말이 아직 없어요.</p>
              <p className="mt-1.5 text-xs text-fuchsia-600/65">운영에서 항목을 등록하면 여기에 표시돼요.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item, i) => (
                <Link
                  key={item.id}
                  to={`/inquiry/category/${slug}/help/${item.id}`}
                  className={cn(
                    'relative flex items-center justify-between gap-3 p-4 rounded-2xl overflow-hidden',
                    'border border-pink-100/70 bg-white/92 shadow-[0_4px_20px_-10px_rgba(244,114,182,0.15)] backdrop-blur-[2px]',
                    'hover:border-fuchsia-300/60 hover:shadow-[0_8px_28px_-10px_rgba(192,38,211,0.25)] hover:-translate-y-0.5',
                    'transition-all duration-200 group'
                  )}
                >
                  {/* 좌측 액센트 바 */}
                  <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b opacity-50 group-hover:opacity-100 transition-opacity', color)} />
                  {/* 번호 배지 */}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-100 to-pink-100 text-xs font-black text-fuchsia-700 ml-1">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-bold text-fuchsia-950 group-hover:text-fuchsia-800 transition-colors">
                    {item.title}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-50 to-pink-50 border border-pink-100/60 group-hover:from-fuchsia-100 group-hover:to-pink-100 flex items-center justify-center shrink-0 transition-all">
                    <ChevronRight size={16} className="text-fuchsia-400 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* 1:1 문의 CTA */}
          <div className="mt-8 rounded-2xl overflow-hidden border border-emerald-200/50 shadow-sm">
            <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            <div className="flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-cyan-50/30">
              <p className="text-sm font-bold text-emerald-900/80">원하는 답변을 못 찾으셨나요?</p>
              <Link
                to="/inquiry/form"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white text-sm font-black shadow-[0_4px_14px_-4px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
              >
                <MessageCircle size={15} />
                1:1 문의
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
