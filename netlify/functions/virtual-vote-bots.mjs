/**
 * 가상 투표 봇 — 10분마다
 *   1) `run_virtual_vote_bots` 조회/투표 인플레
 *   2) `run_virtual_bot_matchups` 관전봇 매치업 생성·도전 (48h에 각 1회)
 *   3) 생성된 매치업에 OpenAI 이미지 첨부 (키 없으면 텍스트 유지, 이미 도전된 건 형식 유지)
 *   4) 도전은 A측 형식에 맞춤(텍스트/이미지, 영상은 건너뜀). 이미지 도전은 새로 생성. 멘트는 자랑+도발
 * 선행: supabase_virtual_vote_bots.sql + supabase_virtual_bot_matchups.sql
 *       + supabase_virtual_bot_matchup_prompts.sql
 *       + supabase_virtual_bot_challenge_prompts.sql
 *       + Netlify `SUPABASE_SERVICE_ROLE_KEY` (이미지는 `OPENAI_API_KEY`)
 */
import { createClient } from '@supabase/supabase-js'
import { attachBotChallengeImages, attachBotMatchupImages } from '../lib/botMatchupImage.mjs'
import { applyBotChallengeCopy, stripBorrowedBotChallengeMedia } from '../lib/botChallengeCopy.mjs'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function isMissingRpc(error) {
  const code = error?.code || ''
  const msg = error?.message || ''
  return code === 'PGRST202' || /could not find the function/i.test(msg) || /does not exist/i.test(msg)
}

async function callRpc(supabase, name) {
  const { data, error } = await supabase.rpc(name)
  if (error) {
    if (isMissingRpc(error)) {
      console.warn(`[virtual-vote-bots] ${name} 미배포, 건너뜀:`, error.message)
      return { skipped: 'rpc_missing', error: error.message }
    }
    throw error
  }
  return data
}

export default async (req) => {
  try {
    const raw = await req.text()
    if (raw) {
      try {
        const { next_run: nextRun } = JSON.parse(raw)
        if (nextRun) console.log('[virtual-vote-bots] next_run:', nextRun)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  if (!supabaseUrl || !serviceKey) {
    console.error('[virtual-vote-bots] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return new Response(JSON.stringify({ ok: false, error: 'missing env' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const votes = await callRpc(supabase, 'run_virtual_vote_bots')
    const matchups = await callRpc(supabase, 'run_virtual_bot_matchups')
    const createdIds = Array.isArray(matchups?.created_ids) ? matchups.created_ids : []
    const challengedIds = Array.isArray(matchups?.challenged_ids) ? matchups.challenged_ids : null
    let challengeCopy = { attempted: 0, updated: 0, skipped: 'none' }
    try {
      challengeCopy = await applyBotChallengeCopy(supabase, challengedIds)
    } catch (e) {
      challengeCopy = { attempted: Array.isArray(challengedIds) ? challengedIds.length : 0, updated: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] challenge copy:', challengeCopy)
    }
    let strippedMedia = { attempted: 0, updated: 0 }
    try {
      strippedMedia = await stripBorrowedBotChallengeMedia(supabase)
    } catch (e) {
      strippedMedia = { attempted: 0, updated: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] strip borrowed media:', strippedMedia)
    }
    const imageStarted = Date.now()
    let images = { attempted: 0, attached: 0, skipped: 'none' }
    try {
      images = await attachBotMatchupImages(supabase, createdIds, { started: imageStarted })
    } catch (e) {
      images = { attempted: createdIds.length, attached: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] images:', images)
    }
    let challengeImages = { attempted: 0, attached: 0, skipped: 'none' }
    try {
      challengeImages = await attachBotChallengeImages(supabase, challengedIds || [], { started: imageStarted })
    } catch (e) {
      challengeImages = { attempted: Array.isArray(challengedIds) ? challengedIds.length : 0, attached: 0, error: e?.message || String(e) }
      console.warn('[virtual-vote-bots] challenge images:', challengeImages)
    }
    const result = { votes, matchups, challengeCopy, strippedMedia, images, challengeImages }
    console.log('[virtual-vote-bots]', result)
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    console.error('[virtual-vote-bots] rpc error:', error.message)
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
