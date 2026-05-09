/**
 * 대표 배지 ID → 이모지/메타 (프로필 편집·랭킹·매치업 카드 공통)
 * 레거시 level_1~7은 예전 레벨 배지 선택값 표시용으로 유지합니다.
 */
import { LEVELS, getLevel } from './utils'

/** '얼리어답터': 이 시점 이전 가입분만 (제품 일정에 맞게 조정) */
const EARLY_BADGE_CUTOFF_ISO = '2026-09-01T00:00:00+09:00'
/** '트렌드세터': 생성 매치업에 받은 누적 투표 수 기준 (핫 1위 대체 지표) */
const TRENDING_MIN_VOTES_RECEIVED = 100

export const ACTIVITY_BADGES = [
  { id: 'creator_1', emoji: '🎨', name: '크리에이터', desc: '첫 매치업 생성' },
  { id: 'voter_10', emoji: '🗳️', name: '투표 마니아', desc: '10회 투표 완료' },
  { id: 'voter_100', emoji: '⚡', name: '투표 전문가', desc: '100회 투표 완료' },
  { id: 'level_3', emoji: '🔥', name: '투사', desc: '레벨 3 달성' },
  { id: 'level_4', emoji: '⚔️', name: '전사', desc: '레벨 4 달성' },
  { id: 'win_10', emoji: '🎯', name: '안목 마스터', desc: '10번 연속 정답' },
  { id: 'trending', emoji: '🔥', name: '트렌드세터', desc: '핫 매치업 1위 달성' },
  { id: 'social', emoji: '🤝', name: '소셜 버터플라이', desc: '댓글 50개 작성' },
  { id: 'early', emoji: '🌟', name: '얼리어답터', desc: '초기 가입자' },
  { id: 'comeback', emoji: '💪', name: '불굴의 투지', desc: '패배 후 10회 재도전' },
]

const LEGACY_LEVEL_BADGES = LEVELS.map((lv) => ({
  id: `level_${lv.level}`,
  emoji: lv.emoji,
  name: lv.name,
  desc: `레벨 ${lv.level} 달성`,
}))

const BY_ID = new Map()
for (const b of LEGACY_LEVEL_BADGES) BY_ID.set(b.id, b)
for (const b of ACTIVITY_BADGES) BY_ID.set(b.id, { ...BY_ID.get(b.id), ...b })

export function getFeaturedBadgeMeta(badgeId) {
  if (!badgeId || typeof badgeId !== 'string') return null
  return BY_ID.get(badgeId) ?? null
}

export function getFeaturedBadgeEmoji(badgeId) {
  return getFeaturedBadgeMeta(badgeId)?.emoji ?? null
}

/**
 * 활동 배지 획득 여부 (프로필 통계 + 선택적 extras).
 * @param {object} profile - Supabase profiles 행
 * @param {{ commentCount?: number }} [extras] - DB에 없는 값 (예: 댓글 수)
 */
export function isActivityBadgeEarned(badgeId, profile, extras = {}) {
  if (!badgeId || typeof badgeId !== 'string' || !profile) return false
  const p = profile
  const pts = Number(p.points) || 0
  const lv = getLevel(pts).level
  const commentCount = Number(extras.commentCount) || 0

  switch (badgeId) {
    case 'creator_1':
      return (Number(p.total_matchups) || 0) >= 1
    case 'voter_10':
      return (Number(p.vote_total) || 0) >= 10
    case 'voter_100':
      return (Number(p.vote_total) || 0) >= 100
    case 'level_3':
      return lv >= 3
    case 'level_4':
      return lv >= 4
    case 'win_10':
      return (Number(p.vote_hits) || 0) >= 10
    case 'trending':
      return (Number(p.total_votes_received) || 0) >= TRENDING_MIN_VOTES_RECEIVED
    case 'social':
      return commentCount >= 50
    case 'early':
      if (!p.created_at) return false
      return new Date(p.created_at) < new Date(EARLY_BADGE_CUTOFF_ISO)
    case 'comeback':
      return false
    default:
      return false
  }
}
