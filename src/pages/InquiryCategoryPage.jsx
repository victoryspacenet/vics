import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react'
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
          <p className="text-sm font-medium text-fuchsia-800/75 mb-4">존재하지 않는 카테고리예요.</p>
          <Link
            to="/inquiry"
            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
          >
            문의하기 메인으로
          </Link>
        </div>
      </div>
    )
  }

  if (categoryOk !== true || !categoryLabel) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', PAGE_BG)}>
        <Loader2 className="h-9 w-9 animate-spin text-fuchsia-300" />
      </div>
    )
  }

  const { Icon, color } = getHelpCategoryPresentation(slug)

  return (
    <div className={cn('min-h-screen', PAGE_BG)}>
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-3', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-fuchsia-900" />
          </button>
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 tracking-tight">{categoryLabel}</h1>
        </div>

        <div className="px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className={cn(
                'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg ring-2 ring-white/70',
                color
              )}
            >
              <Icon size={28} className="text-white drop-shadow-sm" />
            </div>
            <div>
              <p className="text-xs font-black text-fuchsia-500/90 uppercase tracking-wider">카테고리별 도움말</p>
              <p className="text-sm font-bold text-fuchsia-900/80 mt-0.5">
                자주 묻는 질문을 골라 보세요
              </p>
            </div>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-fuchsia-300" />
            </div>
          ) : items.length === 0 ? (
            <div className={cn(SECTION_CARD, 'px-5 py-10 text-center')}>
              <p className="text-sm font-medium text-fuchsia-800/80">
                이 카테고리에 등록된 도움말이 아직 없어요.
              </p>
              <p className="mt-2 text-xs text-fuchsia-600/80">운영에서 항목을 등록하면 여기에 표시돼요.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to={`/inquiry/category/${slug}/help/${item.id}`}
                  className={cn(
                    SECTION_CARD,
                    'flex items-center justify-between gap-3 p-4 border-pink-100/70',
                    'hover:border-fuchsia-300/60 hover:shadow-[0_8px_28px_-12px_rgba(192,38,211,0.22)] hover:-translate-y-0.5',
                    'transition-all duration-200 group'
                  )}
                >
                  <span className="text-sm font-bold text-fuchsia-950 group-hover:text-fuchsia-800">
                    {item.title}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-fuchsia-50/90 border border-pink-100/60 group-hover:bg-fuchsia-100 flex items-center justify-center shrink-0 transition-colors">
                    <ChevronRight
                      size={18}
                      className="text-fuchsia-400 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="flex justify-center mt-8 py-2">
            <Link
              to="/inquiry/form"
              className="inline-flex flex-row items-center text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2 whitespace-nowrap [word-break:keep-all]"
            >
              궁금한 점이 더 있으신가요? 1:1 문의하기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
