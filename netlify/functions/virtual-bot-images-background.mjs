/**
 * 관전봇 이미지 작업 (백그라운드 함수, 최대 15분)
 *   예약 함수 virtual-bot-images 가 30분마다 서명된 요청으로 시작시킨다.
 *   텍스트 90%가 끝난 뒤에만 이미지 10%를 연다.
 *   사진 생성은 봇당 1회. 실패한 봇만 빼고, 10%가 안 찼으면 다른 봇이 같은 회차에 이어서 시도한다.
 *   프로필 사진이 전체의 50%에 못 미치면 틱마다 1장씩 채움.
 *   도전은 아바타·생성보다 먼저 돌린다.
 *   공개 중인 봇 도전글은 틱마다 몇 건씩 주제 검수 → 안 맞으면 다시 쓴다.
 */
import {
  abandonEmptyBotImageChallenges,
  challengeBotImageMatchups,
  createBotImageMatchups,
} from '../lib/botMatchupImage.mjs'
import { stripBorrowedBotChallengeMedia } from '../lib/botChallengeCopy.mjs'
import { reviewBotChallenges } from '../lib/botChallengeRepair.mjs'
import {
  imageFailedBotIdsWith,
  loadBotMatchupSettings,
  planImageRunQuota,
  saveBotMatchupQuotaState,
} from '../lib/botMatchupQuota.mjs'
import { acquireBotImageLock, releaseBotImageLock, verifyBotImageJobRequest } from '../lib/botImageJob.mjs'
import { botsPaused, createVirtualBotClient } from '../lib/virtualBotRuntime.mjs'

// 실패한 봇은 다시 부르지 않고 다른 봇으로 10%를 채운다. 같은 봇을 8분 동안 반복하지는 않는다.
const JOB_BUDGET_MS = 3 * 60 * 1000

export default async (req) => {
  if (botsPaused()) {
    console.log('[virtual-bot-images-background] skipped: paused')
    return
  }
  if (!verifyBotImageJobRequest(req)) {
    console.warn('[virtual-bot-images-background] rejected: bad signature')
    return
  }

  const { supabase } = createVirtualBotClient()
  if (!supabase) {
    console.error('[virtual-bot-images-background] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return
  }

  let lockToken = null
  try {
    lockToken = await acquireBotImageLock(supabase)
    if (!lockToken) {
      console.log('[virtual-bot-images-background] skipped: previous run still holds the lock')
      return
    }

    const settings = await loadBotMatchupSettings(supabase)
    if (!settings.enabled) {
      console.log('[virtual-bot-images-background] skipped: disabled')
      return
    }

    const planned = planImageRunQuota(settings)
    const started = Date.now()
    if (planned.gated === 'wait_text') {
      console.log('[virtual-bot-images-background] skipped: text phase has not finished')
      return
    }

    let emptyImageChallenges = { reopened: 0 }
    try {
      emptyImageChallenges = await abandonEmptyBotImageChallenges(supabase)
    } catch (e) {
      emptyImageChallenges = { reopened: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] abandon empty image challenges:', emptyImageChallenges)
    }

    let strippedMedia = { attempted: 0, updated: 0 }
    try {
      strippedMedia = await stripBorrowedBotChallengeMedia(supabase)
    } catch (e) {
      strippedMedia = { attempted: 0, updated: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] strip borrowed media:', strippedMedia)
    }

    let raw = settings.raw
    let blockedBotIds = settings.imageFailedBotIds
    const rememberFailures = async (botIds) => {
      const list = (botIds || []).map((id) => String(id || '').trim()).filter(Boolean)
      if (!list.length) return
      const ids = list.reduce((acc, id) => imageFailedBotIdsWith({ image_failed_bot_ids: acc }, id), blockedBotIds)
      if (ids.length === blockedBotIds.length) return
      raw = await saveBotMatchupQuotaState(supabase, raw, { image_failed_bot_ids: ids })
      blockedBotIds = ids
    }

    let creates = { attempted: 0, created: 0, skipped: 'none' }
    try {
      creates = await createBotImageMatchups(supabase, {
        remaining: planned.imageCreate,
        started,
        budgetMs: JOB_BUDGET_MS,
        intervalHours: settings.intervalHours,
        failedBotIds: blockedBotIds,
      })
    } catch (e) {
      creates = { attempted: 0, created: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] creates:', creates)
    }
    await rememberFailures(creates.failedBotIds)

    let challenges = { attempted: 0, challenged: 0, skipped: 'none' }
    try {
      challenges = await challengeBotImageMatchups(supabase, {
        remaining: planned.imageChallenge,
        started: Date.now(),
        budgetMs: JOB_BUDGET_MS,
        intervalHours: settings.intervalHours,
        failedBotIds: blockedBotIds,
      })
    } catch (e) {
      challenges = { attempted: 0, challenged: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] challenges:', challenges)
    }
    await rememberFailures(challenges.failedBotIds)

    let reviews = { reviewed: 0 }
    try {
      reviews = await reviewBotChallenges(supabase, { started, budgetMs: JOB_BUDGET_MS })
    } catch (e) {
      reviews = { reviewed: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] challenge reviews:', reviews)
    }

    let avatars = { uploaded: 0 }
    try {
      const { ensureBotProfilePhotos } = await import('../lib/botProfilePhotos.mjs')
      avatars = await ensureBotProfilePhotos(supabase, {
        max: 1,
        started,
        budgetMs: JOB_BUDGET_MS,
      })
    } catch (e) {
      avatars = { uploaded: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] avatars:', avatars)
    }

    console.log('[virtual-bot-images-background]', {
      elapsed_ms: Date.now() - started,
      avatars,
      creates,
      challenges,
      reviews,
      emptyImageChallenges,
      strippedMedia,
      quota: {
        imageCreate: planned.imageCreate,
        imageChallenge: planned.imageChallenge,
        gated: planned.gated,
      },
    })
  } catch (error) {
    console.error('[virtual-bot-images-background] error:', error?.message || error)
  } finally {
    await releaseBotImageLock(supabase, lockToken)
  }
}
