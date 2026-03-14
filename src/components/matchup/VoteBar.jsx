import { formatNumber } from '../../lib/utils'

export function VoteBar({ leftPercent, rightPercent, leftLabel, rightLabel, totalVotes }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-bold text-[#22282E] w-6 shrink-0">{leftLabel}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#22282E] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${leftPercent}%` }}
          />
        </div>
        <span className="font-bold text-[#22282E] w-8 text-right">{leftPercent}%</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-bold text-gray-400 w-6 shrink-0">{rightLabel}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${rightPercent}%` }}
          />
        </div>
        <span className="font-bold text-gray-400 w-8 text-right">{rightPercent}%</span>
      </div>
      <p className="text-center text-xs text-gray-400">총 {formatNumber(totalVotes)}표</p>
    </div>
  )
}
