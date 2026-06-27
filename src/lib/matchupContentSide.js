/** 이미지·영상·텍스트 콘텐츠 영역 표시용 — 닉네임(left_label/right_label) 대신 A/B만 */
export function matchupSideBadge(side) {
  return side === 'right' ? 'B' : 'A'
}
