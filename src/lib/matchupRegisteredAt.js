/**
 * 매치업 「등록일」 표시·정렬용 ISO 시각
 * - A만 등록(도전자 대기): created_at
 * - B 최종 등록 완료: challenger_joined_at (레거시: updated_at → created_at)
 */
export function getMatchupRegisteredAtIso(matchup) {
  if (!matchup) return null

  const hasChallenger = matchup.right_type != null || matchup.is_complete === true
  if (hasChallenger) {
    return matchup.challenger_joined_at || matchup.updated_at || matchup.created_at || null
  }

  return matchup.created_at || null
}

/** @param {object} matchup @param {(iso: string) => string} formatFn */
export function formatMatchupRegisteredAt(matchup, formatFn) {
  const iso = getMatchupRegisteredAtIso(matchup)
  if (!iso || typeof formatFn !== 'function') return ''
  return formatFn(iso)
}
