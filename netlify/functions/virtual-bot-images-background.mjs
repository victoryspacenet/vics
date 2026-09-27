/**
 * 관전봇 이미지 작업 (백그라운드 함수, 최대 15분)
 *   예약 함수 virtual-bot-images 가 10분마다 서명된 요청으로 시작시킨다.
 *   사진을 만든 뒤에만 생성·도전. 실패하면 슬롯을 건드리지 않음.
 *   한 틱의 90% + 전체 믹스가 이미지 90%에 못 미치면 생성은 이미지로만.
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
  countActiveMediaMix,
  loadBotMatchupSettings,
  planImageRunQuota,
} from '../lib/botMatchupQuota.mjs'
import { acquireBotImageLock, releaseBotImageLock, verifyBotImageJobRequest } from '../lib/botImageJob.mjs'
import { createVirtualBotClient } from '../lib/virtualBotRuntime.mjs'

// 잠금(14분)·실행 한도(15분) 안에서 마지막 한 건(사진 + 유사도 약 45초)까지 끝나게 남겨 둔다.
const JOB_BUDGET_MS = 8 * 60 * 1000

export default async (req) => {
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

    const mix = await countActiveMediaMix(supabase)
    const planned = planImageRunQuota(settings, mix)
    const started = Date.now()

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

    let challenges = { attempted: 0, challenged: 0, skipped: 'none' }
    try {
      challenges = await challengeBotImageMatchups(supabase, {
        remaining: planned.imageChallenge,
        started,
        budgetMs: JOB_BUDGET_MS,
        intervalHours: settings.intervalHours,
      })
    } catch (e) {
      challenges = { attempted: 0, challenged: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] challenges:', challenges)
    }

    let reviews = { reviewed: 0 }
    try {
      reviews = await reviewBotChallenges(supabase, { started, budgetMs: JOB_BUDGET_MS })
    } catch (e) {
      reviews = { reviewed: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] challenge reviews:', reviews)
    }

    let creates = { attempted: 0, created: 0, skipped: 'none' }
    try {
      creates = await createBotImageMatchups(supabase, {
        remaining: planned.imageCreate,
        started,
        budgetMs: JOB_BUDGET_MS,
        intervalHours: settings.intervalHours,
      })
    } catch (e) {
      creates = { attempted: 0, created: 0, error: e?.message || String(e) }
      console.warn('[virtual-bot-images-background] creates:', creates)
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
        mix,
      },
    })
  } catch (error) {
    console.error('[virtual-bot-images-background] error:', error?.message || error)
  } finally {
    await releaseBotImageLock(supabase, lockToken)
  }
}
