/**
 * 화면용 투표 수 Display Offset.
 * DB·정산은 실제 표(+봇 표)를 쓰고, UI 숫자·막대·비율은 같은 표시값으로 맞춘다.
 *
 * shownTotal = max(30, raw * 5 + offset(matchupId))
 * 좌/우 분할은 실제 비율을 따르되, 한쪽이 0표(100:0)이면 90:10으로 누그러뜨린다.
 */

export const VOTE_DISPLAY_MULTIPLIER = 5
export const VOTE_DISPLAY_MIN = 30
/** 한쪽에만 표가 있을 때 소수 측 최소 비율 */
export const VOTE_DISPLAY_EXTREME_MINOR = 0.1

const OFFSET_MIN = 8
const OFFSET_SPAN = 19 // 8 ~ 26

function hashSeed(value) {
  const str = String(value ?? '')
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 매치업마다 고정되는 랜덤 오프셋 (8~26) */
export function voteDisplayOffset(matchupId) {
  return OFFSET_MIN + (hashSeed(matchupId) % OFFSET_SPAN)
}

function rawVoteInt(value) {
  const n = Math.floor(Number(value) || 0)
  return n > 0 ? n : 0
}

function percentsFromCounts(left, right) {
  const total = left + right
  if (total <= 0) return { leftPct: 50, rightPct: 50 }
  const leftPct = Math.round((left / total) * 100)
  return { leftPct, rightPct: 100 - leftPct }
}

/**
 * 실제 좌/우 표 → 표시용 좌측 비율 (0~1).
 * 0:100 / 100:0 은 10:90 / 90:10. 양쪽 다 있으면 실제 비율.
 */
export function displayLeftShare(leftRaw, rightRaw) {
  const left = rawVoteInt(leftRaw)
  const right = rawVoteInt(rightRaw)
  const rawTotal = left + right
  if (rawTotal <= 0) return null
  if (left === 0) return VOTE_DISPLAY_EXTREME_MINOR
  if (right === 0) return 1 - VOTE_DISPLAY_EXTREME_MINOR
  return left / rawTotal
}

/**
 * @param {number} rawTotal 실제 투표 수 (봇 표 포함 DB 합)
 * @param {string} [matchupId]
 */
export function displayVoteTotal(rawTotal, matchupId) {
  const raw = rawVoteInt(rawTotal)
  const offset = voteDisplayOffset(matchupId)
  if (raw <= 0) {
    return VOTE_DISPLAY_MIN + (offset % 12)
  }
  return Math.max(VOTE_DISPLAY_MIN, raw * VOTE_DISPLAY_MULTIPLIER + offset)
}

/**
 * @param {{ id?: string, left_votes?: number, right_votes?: number, total_votes?: number }} matchup
 * @returns {{ left: number, right: number, total: number, leftPct: number, rightPct: number }}
 */
export function displayVoteCounts(matchup) {
  const id = matchup?.id
  const leftRaw = rawVoteInt(matchup?.left_votes)
  const rightRaw = rawVoteInt(matchup?.right_votes)
  const rawTotal = Math.max(leftRaw + rightRaw, rawVoteInt(matchup?.total_votes))
  const total = displayVoteTotal(rawTotal, id)

  let leftShare = displayLeftShare(leftRaw, rightRaw)
  if (leftShare == null) {
    leftShare = 0.45 + (voteDisplayOffset(id) % 11) / 100
  }

  const left = Math.round(total * leftShare)
  const right = total - left
  const { leftPct, rightPct } = percentsFromCounts(left, right)
  return { left, right, total, leftPct, rightPct }
}

/** 막대·퍼센트 표시용. calcPercent(실제표) 대신 사용 */
export function displayVotePercents(matchup) {
  const { leftPct, rightPct } = displayVoteCounts(matchup)
  return { left: leftPct, right: rightPct }
}
