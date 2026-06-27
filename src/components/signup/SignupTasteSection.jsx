import { AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { SIGNUP_TASTE_QUESTIONS } from '../../lib/signupTasteQuestions'

/**
 * @param {{
 *   answers: Record<string, string>
 *   onChange: (questionId: string, optionId: string) => void
 *   errors?: Record<string, string | null>
 * }} props
 */
export function SignupTasteSection({ answers, onChange, errors = {} }) {
  return (
    <div className="rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-50/80 via-fuchsia-50/40 to-white/60 p-4 space-y-4">
      <div className="text-center pb-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-600/80">
          Taste Check
        </p>
        <h2 className="mt-1 text-sm font-black text-violet-950">VictorySpace 취향 3초 체크</h2>
        <p className="mt-1 text-[11px] font-medium text-violet-700/65 leading-snug">
          편하게 골라 주세요
        </p>
      </div>

      {SIGNUP_TASTE_QUESTIONS.map((q, qi) => (
        <div key={q.id} className={qi > 0 ? 'pt-1 border-t border-violet-100/80' : ''}>
          <div className="mb-2">
            <p className="text-xs font-black text-violet-900/90 flex items-center gap-1.5">
              <span className="text-base leading-none" aria-hidden>{q.emoji}</span>
              {q.title}
            </p>
            <p className="text-[10px] font-medium text-violet-600/60 mt-0.5 pl-0.5">{q.subtitle}</p>
          </div>
          <div
            className={cn(
              'grid gap-1.5',
              q.options.length === 3 ? 'grid-cols-3' : q.options.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4',
            )}
          >
            {q.options.map((opt) => {
              const selected = answers[q.id] === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange(q.id, opt.id)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl border-2 px-2 py-2.5 text-center transition-all',
                    selected
                      ? 'border-fuchsia-500 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-fuchsia-300/25 scale-[1.02]'
                      : 'border-violet-200/55 bg-white/75 text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50/50',
                  )}
                >
                  <span className="text-lg leading-none mb-0.5" aria-hidden>{opt.emoji}</span>
                  <span className="text-[11px] font-black leading-tight">{opt.label}</span>
                  {opt.hint && (
                    <span
                      className={cn(
                        'text-[9px] font-semibold mt-0.5',
                        selected ? 'text-white/80' : 'text-violet-400/80',
                      )}
                    >
                      {opt.hint}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {errors[q.id] && (
            <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1.5 px-0.5">
              <AlertCircle size={11} />
              {errors[q.id]}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
