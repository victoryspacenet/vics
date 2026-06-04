/**
 * matchup-media 검증 업로드 (서버 강제)
 * 배포: supabase functions deploy matchup-media-upload
 * 환경: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (대시보드 자동 주입 + service role 필요)
 * 클라: VITE_MATCHUP_MEDIA_UPLOAD_URL = https://<ref>.supabase.co/functions/v1/matchup-media-upload
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'matchup-media'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const HEADER_BYTES = 32
const VIDEO_FTYP_PROBE = Math.min(64 * 1024, 262_144)

const IMAGE_EXT_ALLOW = new Set(['jpg', 'jpeg', 'png', 'gif'])
const VIDEO_EXT_ALLOW = new Set(['mp4', 'mov'])

function corsHeaders(extra: Record<string, string> = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-object-path, x-file-kind, x-upsert, x-cache-control',
    ...extra,
  }
}

function extFromLastSegment(objectPath: string): string {
  const seg = objectPath.split('/').pop() || ''
  const i = seg.lastIndexOf('.')
  if (i < 0) return ''
  return seg.slice(i + 1).toLowerCase().replace(/[^\w]/g, '') || ''
}

function allowedObjectPath(objectPath: string, userId: string): boolean {
  if (!objectPath || objectPath.includes('..') || objectPath.includes('//')) return false
  if (objectPath.startsWith('/') || objectPath.endsWith('/')) return false
  const okPrefix = [`matchups/${userId}/`, `inquiries/${userId}/`, `notices/inline/${userId}/`, `avatars/${userId}/`]
  return okPrefix.some((p) => objectPath.startsWith(p))
}

function isJpeg(u8: Uint8Array) {
  return u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff
}
function isPng(u8: Uint8Array) {
  return (
    u8.length >= 8 &&
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47 &&
    u8[4] === 0x0d &&
    u8[5] === 0x0a &&
    u8[6] === 0x1a &&
    u8[7] === 0x0a
  )
}
function isGif(u8: Uint8Array) {
  return (
    u8.length >= 6 &&
    u8[0] === 0x47 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x38 &&
    (u8[4] === 0x37 || u8[4] === 0x39) &&
    u8[5] === 0x61
  )
}
function sniffIsoBmff(u8: Uint8Array): boolean {
  const n = Math.min(u8.length - 4, VIDEO_FTYP_PROBE)
  for (let i = 0; i <= n; i++) {
    if (u8[i] === 0x66 && u8[i + 1] === 0x74 && u8[i + 2] === 0x79 && u8[i + 3] === 0x70) return true
  }
  return false
}

function validateBytes(buf: Uint8Array, fileKind: string, ext: string): { ok: boolean; message?: string } {
  if (!buf.byteLength) return { ok: false, message: '빈 본문이에요' }
  const extOk = ext && (fileKind === 'video' ? VIDEO_EXT_ALLOW.has(ext) : IMAGE_EXT_ALLOW.has(ext))
  if (!extOk) return { ok: false, message: '허용되지 않는 확장자예요' }

  if (fileKind === 'video') {
    if (buf.byteLength > MAX_VIDEO_BYTES) return { ok: false, message: `영상은 ${MAX_VIDEO_BYTES / (1024 * 1024)}MB 이하여야 해요` }
    const probe = buf.subarray(0, Math.min(buf.byteLength, VIDEO_FTYP_PROBE))
    if (!sniffIsoBmff(probe)) return { ok: false, message: 'MP4/MOV 시그니처가 아니에요' }
    return { ok: true }
  }

  if (buf.byteLength > MAX_IMAGE_BYTES) return { ok: false, message: `이미지는 ${MAX_IMAGE_BYTES / (1024 * 1024)}MB 이하여야 해요` }
  const head = buf.subarray(0, Math.min(buf.byteLength, HEADER_BYTES))
  if (ext === 'png') {
    if (!isPng(head)) return { ok: false, message: 'PNG 시그니처가 아니에요' }
    return { ok: true }
  }
  if (ext === 'gif') {
    if (!isGif(head)) return { ok: false, message: 'GIF 시그니처가 아니에요' }
    return { ok: true }
  }
  if (!isJpeg(head)) return { ok: false, message: 'JPEG 시그니처가 아니에요' }
  return { ok: true }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('[matchup-media-upload] missing env')
    return json({ ok: false, error: '서버 설정 오류 (Supabase 환경 변수)' }, 500)
  }

  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return json({ ok: false, error: 'Authorization 필요' }, 401)

  const objectPathRaw = req.headers.get('x-object-path') ?? req.headers.get('X-Object-Path')
  const fileKind = (req.headers.get('x-file-kind') ?? req.headers.get('X-File-Kind') ?? '').toLowerCase()
  const upsert = /^(1|true|yes)$/i.test(req.headers.get('x-upsert') ?? req.headers.get('X-Upsert') ?? '')
  const cacheControl =
    req.headers.get('x-cache-control')?.trim() || req.headers.get('X-Cache-Control')?.trim() || '3600'

  if (!objectPathRaw?.trim()) return json({ ok: false, error: 'X-Object-Path 필요' }, 400)
  if (fileKind !== 'image' && fileKind !== 'video') {
    return json({ ok: false, error: 'X-File-Kind 는 image 또는 video 여야 해요' }, 400)
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(token)
  if (authErr || !authData.user?.id) {
    return json({ ok: false, error: '로그인이 필요해요' }, 401)
  }
  const userId = authData.user.id

  const objectPath = objectPathRaw.trim().replace(/^\/+/, '')
  if (!allowedObjectPath(objectPath, userId)) {
    return json({ ok: false, error: '허용되지 않은 스토리지 경로예요' }, 403)
  }

  const ext = extFromLastSegment(objectPath)
  const buf = new Uint8Array(await req.arrayBuffer())
  const chk = validateBytes(buf, fileKind, ext)
  if (!chk.ok) return json({ ok: false, error: chk.message ?? '파일 검증 실패' }, 400)

  const contentTypeHdr =
    req.headers.get('content-type')?.trim() ||
    req.headers.get('Content-Type')?.trim() ||
    'application/octet-stream'

  const svc = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: upErr } = await svc.storage.from(BUCKET).upload(objectPath, buf, {
    upsert,
    cacheControl,
    contentType: contentTypeHdr.split(';')[0].trim(),
  })

  if (upErr) {
    console.error('[matchup-media-upload] storage.upload', upErr)
    return json({ ok: false, error: upErr.message || 'Storage 업로드 실패' }, 502)
  }

  const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(objectPath)
  const publicUrl = pub?.publicUrl ?? null
  return json({ ok: true, publicUrl })
})
