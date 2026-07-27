import { toPng } from 'html-to-image'

const BLANK_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('blob read failed'))
    reader.readAsDataURL(blob)
  })
}

async function imgElementToDataUrl(img, { filter = '' } = {}) {
  if (!img?.naturalWidth || !img?.naturalHeight) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (filter) ctx.filter = filter
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

async function resolveImageDataUrl(src, sourceImg) {
  if (!src) return null
  if (String(src).startsWith('data:')) return src

  if (sourceImg?.complete && sourceImg.naturalWidth > 0) {
    const hadInvert = sourceImg.classList.contains('invert')
    const fromCanvas = await imgElementToDataUrl(
      sourceImg,
      hadInvert ? { filter: 'invert(1)' } : {},
    )
    if (fromCanvas) return fromCanvas
  }

  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
    if (res.ok) return blobToDataUrl(await res.blob())
  } catch {
    /* fall through */
  }

  return null
}

async function inlineCloneImages(sourceEl, cloneEl) {
  const sourceImgs = [...sourceEl.querySelectorAll('img')]
  const cloneImgs = [...cloneEl.querySelectorAll('img')]

  await Promise.all(
    cloneImgs.map(async (img, index) => {
      const sourceImg = sourceImgs[index]
      const src = sourceImg?.currentSrc || sourceImg?.src || img.getAttribute('src')
      img.classList.remove('invert')
      img.removeAttribute('crossorigin')
      const dataUrl = await resolveImageDataUrl(src, sourceImg)
      if (dataUrl) img.src = dataUrl
    }),
  )
}

/** transform/overflow 조상 밖에서 캡처 — html-to-image가 깨지는 경우 방지 */
async function mountCaptureClone(sourceEl) {
  const rect = sourceEl.getBoundingClientRect()
  const clone = sourceEl.cloneNode(true)

  clone.style.position = 'fixed'
  clone.style.left = '-10000px'
  clone.style.top = '0'
  clone.style.zIndex = '-9999'
  clone.style.pointerEvents = 'none'
  clone.style.width = `${Math.max(rect.width, 1)}px`
  clone.style.maxWidth = `${Math.max(rect.width, 1)}px`
  clone.style.transform = 'none'
  clone.style.opacity = '1'
  clone.style.visibility = 'visible'
  clone.style.margin = '0'

  clone.querySelectorAll('[class*="animate-"]').forEach((node) => {
    ;[...node.classList].forEach((cls) => {
      if (cls.startsWith('animate-')) node.classList.remove(cls)
    })
  })

  const sourceWidthNodes = sourceEl.querySelectorAll('[style*="width"]')
  const cloneWidthNodes = clone.querySelectorAll('[style*="width"]')
  sourceWidthNodes.forEach((src, index) => {
    const dst = cloneWidthNodes[index]
    if (!dst) return
    dst.style.width = src.style.width
    dst.style.transition = 'none'
  })

  document.body.appendChild(clone)
  await inlineCloneImages(sourceEl, clone)
  await waitForShareCardImages(clone, 4000)
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  return clone
}

async function pngDataUrlToJpegBlob(dataUrl, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas unsupported'))
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('jpeg encode failed'))),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
}

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

async function captureElementToPng(el, { pixelRatio, backgroundColor }) {
  return toPng(el, {
    pixelRatio,
    cacheBust: true,
    skipFonts: true,
    useCORS: true,
    backgroundColor,
    imagePlaceholder: BLANK_PLACEHOLDER,
  })
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

  const clone = await mountCaptureClone(el)
  try {
    const dataUrl = await captureElementToPng(clone, { pixelRatio, backgroundColor })
    const blob = await (await fetch(dataUrl)).blob()
    if (!blob || blob.size < 800) {
      throw new Error('공유 카드 이미지가 비어 있어요')
    }
    return new File([blob], filename, { type: 'image/png' })
  } finally {
    clone.remove()
  }
}

/**
 * html-to-image → JPEG 공유 파일 (투표 결과 스토리 카드 등)
 * @param {HTMLElement} el
 * @param {{ filename?: string, pixelRatio?: number, backgroundColor?: string, jpegQuality?: number }} [opts]
 */
export async function captureShareCardJpegFile(
  el,
  {
    filename = 'vics-share-card.jpg',
    pixelRatio = 2,
    backgroundColor = '#1e1b4b',
    jpegQuality = 0.92,
  } = {},
) {
  if (!el) throw new Error('공유 카드 요소를 찾지 못했어요')

  await waitForShareCardImages(el)
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  const clone = await mountCaptureClone(el)
  try {
    const dataUrl = await captureElementToPng(clone, { pixelRatio, backgroundColor })
    const jpegBlob = await pngDataUrlToJpegBlob(dataUrl, jpegQuality)
    if (!jpegBlob || jpegBlob.size < 800) {
      throw new Error('공유 카드 이미지가 비어 있어요')
    }
    const baseName = filename.replace(/\.jpe?g$/i, '')
    return {
      file: new File([jpegBlob], `${baseName}.jpg`, { type: 'image/jpeg' }),
      dataUrl,
      fileName: baseName,
    }
  } finally {
    clone.remove()
  }
}
