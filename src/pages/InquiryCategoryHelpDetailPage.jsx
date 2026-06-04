import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react'
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
      <div className={cn('min-h-screen flex items-center justify-center', PAGE_BG)}>
        <Loader2 className="h-9 w-9 animate-spin text-fuchsia-300" />
      </div>
    )
  }

  if (!row || mismatch) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <p className="text-sm font-medium text-fuchsia-800/75 mb-4">도움말을 찾을 수 없어요.</p>
          <Link
            to={slug ? `/inquiry/category/${slug}` : '/inquiry'}
            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
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
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 line-clamp-1 tracking-tight">도움말</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          <section>
            <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-wider mb-1">Q</p>
            <h2 className="text-xl sm:text-2xl font-black text-fuchsia-950 leading-snug">{title}</h2>
          </section>

          <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
            <p className="text-[10px] font-black text-fuchsia-500/80 uppercase tracking-wider mb-3">A</p>

            {illustration && (
              <div className="mb-4 rounded-xl overflow-hidden border border-pink-100/60 bg-fuchsia-50/30">
                <FaqIllustration type={illustration} />
              </div>
            )}

            {legacyBodyOnly ? (
              <div className="text-sm text-fuchsia-900/88 leading-relaxed whitespace-pre-wrap">{body}</div>
            ) : (
              <>
                {hasAnswer && (
                  <p className="text-sm text-fuchsia-900/88 leading-relaxed mb-4">{answer}</p>
                )}

                {hasSteps && (
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

                {body?.trim() && (hasAnswer || hasSteps) && (
                  <p className="text-sm text-fuchsia-900/75 leading-relaxed mt-4 pt-4 border-t border-pink-100/60 whitespace-pre-wrap">
                    {body}
                  </p>
                )}
              </>
            )}
          </section>

          {hasActions && (
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
