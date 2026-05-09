import { formatNumber } from '../../lib/utils'

export function VoteBar({ leftPercent, rightPercent, leftLabel, rightLabel, totalVotes }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-bold text-fuchsia-800 w-6 shrink-0">{leftLabel}</span>
        <div className="flex-1 h-2.5 bg-fuchsia-100/90 rounded-full overflow-hidden ring-1 ring-fuchsia-200/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500 shadow-[0_0_12px_rgba(217,70,239,0.45)] animate-vote-bar-rise"
            style={{ width: `${leftPercent}%` }}
          />
        </div>
        <span className="font-black text-fuchsia-700 w-8 text-right tabular-nums">{leftPercent}%</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-bold text-sky-800 w-6 shrink-0">{rightLabel}</span>
        <div className="flex-1 h-2.5 bg-sky-100/90 rounded-full overflow-hidden ring-1 ring-sky-200/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_12px_rgba(14,165,233,0.45)] animate-vote-bar-rise-delayed"
            style={{ width: `${rightPercent}%` }}
          />
        </div>
        <span className="font-black text-sky-700 w-8 text-right tabular-nums">{rightPercent}%</span>
      </div>
      <p className="text-center text-xs text-gray-400">총 {formatNumber(totalVotes)}표</p>
    </div>
  )
}
