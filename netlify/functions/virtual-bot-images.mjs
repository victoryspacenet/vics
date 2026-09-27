/**
 * 관전봇 이미지 — 10분마다, 투표 스케줄과 5분 어긋나게 호출
 *   예약 함수는 30초 제한이라 사진 한 장(생성 + 유사도)도 끝내지 못한다.
 *   여기서는 백그라운드 함수 virtual-bot-images-background 를 시작시키기만 한다.
 */
import { BOT_IMAGE_JOB_PATH, botImageJobHeaders } from '../lib/botImageJob.mjs'
import { jsonResponse, readSchedulePayload } from '../lib/virtualBotRuntime.mjs'

const TRIGGER_TIMEOUT_MS = 10_000

function siteBaseUrl(context) {
  return String(context?.site?.url || process.env.URL || process.env.DEPLOY_PRIME_URL || '').trim()
}

export default async (req, context) => {
  await readSchedulePayload(req)

  const base = siteBaseUrl(context)
  if (!base) {
    console.error('[virtual-bot-images] site URL 없음 — 백그라운드 작업을 시작하지 못함')
    return jsonResponse({ ok: false, error: 'missing site url' }, 500)
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[virtual-bot-images] SUPABASE_SERVICE_ROLE_KEY 없음')
    return jsonResponse({ ok: false, error: 'missing env' }, 500)
  }

  const ctrl = new AbortController()
  const kill = setTimeout(() => ctrl.abort(), TRIGGER_TIMEOUT_MS)
  try {
    const res = await fetch(new URL(BOT_IMAGE_JOB_PATH, base), {
      method: 'POST',
      headers: botImageJobHeaders(),
      signal: ctrl.signal,
    })
    console.log('[virtual-bot-images] background job triggered:', res.status)
    return jsonResponse({ ok: res.status === 202, status: res.status })
  } catch (error) {
    console.error('[virtual-bot-images] trigger error:', error?.message || error)
    return jsonResponse({ ok: false, error: error?.message || String(error) }, 500)
  } finally {
    clearTimeout(kill)
  }
}
