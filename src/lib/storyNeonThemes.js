import { tierAtLeast } from './tiers'

/**
 * 스토리 전용 네온 테두리 — 활동 기반 4 아키타입 (랜딩/기획과 동기)
 * 우선순위: MVP(무지개) → Master+(골드) → Creator(마그마) → Prophet(아크틱)
 */

/** @typedef {'gold_aura' | 'arctic_pulse' | 'magma_flow' | 'luminous_rainbow'} StoryNeonArchetype */

/** URL `?storyNeon=` / `?neonPreview=` 로 정적·캡처 캔버스까지 임시 연출할 때 사용 */
export const STORY_NEON_PREVIEW_IDS = /** @type {const} */ ([
  'gold_aura',
  'arctic_pulse',
  'magma_flow',
  'luminous_rainbow',
])

/**
 * @param {string | null | undefined} raw
 * @returns {StoryNeonArchetype | null}
 */
export function parseStoryNeonPreviewParam(raw) {
  const v = typeof raw === 'string' ? raw.trim() : ''
  if (!v) return null
  return /** @type {StoryNeonArchetype | null} */ (
    STORY_NEON_PREVIEW_IDS.includes(/** @type {StoryNeonArchetype} */ (v)) ? v : null
  )
}

const MVP_OR_CREATOR_WIN_THRESHOLD = 14
const CREATOR_MATCHUPS_THRESHOLD = 22
const PROPHET_VOTES_MIN = 12
const PROPHET_HIT_MIN = 58

/**
 * @param {object} input
 * @param {string} [input.matchupTierId] — getTier().id (player|star|master|vip|goat)
 * @param {number} [input.totalMatchups]
 * @param {number} [input.voteTotal]
 * @param {number} [input.voteHits]
 * @param {number} [input.totalMvp] — 카드에 표시되는 MVP 누적 등
 * @param {number} [input.creatorWins] — DB creator_wins 등 승리 기반 화제성 프록시
 * @returns {StoryNeonArchetype | null}
 */
export function resolveStoryNeonArchetype({
  matchupTierId = 'player',
  totalMatchups = 0,
  voteTotal = 0,
  voteHits = 0,
  totalMvp = 0,
  creatorWins = 0,
} = {}) {
  const tm = Math.max(0, Number(totalMatchups) || 0)
  const vt = Math.max(0, Number(voteTotal) || 0)
  const vh = Math.max(0, Number(voteHits) || 0)
  const mvp = Math.max(0, Number(totalMvp) || 0)
  const cw = Math.max(0, Number(creatorWins) || 0)
  const hitPct = vt > 0 ? (vh / vt) * 100 : 0

  if (Math.max(mvp, cw) >= MVP_OR_CREATOR_WIN_THRESHOLD) return 'luminous_rainbow'
  if (tierAtLeast(matchupTierId, 'master')) return 'gold_aura'
  if (tm >= CREATOR_MATCHUPS_THRESHOLD) return 'magma_flow'
  if (vt >= PROPHET_VOTES_MIN && hitPct >= PROPHET_HIT_MIN) return 'arctic_pulse'
  return null
}

/** @param {StoryNeonArchetype | null} id */
export function storyNeonArchetypeLabelKo(id) {
  if (!id) return null
  const map = {
    gold_aura: '골드 네온 오라',
    arctic_pulse: '아크틱 네온 파동',
    magma_flow: '마그마 네온 플로우',
    luminous_rainbow: '루미너스 무지개',
  }
  return map[id] || null
}
