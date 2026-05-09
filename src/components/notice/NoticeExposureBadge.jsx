import { TIERS } from '../../lib/tiers'
import { cn } from '../../lib/utils'

/** 관리자가 «특정 티어»로 게시한 공지 — 유저 목록·상세에 노출 범위 표시 */
export function NoticeExposureBadge({ notice, className }) {
  if (notice.targetAll !== false) return null

  const fromStorage = notice.targetTierLabel
  const fromId = TIERS.find((t) => t.id === notice.targetTierId)
  const label = fromStorage || (fromId ? `${fromId.emoji} ${fromId.name}` : null)
  if (!label) return null

  const exact = notice.targetTierExact === true
  const suffix = exact ? '만' : ' 이상'

  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1 rounded-lg border border-violet-200/80 bg-gradient-to-r from-violet-50 to-fuchsia-50/80 px-2 py-0.5 text-[10px] font-black tracking-tight text-violet-900 shadow-sm',
        className
      )}
      title={exact ? '선택 티어와 일치할 때만 공개' : '선택 티어 이상에게 공개'}
    >
      <span className="text-violet-500/90">노출</span>
      <span className="min-w-0 truncate">
        {label}
        <span className="font-black text-violet-700/90">{suffix}</span>
      </span>
    </span>
  )
}
