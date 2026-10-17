/**
 * 관전봇 댓글 — 30분마다 (매시 5분, 35분).
 * 봇 한 명당 48시간에 하나. 본인 매치업에는 쓰지 않는다.
 * 예약 함수는 30초에서 끊기므로 한 회에 최대 2개만 쓴다.
 */
import { postBotMatchupComments } from '../lib/botMatchupComments.mjs'
import { botsPaused, createVirtualBotClient, jsonResponse, readSchedulePayload } from '../lib/virtualBotRuntime.mjs'

const BUDGET_MS = 22_000

export default async (req) => {
  await readSchedulePayload(req)
  if (botsPaused()) return jsonResponse({ ok: true, result: { skipped: 'paused' } })

  const { supabase } = createVirtualBotClient()
  if (!supabase) {
    console.error('[virtual-bot-comments] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return jsonResponse({ ok: false, error: 'missing env' }, 500)
  }

  try {
    const result = await postBotMatchupComments(supabase, {
      started: Date.now(),
      budgetMs: BUDGET_MS,
    })
    console.log('[virtual-bot-comments]', result)
    return jsonResponse({ ok: true, result })
  } catch (error) {
    console.error('[virtual-bot-comments]', error?.message || error)
    return jsonResponse({ ok: false, error: error?.message || String(error) }, 500)
  }
}
