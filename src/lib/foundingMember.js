/** 창립 멤버(Founding Member) — 가입 순 1~1,000번 */

export const FOUNDING_MEMBER_CAP = 1000

/**
 * @param {{ founding_member_number?: number | null } | null | undefined} profile
 */
export function getFoundingMemberNumber(profile) {
  const n = Number(profile?.founding_member_number)
  if (!Number.isFinite(n) || n < 1 || n > FOUNDING_MEMBER_CAP) return null
  return Math.trunc(n)
}

/**
 * @param {{ founding_member_number?: number | null } | null | undefined} profile
 */
export function isFoundingMember(profile) {
  return getFoundingMemberNumber(profile) != null
}

/**
 * @param {number | null | undefined} n
 */
export function formatFoundingMemberTitle(n) {
  if (n == null) return ''
  return `창립 멤버 (Founding Member) #${n.toLocaleString('ko-KR')} / ${FOUNDING_MEMBER_CAP.toLocaleString('ko-KR')}`
}

/**
 * @param {{ founding_member_number?: number | null } | null | undefined} profile
 */
export function foundingMemberTooltip(profile) {
  const n = getFoundingMemberNumber(profile)
  return n != null ? formatFoundingMemberTitle(n) : ''
}
