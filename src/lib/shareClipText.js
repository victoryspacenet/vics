/** 카톡 붙여넣기용 — 제목 + 설명 + (본문) + 빈 줄 + URL (매치업 상세와 동일 형식) */
export function buildShareClipText({ headline = '', description = '', body = '', url = '' } = {}) {
  if (!url) return ''
  const lines = [headline, description, body]
    .map((line) => (line == null ? '' : String(line).trim()))
    .filter(Boolean)
  if (lines.length === 0) return url
  return [...lines, '', url].join('\n')
}

export const SHARE_CLIP_KAKAO_TOAST =
  '제목·설명·링크를 복사했어요. 카톡에 붙이면 글과 미리보기가 함께 뜹니다'

export const SHARE_CLIP_KAKAO_MATCHUP_TOAST =
  '제목·설명·링크를 복사했어요. 카톡에 붙이면 글과 VS 썸네일 미리보기가 함께 뜹니다'
