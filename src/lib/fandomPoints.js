/**
 * 팬덤 포인트(F-Point) — Clap 연동 규정
 * DB 트리거·백필과 동일한 배율을 유지하세요.
 */

/** V-Card 축하(Clap) 1회당 적립 FP */
export const FANDOM_POINTS_PER_CLAP = 5

/**
 * @param {number} totalClaps
 * @returns {number}
 */
export function fandomPointsFromClaps(totalClaps) {
  const n = Math.max(0, Math.floor(Number(totalClaps) || 0))
  return n * FANDOM_POINTS_PER_CLAP
}
