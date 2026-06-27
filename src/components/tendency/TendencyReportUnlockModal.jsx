import { createPortal } from 'react-dom'
import { Sparkles, ChevronRight, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { TENDENCY_TYPES } from '../../lib/tendencyReportAnalysis'

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   onOpenReport: () => void
 *   nickname?: string
 * }} props
 */
export function TendencyReportUnlockModal({ open, onClose, onOpenReport, nickname }) {
  if (!open) return null

  const name = nickname || 'Victory'

  return createPortal(
    <div
      className="fixed inset-0 z-[100055] flex items-end justify-center sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tendency-unlock-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-violet-400/30 bg-gradient-to-b from-[#1a1035] via-[#12082a] to-[#0f172a] shadow-[0_0_80px_rgba(168,85,247,0.35)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(168,85,247,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(34,211,238,0.12), transparent 50%)',
          }}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-violet-300/70 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="닫기"
        >
          <X size={18} />
        </button>

        <div className="relative px-6 pb-8 pt-8 sm:px-8 sm:pb-10 sm:pt-10">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.35em] text-fuchsia-300/80">
            <Sparkles className="inline-block size-3.5 align-middle" aria-hidden />{' '}
            Event Unlocked{' '}
            <Sparkles className="inline-block size-3.5 align-middle" aria-hidden />
          </p>

          <h2
            id="tendency-unlock-title"
            className="mt-2 text-center text-xl font-black leading-snug text-white sm:text-2xl"
          >
            10번째 투표 달성!
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              Vics 성향 리포트
            </span>
            가 열렸어요
          </h2>

          <p className="mt-3 text-center text-sm font-medium leading-relaxed text-violet-200/75">
            {name}님의 선택 패턴을 분석해
            <br />
            <strong className="text-white">트렌드세터</strong> ·{' '}
            <strong className="text-white">대중적인 입맛</strong> ·{' '}
            <strong className="text-white">독특한 개성파</strong>
            중 어디에 가까운지 알려드릴게요.
          </p>

          <div className="mt-6 flex justify-center gap-2">
            {Object.values(TENDENCY_TYPES).map((t) => (
              <div
                key={t.id}
                className={cn(
                  'flex flex-col items-center rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-sm',
                  'min-w-[5.5rem]',
                )}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="mt-1 text-[10px] font-bold text-white/90 text-center leading-tight">
                  {t.title}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenReport}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 py-4 text-sm font-black text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110"
          >
            성향 리포트 열기
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full py-2 text-center text-xs font-semibold text-violet-300/60 hover:text-violet-200/90 transition-colors"
          >
            나중에 볼게요
          </button>

          <p className="mt-4 text-center text-[10px] font-medium text-slate-500">
            이벤트 리포트는 1회 무료 · 마이페이지에서 다시 볼 수 있어요
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
