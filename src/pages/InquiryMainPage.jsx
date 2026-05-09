import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Search,
  Flame,
  FolderOpen,
  ChevronRight,
  MessageCircle,
} from 'lucide-react'
import { FAQ_ITEMS, FAQ_MAIN_IDS } from '../lib/faqData'
import { getHotFaqIds, INQUIRY_HOT_FAQ_LS_REV_KEY } from '../lib/inquiryHotFaq'
import { getHelpCategoryPresentation, listInquiryHelpCategories } from '../lib/inquiryHelpCategories'
import { cn } from '../lib/utils'

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
  const [faqList, setFaqList] = useState(() =>
    FAQ_MAIN_IDS.map((id) => ({ id, ...FAQ_ITEMS[id] })).filter((x) => x.question),
  )
  const [helpCategories, setHelpCategories] = useState([])

  const refreshHelpCategories = useCallback(() => {
    listInquiryHelpCategories().then(setHelpCategories)
  }, [])

  const refreshFaqList = useCallback(() => {
    getHotFaqIds().then((ids) => {
      setFaqList(ids.map((id) => ({ id, ...FAQ_ITEMS[id] })).filter((x) => x.question))
    })
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
    <div className={cn('min-h-screen w-full min-w-0', PAGE_BG)}>
      <div className="max-w-screen-lg mx-auto w-full">
        {/* 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-3', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-fuchsia-900" />
          </button>
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 tracking-tight">문의하기</h1>
        </div>

        <div className="px-4 py-6 space-y-8">
          {/* 검색 섹션 */}
          <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
            <h2 className="text-base font-black text-fuchsia-950 mb-3 tracking-tight">무엇을 도와드릴까요?</h2>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-fuchsia-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="포인트, 계정, 신고..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-pink-200/80 bg-white/95 text-fuchsia-950 placeholder:text-fuchsia-300/90 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/50 focus:border-fuchsia-400 transition-all"
                />
              </div>
            </form>
          </section>

          {/* 가장 많이 묻는 질문 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-200 to-rose-300 border border-orange-200/60 flex items-center justify-center shadow-sm">
                <Flame size={20} className="text-orange-600 shrink-0" />
              </div>
              <h2 className="text-base font-black text-fuchsia-950 tracking-tight">가장 많이 묻는 질문</h2>
            </div>
            <div className="space-y-2.5">
              {faqList.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    SECTION_CARD,
                    'overflow-hidden border-pink-100/70',
                    'hover:border-fuchsia-300/50 transition-colors'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(item.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left group"
                  >
                    <span className="text-sm font-bold text-fuchsia-950 group-hover:text-fuchsia-700 transition-colors">
                      {item.question}
                    </span>
                    <ChevronRight
                      size={18}
                      className={cn(
                        'shrink-0 text-fuchsia-400 transition-transform',
                        expandedFaq === item.id && 'rotate-90 text-fuchsia-600'
                      )}
                    />
                  </button>
                  {expandedFaq === item.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-pink-100/50 bg-fuchsia-50/30">
                      <p className="text-sm text-fuchsia-900/80 leading-relaxed pt-3">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 카테고리별 도움말 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-200 to-fuchsia-300 border border-violet-200/60 flex items-center justify-center shadow-sm">
                <FolderOpen size={20} className="text-violet-700 shrink-0" />
              </div>
              <h2 className="text-base font-black text-fuchsia-950 tracking-tight">카테고리별 도움말</h2>
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
                      SECTION_CARD,
                      'flex flex-col items-center gap-2 p-4 border-pink-100/70',
                      'hover:border-fuchsia-300/60 hover:shadow-[0_8px_28px_-12px_rgba(192,38,211,0.2)] hover:-translate-y-0.5',
                      'transition-all group'
                    )}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md ring-2 ring-white/70',
                        color
                      )}
                    >
                      <Icon size={24} className="text-white drop-shadow-sm" />
                    </div>
                    <span className="text-sm font-black text-fuchsia-950 text-center leading-tight">{cat.label}</span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* 1:1 문의 CTA */}
          <section className="pt-2">
            <div className="rounded-2xl border border-pink-100/70 bg-gradient-to-br from-emerald-50/95 via-teal-50/60 to-cyan-50/40 p-6 text-center shadow-sm shadow-emerald-200/20">
              <p className="text-sm font-medium text-fuchsia-800/75 mb-4">궁금증이 풀리지 않으셨나요?</p>
              <Link
                to="/inquiry/form"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] font-black shadow-lg shadow-emerald-300/45 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/50"
              >
                <MessageCircle size={20} strokeWidth={2.25} />
                1:1 문의 남기기
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
