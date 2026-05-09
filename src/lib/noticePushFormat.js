/**
 * 공지 푸시 알림 메시지 포맷
 * - 말머리: [공지], [이벤트], [업데이트], [당첨자] 카테고리 대괄호 표시
 * - 이모지: 시각적 임팩트로 힙한 브랜드 이미지 유지
 */
const CATEGORY_PREFIX = {
  notice: '[공지]',
  event: '[이벤트]',
  update: '[업데이트]',
  winner: '[당첨자]',
}

const CATEGORY_EMOJI = {
  notice: '📢',
  event: '🎁',
  update: '🛠️',
  winner: '🏆',
}

/** 푸시 메시지 제목 포맷: [카테고리] 이모지 + 제목 */
export function formatPushTitle(category, title) {
  const prefix = CATEGORY_PREFIX[category] || '[공지]'
  const emoji = CATEGORY_EMOJI[category] || '📢'
  const cleanTitle = (title || '').trim()
  if (!cleanTitle) return `${prefix} ${emoji}`
  return `${prefix} ${emoji} ${cleanTitle}`
}

/** 본문에서 푸시용 요약 추출 (60자 내, 이모지 추가) */
export function formatPushBody(content, category = 'event') {
  const tailEmoji = category === 'event' ? ' ⚡' : category === 'update' ? ' 🛠️' : ''
  const plain = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const summary = plain.slice(0, 55) + (plain.length > 55 ? '...' : '')
  return summary + tailEmoji
}
