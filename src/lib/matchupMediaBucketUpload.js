/**
 * matchup-media 업로드: VITE_MATCHUP_MEDIA_UPLOAD_URL 이 있으면 Edge에서 검증·서비스 롤 업로드,
 * 없거나 Edge가 응답하지 않으면 클라이언트 Storage 직접 업로드(타임아웃·폴백 포함).
 */
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, UPLOAD_TIMEOUT_IMAGE_MS, UPLOAD_TIMEOUT_VIDEO_MS } from './mediaSpec'

const BUCKET = 'matchup-media'

function publicUrlFallback(supabase, objectPath) {
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
    return data?.publicUrl ?? null
  } catch {
    return null
  }
}

function uploadTimeoutMs(fileKind) {
  return fileKind === 'video' ? UPLOAD_TIMEOUT_VIDEO_MS : UPLOAD_TIMEOUT_IMAGE_MS
}

function uploadTimeoutMessage(fileKind) {
  return fileKind === 'video'
    ? '영상 업로드 시간이 초과했어요. Wi‑Fi 연결을 확인한 뒤 다시 시도해 주세요.'
    : '이미지 업로드 시간이 초과했어요. Wi‑Fi 연결을 확인한 뒤 다시 시도해 주세요.'
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function isRetriableUploadFailure(errMsg, status) {
  const m = String(errMsg || '').toLowerCase()
  if (m.includes('시간이 초과') || m.includes('timeout') || m.includes('network') || m.includes('failed to fetch')) {
    return true
  }
  if (status === 502 || status === 503 || status === 504 || status === 408) return true
  return false
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function uploadDirectToStorage(supabase, { objectPath, blob, fileKind, upsert, cacheControl, ctype }) {
  const ms = uploadTimeoutMs(fileKind)
  const { error } = await withTimeout(
    supabase.storage.from(BUCKET).upload(objectPath, blob, {
      upsert,
      cacheControl,
      contentType: ctype || undefined,
    }),
    ms,
    uploadTimeoutMessage(fileKind),
  )
  const publicUrl = publicUrlFallback(supabase, objectPath)
  if (error) return { error, publicUrl }
  return { error: null, publicUrl }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function uploadViaEdgeFunction(supabase, proxyBase, anonKey, {
  objectPath,
  blob,
  fileKind,
  upsert,
  cacheControl,
  ctype,
}) {
  const ms = uploadTimeoutMs(fileKind)
  const { data: sessionData, error: sessErr } = await withTimeout(
    supabase.auth.getSession(),
    20_000,
    '로그인 확인 시간이 초과했어요. 다시 로그인해 주세요.',
  )
  const tok = sessionData?.session?.access_token
  if (sessErr || !tok) {
    return {
      error: { message: '로그인이 필요해요' },
      publicUrl: null,
      status: 401,
    }
  }

  const headers = {
    Authorization: `Bearer ${tok}`,
    ...(anonKey ? { apikey: anonKey } : {}),
    'Content-Type': ctype || 'application/octet-stream',
    'X-Object-Path': objectPath,
    'X-File-Kind': fileKind,
    'X-Cache-Control': String(cacheControl),
  }
  if (upsert) headers['X-Upsert'] = '1'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)

  let res
  try {
    res = await fetch(proxyBase, {
      method: 'POST',
      headers,
      body: blob,
      signal: controller.signal,
    })
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    return {
      error: {
        message: aborted ? uploadTimeoutMessage(fileKind) : (e?.message ? String(e.message) : '업로드 네트워크 오류'),
      },
      publicUrl: null,
      status: aborted ? 408 : 0,
    }
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text().catch(() => '')
  /** @type {{ ok?: boolean, publicUrl?: string, error?: string } | null} */
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  if (!res.ok) {
    const msg =
      (json && typeof json.error === 'string' && json.error) ||
      text?.slice(0, 200) ||
      `업로드 실패 (${res.status})`
    return { error: { message: msg }, publicUrl: null, status: res.status }
  }

  const publicUrl = (json && json.publicUrl) || publicUrlFallback(supabase, objectPath)
  return { error: null, publicUrl, status: res.status }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   objectPath: string,
 *   body: Blob | File | ArrayBuffer | ArrayBufferView,
 *   fileKind: 'image' | 'video',
 *   upsert?: boolean,
 *   cacheControl?: string,
 *   contentType?: string,
 * }} opts
 * @returns {Promise<{ error: { message: string } | null, publicUrl: string | null }>}
 */
export async function uploadMatchupMediaValidated(supabase, opts) {
  const {
    objectPath,
    body,
    fileKind,
    upsert = false,
    cacheControl = '3600',
    contentType: contentTypeOpt,
  } = opts

  const proxyBase = String(import.meta.env.VITE_MATCHUP_MEDIA_UPLOAD_URL || '').trim().replace(/\/+$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  let blob =
    body instanceof Blob
      ? body
      : ArrayBuffer.isView(body)
        ? new Blob([new Uint8Array(body.buffer, body.byteOffset, body.byteLength)])
        : new Blob([body])

  /** @type {{ message: string } | null} */
  let sizeErr = null
  const n = blob.size
  if (fileKind === 'video') {
    if (n > MAX_VIDEO_BYTES) sizeErr = { message: '영상 크기 한도를 초과했어요' }
  } else if (n > MAX_IMAGE_BYTES) {
    sizeErr = { message: '이미지 크기 한도를 초과했어요' }
  }
  if (sizeErr) return { error: sizeErr, publicUrl: null }

  const ctype =
    contentTypeOpt ||
    (blob instanceof File && blob.type) ||
    (fileKind === 'video' ? 'video/mp4' : 'image/jpeg')

  const directOpts = { objectPath, blob, fileKind, upsert, cacheControl, ctype }

  if (!proxyBase) {
    return uploadDirectToStorage(supabase, directOpts)
  }

  const edge = await uploadViaEdgeFunction(supabase, proxyBase, anonKey, directOpts)
  if (!edge.error) {
    return { error: null, publicUrl: edge.publicUrl }
  }

  if (isRetriableUploadFailure(edge.error.message, edge.status)) {
    console.warn('[matchupMedia] edge upload failed, trying direct storage', edge.error.message)
    const direct = await uploadDirectToStorage(supabase, directOpts)
    if (!direct.error) return direct
    return {
      error: {
        message: direct.error.message || edge.error.message,
      },
      publicUrl: direct.publicUrl,
    }
  }

  return { error: edge.error, publicUrl: edge.publicUrl }
}
