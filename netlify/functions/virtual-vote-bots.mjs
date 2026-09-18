/**
 * 가상 투표 봇 — 10분마다 호출
 *   1) `run_virtual_vote_bots` 조회/투표 인플레
 *   2) 텍스트 생성·도전은 JS. 같은 제목·본문은 28일 안에 다시 올리지 않음.
 *      사진은 virtual-bot-images가 담당.
 */
import { challengeBotTextMatchups, createBotTextMatchups } from '../lib/botMatchupImage.mjs'
import {
  countActiveMediaMix,
  loadBotMatchupSettings,
  planTextRunQuota,
  saveBotMatchupQuotaState,
} from '../lib/botMatchupQuota.mjs'
import { callRpc, createVirtualBotClient, jsonResponse, readSchedulePayload } from '../lib/virtualBotRuntime.mjs'

export default async (req) => {
  await readSchedulePayload(req)

  const { supabase } = createVirtualBotClient()
  if (!supabase) {
    console.error('[virtual-vote-bots] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return jsonResponse({ ok: false, error: 'missing env' }, 500)
  }

  try {
    const started = Date.now()
    let votes
    try {
      votes = await callRpc(supabase, 'run_virtual_vote_bots')
    } catch (e) {
      votes = { error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] votes rpc:', votes)
    }
    const settings = await loadBotMatchupSettings(supabase)
    if (!settings.enabled) {
      return jsonResponse({ ok: true, result: { votes, matchups: { skipped: 'disabled' } } })
    }

    const mix = await countActiveMediaMix(supabase)
    const planned = planTextRunQuota(settings, mix)
    await saveBotMatchupQuotaState(supabase, settings.raw, {
      text_create_acc: planned.textCreateAcc,
      text_challenge_acc: planned.textChallengeAcc,
      last_text_create: planned.textCreate,
      last_text_challenge: planned.textChallenge,
      last_quota_at: new Date().toISOString(),
    })

    const matchups = await callRpc(supabase, 'run_virtual_bot_matchups', {
      p_max_create: 0,
      p_max_challenge: 0,
    }).catch((e) => {
      const result = { error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] matchups rpc:', result)
      return result
    })
    let textCreates = { attempted: 0, created: 0, skipped: 'none' }
    try {
      textCreates = await createBotTextMatchups(supabase, {
        remaining: planned.textCreate,
        intervalHours: settings.intervalHours,
        started,
        budgetMs: 48_000,
      })
    } catch (e) {
      textCreates = { attempted: 0, created: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] text creates:', textCreates)
    }
    let textChallenges = { attempted: 0, challenged: 0, skipped: 'none' }
    try {
      textChallenges = await challengeBotTextMatchups(supabase, {
        remaining: planned.textChallenge,
        intervalHours: settings.intervalHours,
        started,
        budgetMs: 48_000,
      })
    } catch (e) {
      textChallenges = { attempted: 0, challenged: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] text challenges:', textChallenges)
    }

    const result = {
      votes,
      matchups,
      textCreates,
      textChallenges,
      quota: {
        textCreate: planned.textCreate,
        textChallenge: planned.textChallenge,
        createGated: planned.createGated,
        mix,
      },
    }
    console.log('[virtual-vote-bots]', result)
    return jsonResponse({ ok: true, result })
  } catch (error) {
    console.error('[virtual-vote-bots] rpc error:', error.message)
    return jsonResponse({ ok: false, error: error.message }, 500)
  }
}
