import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  FolderOpen,
  HelpCircle,
  MessageCircle,
  Search,
} from 'lucide-react'
import { getHotFaqDisplayItems, INQUIRY_HOT_FAQ_LS_REV_KEY } from '../lib/inquiryHotFaq'
import { getHelpCategoryPresentation, listInquiryHelpCategories } from '../lib/inquiryHelpCategories'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

/** MZ 파스텔 — 문의 폼·내역과 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

export function InquiryMainPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const expandId = searchParams.get('expand')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFaq, setExpandedFaq] = useState(expandId || null)
  const [faqList, setFaqList] = useState([])
  const [helpCategories, setHelpCategories] = useState([])

  const refreshHelpCategories = useCallback(() => {
    listInquiryHelpCategories().then(setHelpCategories)
  }, [])

  const refreshFaqList = useCallback(() => {
    void getHotFaqDisplayItems().then((items) => setFaqList(items))
  }, [])

  /** 라우트로 다시 들어올 때·뒤로가기(bfcache) 복귀 시 최신 목록 */
  useEffect(() => {
    refreshFaqList()
  }, [location.pathname, location.key, refreshFaqList])

  useEffect(() => {
    refreshHelpCategories()
  }, [location.pathname, location.key, refreshHelpCategories])

  useEffect(() => {
    const onCat = () => refreshHelpCategories()
    window.addEventListener('vics:inquiry-help-categories:updated', onCat)
    return () => window.removeEventListener('vics:inquiry-help-categories:updated', onCat)
  }, [refreshHelpCategories])

  useEffect(() => {
    const onUpdated = () => refreshFaqList()
    window.addEventListener('vics:inquiry-hot-faq:updated', onUpdated)
    return () => window.removeEventListener('vics:inquiry-hot-faq:updated', onUpdated)
  }, [refreshFaqList])

  /** 다른 탭에서 저장 시 이 탭 문의 메인 동기화 (storage 이벤트는 다른 탭에서만 발생) */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === INQUIRY_HOT_FAQ_LS_REV_KEY) refreshFaqList()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refreshFaqList])

  /** 다른 앱 갔다가 돌아온 뒤에만 재조회 (불필요한 API 반복 방지) */
  const wasHiddenRef = useRef(false)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') wasHiddenRef.current = true
      else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false
        refreshFaqList()
      }
    }
    const onPageShow = (e) => {
      if (e.persisted) refreshFaqList()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [refreshFaqList])

  useEffect(() => {
    if (expandId) setExpandedFaq(expandId)
  }, [expandId])

  const handleSearch = (e) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) {
      navigate(`/inquiry/search?q=${encodeURIComponent(q)}`)
    }
  }

  const toggleFaq = (id) => {
    setExpandedFaq((prev) => (prev === id ? null : id))
  }

  return (
    <div className={cn('min-h-screen w-full min-w-0 relative overflow-hidden', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-gradient-radial from-fuchsia-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-gradient-radial from-pink-300/15 to-transparent blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-56 h-56 rounded-full bg-gradient-radial from-rose-300/12 to-transparent blur-3xl" />
      </div>

      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto w-full relative z-10')}>
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
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-md shadow-fuchsia-300/40">
              <HelpCircle size={14} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight">문의하기</h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-8">
          {/* 검색 섹션 */}
          <section className="rounded-2xl overflow-hidden border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-sm">
                  <Search size={12} className="text-white" />
                </span>
                <h2 className="text-sm font-black bg-gradient-to-r from-fuchsia-700 to-pink-600 bg-clip-text text-transparent tracking-tight">무엇을 도와드릴까요?</h2>
              </div>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fuchsia-400/70" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="포인트, 계정, 신고..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-pink-200/80 bg-white/95 text-fuchsia-950 placeholder:text-fuchsia-300/80 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/50 focus:border-fuchsia-400 transition-all text-sm"
                  />
                </div>
              </form>
            </div>
          </section>

          {/* 가장 많이 묻는 질문 */}
          {faqList.length > 0 && (
            <section>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 shadow-md shadow-orange-300/40">
                  <Flame size={16} className="text-white" />
                </span>
                <h2 className="text-base font-black bg-gradient-to-r from-orange-600 via-rose-600 to-fuchsia-700 bg-clip-text text-transparent tracking-tight">가장 많이 묻는 질문</h2>
              </div>
              <div className="space-y-2.5">
                {faqList.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'relative rounded-2xl overflow-hidden border bg-white/92 backdrop-blur-[2px] transition-all duration-200',
                      expandedFaq === item.id
                        ? 'border-fuchsia-300/70 shadow-[0_6px_24px_-10px_rgba(192,38,211,0.25)]'
                        : 'border-pink-100/70 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.15)] hover:border-fuchsia-200/60 hover:-translate-y-0.5'
                    )}
                  >
                    {/* 좌측 액센트 바 */}
                    <div className={cn(
                      'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-opacity',
                      expandedFaq === item.id
                        ? 'bg-gradient-to-b from-orange-400 to-rose-500 opacity-100'
                        : 'bg-gradient-to-b from-fuchsia-400 to-pink-500 opacity-40'
                    )} />
                    <button
                      type="button"
                      onClick={() => toggleFaq(item.id)}
                      className="w-full flex items-center justify-between gap-3 pl-5 pr-4 py-3.5 text-left group"
                    >
                      <span className={cn(
                        'text-sm font-bold transition-colors',
                        expandedFaq === item.id ? 'text-fuchsia-800' : 'text-fuchsia-950 group-hover:text-fuchsia-700'
                      )}>
                        {item.question}
                      </span>
                      <ChevronRight
                        size={17}
                        className={cn(
                          'shrink-0 transition-all duration-200',
                          expandedFaq === item.id ? 'rotate-90 text-fuchsia-600' : 'text-fuchsia-400 group-hover:text-fuchsia-600'
                        )}
                      />
                    </button>
                    {expandedFaq === item.id && (
                      <div className="pl-5 pr-4 pb-4 pt-0 border-t border-fuchsia-100/60 bg-gradient-to-br from-fuchsia-50/50 to-pink-50/30">
                        <p className="text-sm text-fuchsia-900/80 leading-relaxed pt-3">
                          {item.answer}
                        </p>
                        {item.detailTo && (
                          <Link
                            to={item.detailTo}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-black text-fuchsia-700 hover:text-fuchsia-900 transition-colors"
                          >
                            자세히 보기
                            <ChevronRight size={13} />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 카테고리별 도움말 */}
          {helpCategories.length > 0 && (
            <section>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-md shadow-violet-300/40">
                  <FolderOpen size={16} className="text-white" />
                </span>
                <h2 className="text-base font-black bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent tracking-tight">카테고리별 도움말</h2>
              </div>
              <div
                className={cn(
                  'grid gap-3',
                  helpCategories.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3',
                )}
              >
                {helpCategories.map((cat) => {
                  const { Icon, color } = getHelpCategoryPresentation(cat.slug)
                  return (
                    <Link
                      key={cat.slug}
                      to={`/inquiry/category/${cat.slug}`}
                      className={cn(
                        'flex flex-col items-center gap-2.5 p-4 rounded-2xl overflow-hidden',
                        'border border-pink-100/70 bg-white/92 shadow-[0_4px_20px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]',
                        'hover:border-fuchsia-300/60 hover:shadow-[0_8px_28px_-10px_rgba(192,38,211,0.25)] hover:-translate-y-0.5',
                        'transition-all group'
                      )}
                    >
                      <div
                        className={cn(
                          'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md ring-2 ring-white/70 group-hover:scale-105 transition-transform',
                          color
                        )}
                      >
                        <Icon size={24} className="text-white drop-shadow-sm" />
                      </div>
                      <span className="text-xs font-black text-fuchsia-950 text-center leading-tight group-hover:text-fuchsia-700 transition-colors">{cat.label}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* 1:1 문의 CTA */}
          <section className="pt-2 pb-4">
            <div className="rounded-2xl overflow-hidden border border-emerald-200/50 shadow-[0_8px_32px_-12px_rgba(16,185,129,0.2)]">
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="bg-gradient-to-br from-emerald-950/85 via-teal-950/80 to-cyan-950/75 p-6 text-center">
                <div className="flex justify-center mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/40">
                    <MessageCircle size={20} className="text-white" />
                  </span>
                </div>
                <p className="text-sm font-bold text-emerald-100/90 mb-1">궁금증이 풀리지 않으셨나요?</p>
                <p className="text-xs text-emerald-300/70 mb-5">운영진이 직접 답변해 드려요</p>
                <Link
                  to="/inquiry/form"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 text-emerald-950 font-black shadow-[0_4px_20px_-4px_rgba(16,185,129,0.55)] hover:shadow-[0_4px_28px_-4px_rgba(16,185,129,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"
                >
                  <MessageCircle size={17} strokeWidth={2.5} />
                  1:1 문의 남기기
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
