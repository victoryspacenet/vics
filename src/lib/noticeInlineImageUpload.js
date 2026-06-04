/**
 * 공지 본문(contentEditable)용 인라인 이미지 — Supabase Storage에 올린 뒤
 * 브라우저에서 실제로 열 수 있는 URL(서명 URL 우선)을 넣습니다.
 * data URL은 일부 WebView에서 깨지므로 사용하지 않습니다.
 */
import { supabase } from './supabase'
import { compressImageContain } from './imageCompression'
import { uploadMatchupMediaValidated } from './matchupMediaBucketUpload'
import { validateSelectableRasterImageUpload, validatePipelineJpegOutput } from './uploadMediaValidation'

const BUCKET = 'matchup-media'

/** createSignedUrl API·프로젝트 설정에 따라 허용치가 다를 수 있어 짧은 값부터 순차 시도 */
const SIGNED_EXPIRY_CANDIDATES_SEC = [
  60 * 60 * 24 * 365,
  60 * 60 * 24 * 180,
  60 * 60 * 24 * 90,
  60 * 60 * 24 * 30,
  60 * 60 * 24 * 7,
  60 * 60 * 24,
  3600,
]

/**
 * 스토리지 객체 경로(notices/inline/...) → 브라우저에서 GET 가능한 URL
 * (비공개 버킷은 public URL만으로 403 → 서명 URL 우선)
 *
 * @param {string} objectPath
 * @returns {Promise<string | null>}
 */
export async function resolveMatchupMediaPathToReadableUrl(objectPath) {
  if (!objectPath || typeof objectPath !== 'string') return null
  const path = objectPath.replace(/^\/+/, '')
  const bucket = supabase.storage.from(BUCKET)

  for (const expiresIn of SIGNED_EXPIRY_CANDIDATES_SEC) {
    const { data: signed, error: signErr } = await bucket.createSignedUrl(path, expiresIn)
    if (!signErr && signed?.signedUrl) return signed.signedUrl
  }

  const { data: pub } = bucket.getPublicUrl(path)
  return pub?.publicUrl ?? null
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isProjectSupabaseStorageMediaUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    const base = import.meta.env.VITE_SUPABASE_URL
    if (!base) {
      return /\.supabase\.co$/i.test(u.hostname) && u.pathname.includes('/storage/v1/object/')
    }
    const host = new URL(base.trim()).hostname
    return u.hostname === host || u.hostname.endsWith(`.${host}`)
  } catch {
    return false
  }
}

/**
 * public / sign URL에서 matchup-media 버킷 객체 경로만 추출합니다.
 * @param {string} url
 * @returns {string | null}
 */
export function extractMatchupMediaObjectPathFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const markers = [
    '/storage/v1/object/public/matchup-media/',
    '/storage/v1/object/sign/matchup-media/',
  ]
  for (const m of markers) {
    const i = url.indexOf(m)
    if (i === -1) continue
    let path = url.slice(i + m.length)
    const q = path.indexOf('?')
    if (q !== -1) path = path.slice(0, q)
    try {
      return decodeURIComponent(path)
    } catch {
      return path
    }
  }
  return null
}

/**
 * 공지 본문 등 DOM 루트 안의 Supabase 스토리지 이미지 src를 읽기 가능한 URL로 바꿉니다.
 * (비공개 버킷 + DB에 public URL만 있는 경우 등)
 *
 * @param {HTMLElement | null} root
 * @returns {Promise<void>}
 */
export async function refreshMatchupMediaImagesInHtmlRoot(root) {
  if (!root?.querySelectorAll) return
  const imgs = [...root.querySelectorAll('img[src]')]
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:')) return
      if (!isProjectSupabaseStorageMediaUrl(src)) return
      const path = extractMatchupMediaObjectPathFromUrl(src)
      if (!path) return
      const next = await resolveMatchupMediaPathToReadableUrl(path)
      if (next && next !== src) img.setAttribute('src', next)
    }),
  )
}

/**
 * @param {File} file
 * @param {{ maxEdge?: number, maxBytes?: number }} [opts]
 * @returns {Promise<{ url: string | null, error: string | null }>}
 */
export async function uploadNoticeInlineImage(file, opts = {}) {
  if (!file || !file.type?.startsWith?.('image/')) {
    return { url: null, error: '이미지 파일만 넣을 수 있어요.' }
  }

  const sniffSel = await validateSelectableRasterImageUpload(file)
  if (!sniffSel.ok) {
    return { url: null, error: sniffSel.message }
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return { url: null, error: '로그인 후 다시 시도해 주세요.' }
  }

  let toUpload = file
  try {
    toUpload = await compressImageContain(file, {
      maxEdge: opts.maxEdge ?? 1200,
      quality: 0.78,
      maxBytes: opts.maxBytes ?? 800 * 1024,
    })
  } catch {
    return { url: null, error: '이미지를 처리하지 못했어요.' }
  }

  const outChk = await validatePipelineJpegOutput(toUpload)
  if (!outChk.ok) {
    return { url: null, error: outChk.message }
  }

  const rand = Math.random().toString(36).slice(2, 10)
  const path = `notices/inline/${user.id}/${Date.now()}-${rand}.jpg`

  const { error: upErr } = await uploadMatchupMediaValidated(supabase, {
    objectPath: path,
    body: toUpload,
    fileKind: 'image',
    cacheControl: '3600',
    contentType: toUpload.type || 'image/jpeg',
  })
  if (upErr) {
    console.warn('[noticeInlineImageUpload] upload failed:', upErr)
    return { url: null, error: upErr.message || '이미지 업로드에 실패했어요.' }
  }

  const url = await resolveMatchupMediaPathToReadableUrl(path)
  return { url, error: url ? null : '이미지 주소를 만들지 못했어요.' }
}
