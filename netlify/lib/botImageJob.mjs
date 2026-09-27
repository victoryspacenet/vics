/**
 * 관전봇 이미지 백그라운드 작업 — 호출 서명과 중복 실행 잠금.
 * 예약 함수(30초 제한)는 시작만 시키고, 사진 작업은 백그라운드 함수(15분)가 한다.
 */
import crypto from 'node:crypto'

export const BOT_IMAGE_JOB_PATH = '/.netlify/functions/virtual-bot-images-background'
const SIGNATURE_HEADER = 'x-vics-bot-job'
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000
const LOCK_KEY = 'virtual_bot_images_lock'
export const LOCK_TTL_MS = 14 * 60 * 1000

function signingKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
}

function sign(timestamp) {
  return crypto.createHmac('sha256', signingKey()).update(`bot-image-job:${timestamp}`).digest('hex')
}

export function botImageJobHeaders(now = Date.now()) {
  const ts = String(now)
  return { [SIGNATURE_HEADER]: `${ts}.${sign(ts)}` }
}

export function verifyBotImageJobRequest(req, now = Date.now()) {
  if (!signingKey()) return false
  const raw = String(req.headers.get(SIGNATURE_HEADER) || '')
  const [ts, sig] = raw.split('.')
  const at = Number(ts)
  if (!ts || !sig || !Number.isFinite(at)) return false
  if (Math.abs(now - at) > SIGNATURE_MAX_AGE_MS) return false
  const expected = Buffer.from(sign(ts), 'hex')
  const given = Buffer.from(sig, 'hex')
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}

/** 다른 실행이 잠금을 잡고 있으면 null. 잡았으면 해제에 쓸 토큰. */
export async function acquireBotImageLock(supabase, now = Date.now()) {
  const token = crypto.randomUUID()
  const nowIso = new Date(now).toISOString()
  const value = { token, until: new Date(now + LOCK_TTL_MS).toISOString(), started_at: nowIso }

  const { error: seedErr } = await supabase
    .from('admin_settings')
    .upsert({ key: LOCK_KEY, value: { until: new Date(0).toISOString() } }, { onConflict: 'key', ignoreDuplicates: true })
  if (seedErr) throw seedErr

  const { data, error } = await supabase
    .from('admin_settings')
    .update({ value })
    .eq('key', LOCK_KEY)
    .lt('value->>until', nowIso)
    .select('key')
  if (error) throw error
  return data?.length ? token : null
}

export async function releaseBotImageLock(supabase, token) {
  if (!token) return
  const { error } = await supabase
    .from('admin_settings')
    .update({ value: { until: new Date(0).toISOString(), released_at: new Date().toISOString() } })
    .eq('key', LOCK_KEY)
    .eq('value->>token', token)
  if (error) console.warn('[virtual-bot-images] lock release:', error.message)
}
