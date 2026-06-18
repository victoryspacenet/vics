import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, MessageCircle } from 'lucide-react'
import { getCategoryHelpById } from '../lib/inquiryCategoryHelp'
import { FaqIllustration } from '../components/inquiry/FaqIllustration'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

export function InquiryCategoryHelpDetailPage() {
  const navigate = useNavigate()
  const { slug, helpId } = useParams()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const data = await getCategoryHelpById(helpId)
      if (cancelled) return
      setRow(data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [helpId])

  const mismatch = row && row.category_slug !== slug

  if (loading) {
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center gap-3', PAGE_BG)}>
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
        <p className="text-sm font-bold text-fuchsia-700/60 animate-pulse">불러오는 중...</p>
      </div>
    )
  }

  if (!row || mismatch) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <div className="text-3xl mb-3">📭</div>
          <p className="text-sm font-bold text-fuchsia-800/75 mb-5">도움말을 찾을 수 없어요.</p>
          <Link
            to={slug ? `/inquiry/category/${slug}` : '/inquiry'}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-black shadow-md shadow-fuchsia-300/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            이전 화면으로
          </Link>
        </div>
      </div>
    )
  }

  const { title, answer, steps, actions, illustration, body } = row
  const hasAnswer = Boolean(answer?.trim())
  const hasSteps = Array.isArray(steps) && steps.length > 0
  const hasActions = Array.isArray(actions) && actions.length > 0
  const legacyBodyOnly = !hasAnswer && !hasSteps && Boolean(body?.trim())

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
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight line-clamp-1">도움말</h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-5">
          {/* Q 섹션 */}
          <section className="rounded-2xl overflow-hidden border border-fuchsia-200/50 bg-gradient-to-br from-fuchsia-50/90 via-pink-50/60 to-rose-50/40 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white text-xs font-black shadow-md shadow-fuchsia-300/40">Q</span>
                <span className="text-[10px] font-black bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent uppercase tracking-widest">질문</span>
              </div>
              <h2 className="text-lg font-black text-fuchsia-950 leading-snug">{title}</h2>
            </div>
          </section>

          {/* A 섹션 */}
          <section className="rounded-2xl overflow-hidden border border-emerald-200/50 bg-white/92 shadow-[0_4px_28px_-10px_rgba(16,185,129,0.12)] backdrop-blur-[2px]">
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-300/40">A</span>
                <span className="text-[10px] font-black bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent uppercase tracking-widest">답변</span>
              </div>

              {illustration && (
                <div className="mb-5 rounded-xl overflow-hidden border border-emerald-100/60 bg-emerald-50/30">
                  <FaqIllustration type={illustration} />
                </div>
              )}

              {legacyBodyOnly ? (
                <div className="text-sm text-fuchsia-900/85 leading-relaxed whitespace-pre-wrap">{body}</div>
              ) : (
                <>
                  {hasAnswer && (
                    <p className="text-sm text-fuchsia-900/88 leading-relaxed mb-4">{answer}</p>
                  )}

                  {hasSteps && (
                    <ol className="space-y-3 list-none pl-0">
                      {steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm text-fuchsia-900/85 leading-relaxed">
                          <span className="shrink-0 w-7 h-7 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white text-xs font-black flex items-center justify-center shadow-md shadow-fuchsia-300/40">
                            {i + 1}
                          </span>
                          <span className="pt-1">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {body?.trim() && (hasAnswer || hasSteps) && (
                    <p className="text-sm text-fuchsia-900/70 leading-relaxed mt-5 pt-4 border-t border-emerald-100/60 whitespace-pre-wrap">
                      {body}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* 바로 가기 액션 */}
          {hasActions && (
            <section className="rounded-2xl overflow-hidden border border-violet-200/50 bg-gradient-to-br from-violet-50/80 via-fuchsia-50/50 to-pink-50/30 shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400" />
              <div className="p-5">
                <p className="text-xs font-black bg-gradient-to-r from-violet-700 to-fuchsia-700 bg-clip-text text-transparent uppercase tracking-widest mb-3">바로 가기</p>
                <div className="flex flex-wrap gap-2">
                  {actions.map((action, i) => (
                    <Link
                      key={i}
                      to={action.to}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-black shadow-md shadow-violet-300/40 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {action.text}
                      <ChevronRight size={15} strokeWidth={2.5} />
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 1:1 문의 CTA */}
          <div className="rounded-2xl overflow-hidden border border-emerald-200/50 shadow-sm mt-2">
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
