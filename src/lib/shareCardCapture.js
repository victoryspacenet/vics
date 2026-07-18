import { toPng } from 'html-to-image'

const BLANK_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** @param {HTMLElement} root */
export async function waitForShareCardImages(root, timeoutMs = 6000) {
  const imgs = [...root.querySelectorAll('img')]
  if (!imgs.length) return

  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve()
              return
            }
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

/**
 * html-to-image로 공유 카드 PNG File 생성
 * @param {HTMLElement} el
 * @param {{ filename?: string, pixelRatio?: number, backgroundColor?: string }} [opts]
 */
export async function captureShareCardPngFile(
  el,
  {
    filename = 'vics-share-card.png',
    pixelRatio = 2,
    backgroundColor = '#0f0c1d',
  } = {},
) {
  if (!el) throw new Error('공유 카드 요소를 찾지 못했어요')

  await waitForShareCardImages(el)
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  const dataUrl = await toPng(el, {
    pixelRatio,
    cacheBust: true,
    skipFonts: true,
    useCORS: true,
    backgroundColor,
    imagePlaceholder: BLANK_PLACEHOLDER,
  })

  const blob = await (await fetch(dataUrl)).blob()
  if (!blob || blob.size < 800) {
    throw new Error('공유 카드 이미지가 비어 있어요')
  }

  return new File([blob], filename, { type: 'image/png' })
}
