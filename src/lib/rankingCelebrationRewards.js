/** 랭킹 TOP10 축하 보너스 P — `RankingCelebrationModal` · DB `claim_ranking_celebration_bonus` 와 동기 */
export const RANKING_CELEBRATION_AMOUNTS = {
  rank1: 2000,
  rank2: 1000,
  rank3: 500,
  rank4to10: 100,
}

export function rankingCelebrationAmountForRank(rank) {
  const r = Number(rank)
  if (!Number.isFinite(r) || r < 1) return 0
  if (r === 1) return RANKING_CELEBRATION_AMOUNTS.rank1
  if (r === 2) return RANKING_CELEBRATION_AMOUNTS.rank2
  if (r === 3) return RANKING_CELEBRATION_AMOUNTS.rank3
  if (r <= 10) return RANKING_CELEBRATION_AMOUNTS.rank4to10
  return 0
}
