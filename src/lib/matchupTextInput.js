/** 매치업 텍스트 콘텐츠 — 입력 중 공백 유지, 제출 시 앞뒤만 trim */
export function matchupTextContentFromRaw(raw) {
  const text = typeof raw === 'string' ? raw : ''
  return text.trim().length > 0 ? { type: 'text', text } : null
}

export function readMatchupTextHydrateValue(content) {
  if (content?.type !== 'text') return ''
  return typeof content.text === 'string' ? content.text : ''
}

/** 제출 직전 uncontrolled textarea 최신값 (blur 없이 저장되는 경우) */
export function readMatchupTextFromTextareaElement(root) {
  if (!root?.querySelector) return null
  const el = root.querySelector('[data-matchup-side-text-input]')
  if (!el) return null
  return matchupTextContentFromRaw(el.value ?? '')
}
