import { useCallback } from 'react'
import { cn } from '../../lib/utils'
import {
  FANDOM_GOLD_EXCLUSIVE_EMOJIS,
  fandomTierHasGoldExclusiveEmojis,
} from '../../lib/fandomTiers'

/**
 * @param {HTMLTextAreaElement | null} textarea
 * @param {string} value
 * @param {(next: string) => void} setValue
 * @param {string} emoji
 * @param {number} maxLength
 * @returns {boolean} 삽입 성공 여부
 */
export function insertEmojiAtCursor(textarea, value, setValue, emoji, maxLength) {
  if (!textarea) return false
  const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : value.length
  const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : value.length
  const before = value.slice(0, start)
  const after = value.slice(end)
  const next = before + emoji + after
  if ([...next].length > maxLength) return false
  setValue(next)
  const pos = start + emoji.length
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(pos, pos)
  })
  return true
}

/**
 * 골드·다이아 팬덤 — 댓글/답글 등 textarea 위 전용 이모지 퀵픽
 *
 * @param {{
 *   tierId?: string | null
 *   textareaRef: React.RefObject<HTMLTextAreaElement | null>
 *   value: string
 *   onChange: (next: string) => void
 *   maxLength?: number
 *   onTooLong?: () => void
 *   className?: string
 * }} props
 */
export function FandomGoldExclusiveEmojiBar({
  tierId,
  textareaRef,
  value,
  onChange,
  maxLength = 500,
  onTooLong,
  className,
}) {
  const pick = useCallback(
    (emoji) => {
      const ta = textareaRef.current
      const ok = insertEmojiAtCursor(ta, value, onChange, emoji, maxLength)
      if (!ok) onTooLong?.()
    },
    [textareaRef, value, onChange, maxLength, onTooLong],
  )

  if (!fandomTierHasGoldExclusiveEmojis(tierId)) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-xl border border-amber-200/50 bg-gradient-to-r from-amber-50/90 to-yellow-50/80 px-2 py-1.5',
        className,
      )}
      role="group"
      aria-label="골드 전용 이모지"
    >
      <span className="mr-0.5 shrink-0 text-[10px] font-black uppercase tracking-wide text-amber-800/70">
        Gold
      </span>
      {FANDOM_GOLD_EXCLUSIVE_EMOJIS.map((emoji, i) => (
        <button
          key={`${emoji}-${i}`}
          type="button"
          title={`${emoji} 삽입`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(emoji)}
          className="flex h-8 min-w-[2rem] items-center justify-center rounded-lg text-lg leading-none transition-colors hover:bg-amber-100/90 active:scale-95"
        >
          <span className="select-none">{emoji}</span>
        </button>
      ))}
    </div>
  )
}
