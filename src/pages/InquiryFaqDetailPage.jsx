import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ThumbsUp, ThumbsDown, ChevronRight } from 'lucide-react'
import { FAQ_ITEMS } from '../lib/faqData'
import { saveFaqFeedback, getFaqFeedback } from '../lib/faqFeedbackStorage'
import { useAuthStore } from '../store/authStore'
import { FaqIllustration } from '../components/inquiry/FaqIllustration'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

/** MZ 파스텔 — 문의·카테고리 도움말과 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

export function InquiryFaqDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuthStore()
  const faq = FAQ_ITEMS[id]
  const [feedback, setFeedback] = useState(null)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  useEffect(() => {
    if (!id) return
    void getFaqFeedback(id, user?.id).then((v) => setFeedback(v))
  }, [id, user?.id])

  const handleFeedback = async (value) => {
    if (feedbackSubmitted || feedback) return
    const ok = await saveFaqFeedback(id, value, user?.id)
    if (ok) {
      setFeedback(value)
      setFeedbackSubmitted(true)
    }
  }

  if (!faq) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <p className="text-sm font-medium text-fuchsia-800/75 mb-4">해당 FAQ를 찾을 수 없어요.</p>
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

  const { question, answer, steps, actions, illustration } = faq

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
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 line-clamp-1 tracking-tight">FAQ</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          {/* Q */}
          <section>
            <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-wider mb-1">Q</p>
            <h2 className="text-xl sm:text-2xl font-black text-fuchsia-950 leading-snug">
              {question}
            </h2>
          </section>

          {/* A */}
          <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
            <p className="text-[10px] font-black text-fuchsia-500/80 uppercase tracking-wider mb-3">A</p>

            {illustration && (
              <div className="mb-4 rounded-xl overflow-hidden border border-pink-100/60 bg-fuchsia-50/30">
                <FaqIllustration type={illustration} />
              </div>
            )}

            <p className="text-sm text-fuchsia-900/88 leading-relaxed mb-4">{answer}</p>

            {steps && steps.length > 0 && (
              <ol className="space-y-2.5 list-none pl-0">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-fuchsia-900/85 leading-relaxed">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white text-xs font-black flex items-center justify-center shadow-sm shadow-fuchsia-300/40">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {actions && actions.length > 0 && (
            <section className="text-center">
              <p className="text-xs font-black text-fuchsia-700/70 mb-2 uppercase tracking-wide">바로 가기</p>
              <div className="flex flex-wrap gap-2 justify-center items-center">
                {actions.map((action, i) => (
                  <Link
                    key={i}
                    to={action.to}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black shadow-md shadow-emerald-300/45 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/50"
                  >
                    {action.text}
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70 text-center')}>
            <p className="text-xs font-black text-fuchsia-950 mb-3">이 답변이 도움이 되셨나요?</p>
            {feedbackSubmitted || feedback ? (
              <p className="inline-flex flex-row items-center justify-center text-sm font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-200/50 rounded-xl px-4 py-3 max-w-full whitespace-nowrap [word-break:keep-all]">
                감사합니다! 피드백이 반영돼요.
              </p>
            ) : (
              <div className="flex gap-2 sm:gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => handleFeedback('helpful')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-pink-200/80 bg-white/95 text-fuchsia-900 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-teal-50/80 hover:border-emerald-300 transition-all font-bold"
                >
                  <ThumbsUp size={18} className="text-fuchsia-500" />
                  <span className="text-sm">도움이 됐어요</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback('not_helpful')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-pink-200/80 bg-white/95 text-fuchsia-900 hover:bg-rose-50 hover:border-rose-300 transition-all font-bold"
                >
                  <ThumbsDown size={18} className="text-fuchsia-400" />
                  <span className="text-sm">부족해요</span>
                </button>
              </div>
            )}
          </section>

          <div className="flex justify-center py-2">
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
