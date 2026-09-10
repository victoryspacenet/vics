/**
 * 시즌제 유틸 (4개월 단위, supabase_seasons.sql의 interval '4 months'와 맞춤)
 * 시즌 1 시작: 2026-09-10 00:00 KST (관전봇 참여 시점)
 */

/** 시즌 1 시작 (한국시간) */
export const SEASON_1_START = new Date('2026-09-10T00:00:00+09:00')

function addMonths(date, months) {
  const next = new Date(date.getTime())
  next.setMonth(next.getMonth() + months)
  return next
}

/**
 * 현재 시즌 번호 계산 (앱 기준, DB 없이)
 * @param {Date} [now] - 기준 시각
 * @returns {{ number: number, startAt: Date, endAt: Date }}
 */
export function getCurrentSeason(now = new Date()) {
  let number = 1
  let startAt = new Date(SEASON_1_START)
  let endAt = new Date('2027-01-10T00:00:00+09:00')
  const t = now.getTime()
  while (t >= endAt.getTime()) {
    number += 1
    startAt = endAt
    endAt = addMonths(startAt, 4)
  }
  return { number, startAt, endAt }
}

/**
 * 시즌 종료까지 남은 일수
 */
export function getDaysUntilSeasonEnd(now = new Date()) {
  const { endAt } = getCurrentSeason(now)
  const diff = endAt - now
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

/**
 * 정렬용 컬럼 매핑 (전체 vs 시즌)
 */
export const RANK_COLUMNS = {
  all: {
    points: 'points',
    champion_points: 'champion_points',
    oracle_points: 'oracle_points',
    total_votes_received: 'total_votes_received',
    hit_rate: 'hit_rate',
    vote_total: 'vote_total',
    vote_hits: 'vote_hits',
  },
  season: {
    points: 'season_points',
    champion_points: 'season_champion_points',
    oracle_points: 'season_oracle_points',
    total_votes_received: 'season_total_votes_received',
    hit_rate: 'season_hit_rate',
    vote_total: 'season_vote_total',
    vote_hits: 'season_vote_hits',
  },
}

export function getRankColumns(useSeason) {
  return useSeason ? RANK_COLUMNS.season : RANK_COLUMNS.all
}
