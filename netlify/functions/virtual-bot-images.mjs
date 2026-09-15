/**
 * 관전봇 이미지 전용 — 10분마다, 투표 스케줄과 5분 어긋나게 호출
 *   사진을 만든 뒤에만 생성·도전. 실패하면 슬롯을 건드리지 않음.
 *   한 틱의 90% + 전체 믹스가 이미지 90%에 못 미치면 생성은 이미지로만.
 *   프로필 사진이 전체의 50%에 못 미치면 틱마다 1장씩 채움.
 */
import {
  abandonEmptyBotImageChallenges,
  challengeBotImageMatchups,
  createBotImageMatchups,
  PHASE_BUDGET_MS,
} from '../lib/botMatchupImage.mjs'
import { ensureBotProfilePhotos } from '../lib/botProfilePhotos.mjs'
import { stripBorrowedBotChallengeMedia } from '../lib/botChallengeCopy.mjs'
import {
  countActiveMediaMix,
  loadBotMatchupSettings,
  planImageRunQuota,
} from '../lib/botMatchupQuota.mjs'
import { createVirtualBotClient, jsonResponse, readSchedulePayload } from '../lib/virtualBotRuntime.mjs'

const IMAGE_BUDGET_MS = 55_000

export default async (req) => {
  await readSchedulePayload(req)

  const { supabase } = createVirtualBotClient()
  if (!supabase) {
    console.error('[virtual-bot-images] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return jsonResponse({ ok: false, error: 'missing env' }, 500)
  }

  try {
    const settings = await loadBotMatchupSettings(supabase)
    if (!settings.enabled) {
      return jsonResponse({ ok: true, result: { skipped: 'disabled' } })
    }

    const mix = await countActiveMediaMix(supabase)
    const planned = planImageRunQuota(settings, mix)
    const started = Date.now()
    const budgetMs = Math.min(IMAGE_BUDGET_MS, PHASE_BUDGET_MS + 5_000)

    let avatars = { uploaded: 0 }
    try {
      avatars = await ensureBotProfilePhotos(supabase, {
        max: 1,
        started,
        budgetMs: Math.min(28_000, budgetMs),
      })
    } catch (e) {
      avatars = { uploaded: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images] avatars:', avatars)
    }

    let emptyImageChallenges = { reopened: 0 }
    try {
      emptyImageChallenges = await abandonEmptyBotImageChallenges(supabase)
    } catch (e) {
      emptyImageChallenges = { reopened: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images] abandon empty image challenges:', emptyImageChallenges)
    }

    let strippedMedia = { attempted: 0, updated: 0 }
    try {
      strippedMedia = await stripBorrowedBotChallengeMedia(supabase)
    } catch (e) {
      strippedMedia = { attempted: 0, updated: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images] strip borrowed media:', strippedMedia)
    }

    let creates = { attempted: 0, created: 0, skipped: 'none' }
    try {
      creates = await createBotImageMatchups(supabase, {
        remaining: planned.imageCreate,
        started,
        budgetMs,
        intervalHours: settings.intervalHours,
      })
    } catch (e) {
      creates = { attempted: 0, created: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images] creates:', creates)
    }

    let challenges = { attempted: 0, challenged: 0, skipped: 'none' }
    try {
      challenges = await challengeBotImageMatchups(supabase, {
        remaining: planned.imageChallenge,
        started,
        budgetMs,
        intervalHours: settings.intervalHours,
      })
    } catch (e) {
      challenges = { attempted: 0, challenged: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images] challenges:', challenges)
    }

    const result = {
      avatars,
      creates,
      challenges,
      emptyImageChallenges,
      strippedMedia,
      quota: {
        imageCreate: planned.imageCreate,
        imageChallenge: planned.imageChallenge,
        gated: planned.gated,
        mix,
      },
    }
    console.log('[virtual-bot-images]', result)
    return jsonResponse({ ok: true, result })
  } catch (error) {
    console.error('[virtual-bot-images] error:', error.message)
    return jsonResponse({ ok: false, error: error.message }, 500)
  }
}
