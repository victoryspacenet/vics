/** 관리자 화면에서만 쓰는 관전봇 판별 */

export function isSpectatorBotUser(user) {
  if (!user || typeof user !== 'object') return false
  if (user.is_bot === true || user.isBot === true) return true
  const email = String(user.email || '').trim().toLowerCase()
  if (email.endsWith('@bots.victoryspace.internal')) return true
  return false
}
