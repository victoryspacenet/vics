import {
  POINTS_CREATOR_DRAW,
  POINTS_CREATOR_LOSE,
  POINTS_CREATOR_WIN,
  POINTS_VOTER_DRAW,
  POINTS_VOTER_HIT,
  POINTS_VOTER_MISS,
} from './pointRewards'

/** @typedef {'left'|'right'|'draw'} MatchupWinner */

/** 투표 마감·결과 확정 여부 */
export function isVotePeriodExpired(expiresAt) {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  return Number.isFinite(t) && t <= Date.now()
}

export function isMatchupVotingFinalized(m) {
  if (!m || m.right_type == null) return false
  if ((m.total_votes || 0) <= 0 && !m.challenger_forfeit_at) return false
  if (m.status !== 'active') return true
  return isVotePeriodExpired(m.expires_at) || !!m.challenger_forfeit_at
}

/** @returns {MatchupWinner|null} */
export function getMatchupWinner(m) {
  if (!m) return null
  if (m.challenger_forfeit_at) return 'left'
  const lv = m.left_votes || 0
  const rv = m.right_votes || 0
  if (lv === rv) return 'draw'
  return lv > rv ? 'left' : 'right'
}

/** Creator(Champion) — LEFT·RIGHT 각자 본인 측 기준 (서비스 소개·DB 정산과 동일) */
export function getCreatorResultPoints(m, side) {
  const winner = getMatchupWinner(m)
  if (!winner) return 0
  if (winner === 'draw') return POINTS_CREATOR_DRAW
  return winner === side ? POINTS_CREATOR_WIN : POINTS_CREATOR_LOSE
}

/** Voter(Oracle) — 투표 측 기준 */
export function getVoterResultPoints(m, side) {
  const winner = getMatchupWinner(m)
  if (!winner) return 0
  if (winner === 'draw') return POINTS_VOTER_DRAW
  return winner === side ? POINTS_VOTER_HIT : POINTS_VOTER_MISS
}

export function isChampionSideWin(m, side) {
  if (!isMatchupVotingFinalized(m)) return false
  const winner = getMatchupWinner(m)
  return winner != null && winner !== 'draw' && winner === side
}

/** 내가 만든/도전 참여 매치업 1건 — Champion 결과 분석 */
export function analyzeChampionMatchup(m, mySide = 'left') {
  if (!m) return null
  const hasVotes = (m.total_votes || 0) > 0 || !!m.challenger_forfeit_at
  const winner = getMatchupWinner(m)
  const isEnded = isMatchupVotingFinalized(m)
  const isLive = m.status === 'active' && m.right_type != null && !isEnded
  const isWaiting = m.status === 'active' && m.right_type == null
  const isDraw = winner === 'draw'
  const myWin = isEnded && hasVotes && !isDraw && winner === mySide
  const myLose = isEnded && hasVotes && !isDraw && winner != null && winner !== mySide
  const pointsEarned =
    isEnded && hasVotes ? getCreatorResultPoints(m, mySide) : 0

  return {
    m,
    isEnded,
    isLive,
    isWaiting,
    hasVotes,
    isDraw,
    winner,
    myWin,
    myLose,
    myDraw: isEnded && hasVotes && isDraw,
    pointsEarned,
  }
}

/** 투표 1건 — Oracle 결과 분석 */
export function analyzeVotedMatchupEntry(v) {
  const m = v?.matchups
  if (!m) return null
  const hasVotes = (m.total_votes || 0) > 0
  const winner = getMatchupWinner(m)
  const isEnded = isMatchupVotingFinalized(m)
  const isLive = m.status === 'active' && m.right_type != null && !isEnded
  const isWaiting = m.status === 'active' && m.right_type == null
  const isDraw = winner === 'draw'
  const myWin = isEnded && hasVotes && !isDraw && winner === v.side
  const myLose = isEnded && hasVotes && !isDraw && winner != null && winner !== v.side
  const pointsEarned =
    isEnded && hasVotes ? getVoterResultPoints(m, v.side) : 0

  return {
    m,
    isEnded,
    isLive,
    isWaiting,
    hasVotes,
    isDraw,
    winner,
    myWin,
    myLose,
    myDraw: isEnded && hasVotes && isDraw,
    pointsEarned,
  }
}
