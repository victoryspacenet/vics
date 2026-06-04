/**
 * ClipboardEvent 의 DataTransferItem 에서 이미지·영상 File 목록을 추출합니다.
 * (스크린샷 복사 후 Ctrl+V 등)
 *
 * @param {ClipboardEvent} event
 * @param {{ images?: boolean, videos?: boolean }} [opts]
 * @returns {File[]}
 */
export function getClipboardMediaFiles(event, { images = true, videos = false } = {}) {
  const items = event.clipboardData?.items
  if (!items?.length) return []
  const out = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.kind !== 'file') continue
    const t = it.type || ''
    if (images && t.startsWith('image/')) {
      const f = it.getAsFile()
      if (f) out.push(f)
    } else if (videos && t.startsWith('video/')) {
      const f = it.getAsFile()
      if (f) out.push(f)
    }
  }
  return out
}
