import { useRef } from 'react'
import { matchupTextContentFromRaw } from '../../lib/matchupTextInput'

/**
 * 매치업 텍스트 콘텐츠 입력 — uncontrolled textarea
 * (Cursor Simple Browser 등 embedded webview에서 controlled value 동기화 시 공백이 사라지는 문제 회피)
 */
export function MatchupTextContentInput({
  initialValue = '',
  onContentChange,
  className,
  placeholder,
  disabled,
  maxLength,
  rows,
}) {
  const ref = useRef(null)

  const emit = () => {
    const raw = ref.current?.value ?? ''
    onContentChange(matchupTextContentFromRaw(raw))
  }

  return (
    <textarea
      ref={ref}
      data-matchup-side-text-input
      defaultValue={typeof initialValue === 'string' ? initialValue : ''}
      onInput={emit}
      onBlur={emit}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      disabled={disabled}
      className={className}
    />
  )
}
