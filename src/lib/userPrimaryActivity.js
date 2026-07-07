import { mapTiedMaxLabels } from './resolveTiedMaxLabels'

/** @typedef {'voter' | 'creator' | 'sharer'} UserPrimaryActivityType */

export const USER_PRIMARY_ACTIVITY_LABELS = {
  voter: '투표하는 사람',
  creator: '업로드하는 사람',
  sharer: '공유하는 사람',
}

const TYPE_PRIORITY = /** @type {UserPrimaryActivityType[]} */ (['voter', 'creator', 'sharer'])

/**
 * @param {{ voteCount?: number, uploadCount?: number, shareCount?: number }} counts
 * @returns {UserPrimaryActivityType[]}
 */
export function resolvePrimaryActivityTypes({ voteCount = 0, uploadCount = 0, shareCount = 0 } = {}) {
  const { keys } = mapTiedMaxLabels(
    {
      voter: voteCount,
      creator: uploadCount,
      sharer: shareCount,
    },
    TYPE_PRIORITY,
    USER_PRIMARY_ACTIVITY_LABELS,
  )
  return /** @type {UserPrimaryActivityType[]} */ (keys)
}

/**
 * @param {UserPrimaryActivityType | null | undefined} type
 */
export function getPrimaryActivityLabel(type) {
  if (!type) return ''
  return USER_PRIMARY_ACTIVITY_LABELS[type] || ''
}

/**
 * @param {{ voteCount?: number, uploadCount?: number, shareCount?: number }} payload
 */
export function mapPrimaryActivityFromCounts(payload) {
  const { keys, labels, label } = mapTiedMaxLabels(
    {
      voter: payload?.voteCount,
      creator: payload?.uploadCount,
      sharer: payload?.shareCount,
    },
    TYPE_PRIORITY,
    USER_PRIMARY_ACTIVITY_LABELS,
  )
  if (!labels.length) return {}
  return {
    primaryActivityTypes: keys,
    primaryActivityLabels: labels,
    primaryActivityLabel: label,
  }
}
