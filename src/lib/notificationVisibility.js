import { canAccessAdmin, useCanAccessAdmin } from './adminAuth'

/** 매치업 작성자에게 투표자 닉네임을 보여주는 알림. 일반 유저에게는 숨김. */
export const VOTE_ROSTER_NOTIFICATION_TYPE = 'vote'

export function viewerCanSeeVoteRoster(user) {
  return canAccessAdmin(user)
}

export function filterVoteRosterNotifications(list, canSeeRoster) {
  const rows = Array.isArray(list) ? list : []
  if (canSeeRoster) return rows
  return rows.filter((row) => row?.type !== VOTE_ROSTER_NOTIFICATION_TYPE)
}

export function unreadVisibleNotificationCount(list, canSeeRoster) {
  return filterVoteRosterNotifications(list, canSeeRoster).filter((row) => !row?.is_read).length
}

export function useCanSeeVoteRosterNotifications() {
  return useCanAccessAdmin()
}
