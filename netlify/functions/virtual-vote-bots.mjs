/**
 * 가상 투표 봇 — 10분마다 호출
 *   1) `run_virtual_vote_bots` 조회/투표 인플레
 *   2) 텍스트 생성은 RPC, 텍스트 도전은 유사도 검사 통과 후에만.
 *      사진은 virtual-bot-images가 담당.
 */
import { challengeBotTextMatchups } from '../lib/botMatchupImage.mjs'
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
    const votes = await callRpc(supabase, 'run_virtual_vote_bots')
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
      p_max_create: planned.textCreate,
      p_max_challenge: 0,
    })
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
