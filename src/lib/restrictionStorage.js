/**
 * 이용 제한 정보 (정지 상태)
 * 실제 서비스에서는 Supabase profiles.status, sanctions 테이블 등과 연동
 */

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export function getRestrictionInfo(userId, profile) {
  // TODO: API 연동 시 userId, profile 기반으로 조회
  // 현재는 데모용 mock 데이터
  const now = new Date()
  const endsAt = new Date(now.getTime() + 72 * 60 * 60 * 1000) // 72시간 후
  const startAt = new Date(endsAt.getTime() - 72 * 60 * 60 * 1000)

  return {
    nickname: profile?.nickname || '회원',
    reason: '주제와 맞지 않는 게시물 반복',
    target: '매치업 #992 (피자 vs 신발)',
    startDate: fmtDate(startAt),
    endDate: fmtDate(endsAt),
    endsAt: endsAt.getTime(),
  }
}

export function hasActiveRestriction(profile) {
  // TODO: profiles.status === 'suspended' 또는 별도 sanctions 테이블 조회
  return false
}
