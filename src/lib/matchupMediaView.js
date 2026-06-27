/** 매치업 A/B 측 미디어를 뷰어(크게 보기)로 열 수 있는지 */
export function canOpenMatchupMediaView({ type, url, thumbnail, text } = {}) {
  if (type === 'text') return Boolean(String(text || '').trim())
  if (type === 'image') return Boolean(url || thumbnail)
  if (type === 'video') return Boolean(url || thumbnail)
  return Boolean(url || thumbnail || String(text || '').trim())
}

import { matchupSideBadge } from './matchupContentSide'

/** matchup + side → 뷰어 payload */
export function matchupSideToMedia(matchup, side) {
  const isLeft = side === 'left'
  return {
    side,
    type: isLeft ? matchup.left_type : matchup.right_type,
    url: isLeft ? matchup.left_url : matchup.right_url,
    thumbnail: isLeft ? matchup.left_thumbnail_url : matchup.right_thumbnail_url,
    text: isLeft ? matchup.left_text : matchup.right_text,
    label: matchupSideBadge(side),
  }
}
