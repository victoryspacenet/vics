/**
 * matchup-media 업로드
 * - 기본: Supabase Storage 직접 업로드(안정·대용량 영상)
 * - VITE_MATCHUP_MEDIA_UPLOAD_URL + VITE_MATCHUP_MEDIA_UPLOAD_EDGE_FIRST=1 일 때만 Edge 우선
 * - Edge 실패·타임아웃 시 직접 업로드 폴백, 직접 실패 시(이미지) Edge 폴백
 */
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, UPLOAD_TIMEOUT_IMAGE_MS, UPLOAD_TIMEOUT_VIDEO_MS } from './mediaSpec'

const BUCKET = 'matchup-media'
const SESSION_TIMEOUT_MS = 12_000
const EDGE_TIMEOUT_IMAGE_MS = 55_000
const EDGE_TIMEOUT_VIDEO_MS = 90_000
const UPLOAD_RETRY_MAX = 2

/** @type {Promise<import('@supabase/supabase-js').Session | null> | null} */
let uploadSessionFlight = null

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

function edgeTimeoutMs(fileKind) {
  return fileKind === 'video' ? EDGE_TIMEOUT_VIDEO_MS : EDGE_TIMEOUT_IMAGE_MS
}

function uploadTimeoutMessage(fileKind) {
  return fileKind === 'video'
    ? '영상 업로드 시간이 초과했어요. Wi‑Fi 연결을 확인한 뒤 다시 시도해 주세요.'
    : '이미지 업로드 시간이 초과했어요. Wi‑Fi 연결을 확인한 뒤 다시 시도해 주세요.'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  if (
    m.includes('시간이 초과') ||
    m.includes('timeout') ||
    m.includes('network') ||
    m.includes('failed to fetch') ||
    m.includes('load failed') ||
    m.includes('econnreset') ||
    m.includes('socket')
  ) {
    return true
  }
  if (status === 502 || status === 503 || status === 504 || status === 408 || status === 429) return true
  return false
}

function isAuthUploadFailure(errMsg, status) {
  const m = String(errMsg || '').toLowerCase()
  if (status === 401) return true
  return (
    m.includes('jwt') ||
    m.includes('expired') ||
    m.includes('not authorized') ||
    m.includes('invalid claim') ||
    m.includes('로그인')
  )
}

/**
 * 업로드 직전 세션 확보·갱신(동시 호출 병합). auth 락 경합 완화용.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function warmupMatchupMediaUploadSession(supabase) {
  if (!uploadSessionFlight) {
    uploadSessionFlight = (async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          '로그인 확인 시간이 초과했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
        )
        if (error) throw error
        let session = data?.session ?? null
        if (!session?.access_token) return null

        const expMs = (session.expires_at ?? 0) * 1000
        if (expMs && expMs - Date.now() < 90_000) {
          const { data: refreshed, error: refErr } = await withTimeout(
            supabase.auth.refreshSession(),
            SESSION_TIMEOUT_MS,
            '로그인 갱신 시간이 초과했어요. 다시 로그인해 주세요.',
          )
          if (!refErr && refreshed?.session?.access_token) {
            session = refreshed.session
          }
        }
        return session
      } finally {
        uploadSessionFlight = null
      }
    })()
  }
  return uploadSessionFlight
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function getEdgeAccessToken(supabase) {
  const session = await warmupMatchupMediaUploadSession(supabase)
  return session?.access_token ?? null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function uploadDirectToStorage(supabase, { objectPath, blob, fileKind, upsert, cacheControl, ctype }, attempt = 0) {
  const ms = uploadTimeoutMs(fileKind)
  let error = null
  try {
    const result = await withTimeout(
      supabase.storage.from(BUCKET).upload(objectPath, blob, {
        upsert,
        cacheControl,
        contentType: ctype || undefined,
      }),
      ms,
      uploadTimeoutMessage(fileKind),
    )
    error = result.error
  } catch (e) {
    error = { message: e?.message ? String(e.message) : uploadTimeoutMessage(fileKind) }
  }

  const publicUrl = publicUrlFallback(supabase, objectPath)
  if (!error) return { error: null, publicUrl }

  const msg = error.message || ''
  if (isAuthUploadFailure(msg) && attempt < 1) {
    uploadSessionFlight = null
    try {
      await withTimeout(
        supabase.auth.refreshSession(),
        SESSION_TIMEOUT_MS,
        '로그인 갱신 시간이 초과했어요. 다시 로그인해 주세요.',
      )
    } catch {
      return { error: { message: msg || '로그인이 필요해요' }, publicUrl }
    }
    return uploadDirectToStorage(supabase, { objectPath, blob, fileKind, upsert, cacheControl, ctype }, attempt + 1)
  }

  if (attempt < UPLOAD_RETRY_MAX && isRetriableUploadFailure(msg)) {
    await sleep(800 * (attempt + 1))
    return uploadDirectToStorage(supabase, { objectPath, blob, fileKind, upsert, cacheControl, ctype }, attempt + 1)
  }

  return { error: { message: msg || '업로드 실패' }, publicUrl }
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
  const ms = edgeTimeoutMs(fileKind)
  const tok = await getEdgeAccessToken(supabase)
  if (!tok) {
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

function edgeFirstEnabled() {
  const v = String(import.meta.env.VITE_MATCHUP_MEDIA_UPLOAD_EDGE_FIRST || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
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

  await warmupMatchupMediaUploadSession(supabase).catch(() => null)

  const useEdge = Boolean(proxyBase) && fileKind !== 'video'
  const tryEdgeFirst = useEdge && edgeFirstEnabled()

  if (tryEdgeFirst) {
    const edge = await uploadViaEdgeFunction(supabase, proxyBase, anonKey, directOpts)
    if (!edge.error) {
      return { error: null, publicUrl: edge.publicUrl }
    }
    if (isRetriableUploadFailure(edge.error.message, edge.status)) {
      console.warn('[matchupMedia] edge upload failed, trying direct storage', edge.error.message)
      const direct = await uploadDirectToStorage(supabase, directOpts)
      if (!direct.error) return direct
      return {
        error: { message: direct.error.message || edge.error.message },
        publicUrl: direct.publicUrl,
      }
    }
    return { error: edge.error, publicUrl: edge.publicUrl }
  }

  const direct = await uploadDirectToStorage(supabase, directOpts)
  if (!direct.error) return direct

  if (useEdge && isRetriableUploadFailure(direct.error.message)) {
    console.warn('[matchupMedia] direct upload failed, trying edge', direct.error.message)
    const edge = await uploadViaEdgeFunction(supabase, proxyBase, anonKey, directOpts)
    if (!edge.error) {
      return { error: null, publicUrl: edge.publicUrl }
    }
    return {
      error: { message: edge.error.message || direct.error.message },
      publicUrl: edge.publicUrl || direct.publicUrl,
    }
  }

  return direct
}
