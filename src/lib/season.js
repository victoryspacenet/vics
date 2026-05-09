/**
 * 시즌제 유틸 (4개월 단위, supabase_seasons.sql의 interval '4 months'와 맞춤)
 */

const SEASON_DAYS = 120 // 4개월 ≈ 120일 (30일×4, 달력 월과 동기화는 DB 시즌 테이블·cron이 담당)

/**
 * 현재 시즌 번호 계산 (앱 기준, DB 없이)
 * @param {Date} [now] - 기준 시각
 * @returns {{ number: number, startAt: Date, endAt: Date }}
 */
export function getCurrentSeason(now = new Date()) {
  const epoch = new Date('2026-03-01T00:00:00Z') // 시즌 1 시작
  const msPerDay = 24 * 60 * 60 * 1000
  const elapsed = now - epoch
  const daysElapsed = Math.floor(elapsed / msPerDay)
  const number = Math.floor(daysElapsed / SEASON_DAYS) + 1
  const startDays = (number - 1) * SEASON_DAYS
  const startAt = new Date(epoch.getTime() + startDays * msPerDay)
  const endAt = new Date(startAt.getTime() + SEASON_DAYS * msPerDay)
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
    total_votes_received: 'total_votes_received',
    hit_rate: 'hit_rate',
    vote_total: 'vote_total',
    vote_hits: 'vote_hits',
  },
  season: {
    points: 'season_points',
    total_votes_received: 'season_total_votes_received',
    hit_rate: 'season_hit_rate',
    vote_total: 'season_vote_total',
    vote_hits: 'season_vote_hits',
  },
}

export function getRankColumns(useSeason) {
  return useSeason ? RANK_COLUMNS.season : RANK_COLUMNS.all
}
