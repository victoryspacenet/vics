import { Link } from 'react-router-dom'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  TENDENCY_REPORT_VOTE_THRESHOLD,
  TENDENCY_TYPES,
} from '../../lib/tendencyReport'

/**
 * @param {{
 *   status: {
 *     voteCount: number
 *     eligible: boolean
 *     acknowledged: boolean
 *     tendencyType?: string | null
 *   }
 *   to?: string | null
 *   previewOnly?: boolean
 * }} props
 */
export function TendencyReportMyPageCardView({ status, to = '/report/tendency', previewOnly = false }) {
  const remaining = Math.max(0, TENDENCY_REPORT_VOTE_THRESHOLD - status.voteCount)
  const showEligible = status.eligible || status.acknowledged

  if (!showEligible && remaining > 3) return null

  const typeMeta = status.tendencyType ? TENDENCY_TYPES[status.tendencyType] : null

  const className =
    'mb-6 flex items-center gap-3 rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/95 via-fuchsia-50/80 to-cyan-50/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md'

  const inner = (
    <>
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 text-2xl shadow-md shadow-violet-300/40">
        {typeMeta?.emoji || <Sparkles className="size-6 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-violet-600/80">Vics Event</p>
        {status.acknowledged && typeMeta ? (
          <>
            <p className="text-sm font-black text-violet-950">성향 리포트 · {typeMeta.title}</p>
            <p className="text-xs font-medium text-violet-700/65">다시 보기</p>
          </>
        ) : status.eligible ? (
          <>
            <p className="text-sm font-black text-violet-950">성향 리포트가 열렸어요!</p>
            <p className="text-xs font-medium text-violet-700/65">10회 투표 달성 — 지금 확인해 보세요</p>
          </>
        ) : (
          <>
            <p className="text-sm font-black text-violet-950">성향 리포트까지 {remaining}표</p>
            <p className="text-xs font-medium text-violet-700/65">
              {status.voteCount}/{TENDENCY_REPORT_VOTE_THRESHOLD} 투표 · 이벤트 무료 분석
            </p>
          </>
        )}
      </div>
      <ChevronRight size={18} className="shrink-0 text-violet-500/70" />
    </>
  )

  if (previewOnly || to == null) {
    return <div className={cn(className, 'pointer-events-none cursor-default shadow-none hover:translate-y-0')}>{inner}</div>
  }

  return (
    <Link to={to} className={className}>
      {inner}
    </Link>
  )
}
