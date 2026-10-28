/**
 * 가상 투표 봇 — 30분마다 호출 (매시 0분, 30분)
 *   1) `run_virtual_vote_bots` 조회/투표 인플레
 *   2) 텍스트 생성·도전은 JS. 같은 제목·본문은 15일 안에 다시 올리지 않음.
 *      사진은 virtual-bot-images가 담당.
 */
import { challengeBotTextMatchups, createBotTextMatchups } from '../lib/botMatchupImage.mjs'
import { loadBotMatchupSettings, planTextRunQuota, saveBotMatchupQuotaState } from '../lib/botMatchupQuota.mjs'
import { botsPaused, callRpc, createVirtualBotClient, jsonResponse, readSchedulePayload } from '../lib/virtualBotRuntime.mjs'

// 예약 함수는 30초에서 끊긴다. 도전을 글 생성·투표보다 먼저 끝낸다.
const TEXT_CREATE_BUDGET_MS = 8_000
const TEXT_CHALLENGE_BUDGET_MS = 18_000

export default async (req) => {
  await readSchedulePayload(req)
  if (botsPaused()) return jsonResponse({ ok: true, result: { skipped: 'paused' } })

  const { supabase } = createVirtualBotClient()
  if (!supabase) {
    console.error('[virtual-vote-bots] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return jsonResponse({ ok: false, error: 'missing env' }, 500)
  }

  try {
    const settings = await loadBotMatchupSettings(supabase)
    if (!settings.enabled) {
      return jsonResponse({ ok: true, result: { matchups: { skipped: 'disabled' } } })
    }

    const planned = planTextRunQuota(settings)
    // 글 생성의 제목 조회가 길어도, 도전 저장이 먼저 끝나게 한다.
    let textChallenges = { attempted: 0, challenged: 0, skipped: 'none' }
    try {
      textChallenges = await challengeBotTextMatchups(supabase, {
        remaining: planned.textChallenge,
        intervalHours: settings.intervalHours,
        started: Date.now(),
        budgetMs: TEXT_CHALLENGE_BUDGET_MS,
      })
    } catch (e) {
      textChallenges = { attempted: 0, challenged: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] text challenges:', textChallenges)
    }
    let textCreates = { attempted: 0, created: 0, skipped: 'none' }
    try {
      textCreates = await createBotTextMatchups(supabase, {
        remaining: planned.textCreate,
        intervalHours: settings.intervalHours,
        started: Date.now(),
        budgetMs: TEXT_CREATE_BUDGET_MS,
      })
    } catch (e) {
      textCreates = { attempted: 0, created: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] text creates:', textCreates)
    }

    await saveBotMatchupQuotaState(supabase, settings.raw, {
      text_create_acc: planned.textCreateAcc,
      text_challenge_acc: planned.textChallengeAcc,
      last_text_create: planned.textCreate,
      last_text_challenge: planned.textChallenge,
      last_quota_at: new Date().toISOString(),
    })

    let votes
    try {
      votes = await callRpc(supabase, 'run_virtual_vote_bots')
    } catch (e) {
      votes = { error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] votes rpc:', votes)
    }

    const result = {
      votes,
      textCreates,
      textChallenges,
      quota: {
        textCreate: planned.textCreate,
        textChallenge: planned.textChallenge,
        createGated: planned.createGated,
        imageCreate: planned.imageCreate,
        imageChallenge: planned.imageChallenge,
      },
    }
    console.log('[virtual-vote-bots]', result)
    return jsonResponse({ ok: true, result })
  } catch (error) {
    console.error('[virtual-vote-bots] rpc error:', error.message)
    return jsonResponse({ ok: false, error: error.message }, 500)
  }
}
