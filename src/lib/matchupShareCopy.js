/** @typedef {'recruiting' | 'voting' | 'completed'} MatchupSharePhase */

import { buildShareClipText } from './shareClipText'

function isVotePeriodExpired(expiresAt) {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  return Number.isFinite(t) && t <= Date.now()
}

export function isMatchupVotingFinalizedForShare(m) {
  if (!m || m.right_type == null) return false
  if ((m.total_votes || 0) <= 0 && !m.challenger_forfeit_at) return false
  if (m.status !== 'active') return true
  return isVotePeriodExpired(m.expires_at) || !!m.challenger_forfeit_at
}

/** @returns {MatchupSharePhase} */
export function getMatchupSharePhase(matchup) {
  if (!matchup?.right_type && !matchup?.is_complete) return 'recruiting'
  if (isMatchupVotingFinalizedForShare(matchup)) return 'completed'
  return 'voting'
}

/**
 * 카카오·OG·링크 복사용 제목·설명
 * @param {object} [matchup]
 * @param {{ title?: string }} [options]
 */
export function buildMatchupShareCopy(matchup, options = {}) {
  const leftLabel = String(matchup?.left_label || 'A').trim()
  const rightLabel = String(matchup?.right_label || 'B').trim()
  const matchupTitle = String(options.title || matchup?.title || '').trim()
  const phase = getMatchupSharePhase(matchup)

  if (phase === 'recruiting') {
    const ogTitle = matchupTitle ? `${matchupTitle} — 도전자 모집 중` : `${leftLabel} · 도전자 모집 중`
    const ogDescription = matchupTitle
      ? `${matchupTitle} · ${leftLabel} 측 참여 완료 · 도전자(B)를 기다려요. VICS에서 참여해 보세요!`
      : `${leftLabel}의 매치업 · 도전자(B)를 모집 중이에요. VICS에서 도전해 보세요!`
    return {
      phase,
      ogTitle,
      ogDescription,
      clipHeadline: ogTitle,
      clipDesc: `${leftLabel} 측 참여 완료 · 도전자(B)를 기다려요 · VICS`,
    }
  }

  if (phase === 'completed') {
    const ogTitle = matchupTitle ? `${matchupTitle} — 투표 완료` : `${leftLabel} vs ${rightLabel} · 투표 완료`
    const ogDescription = matchupTitle
      ? `${matchupTitle} · ${leftLabel} vs ${rightLabel} — 투표가 마감됐어요. VICS에서 결과를 확인해 보세요!`
      : `${leftLabel} vs ${rightLabel} 대결 · 투표 마감! VICS에서 결과를 확인해 보세요.`
    return {
      phase,
      ogTitle,
      ogDescription,
      clipHeadline: ogTitle,
      clipDesc: `${leftLabel} vs ${rightLabel} · 투표 완료 · 결과 확인 · VICS`,
    }
  }

  const ogTitle = matchupTitle ? `${matchupTitle} — 투표 진행 중` : `${leftLabel} vs ${rightLabel} · 투표 진행 중!`
  const ogDescription = matchupTitle
    ? `${matchupTitle} · ${leftLabel} vs ${rightLabel} — 지금 VICS에서 투표해 보세요!`
    : `${leftLabel} vs ${rightLabel} 대결! 어느 쪽에 투표할까요? VICS에서 참여해 보세요.`
  return {
    phase,
    ogTitle,
    ogDescription,
    clipHeadline: ogTitle,
    clipDesc: `${leftLabel} vs ${rightLabel} · 지금 투표 진행 중 · VICS`,
  }
}

/** 카톡·클립보드용 — 텍스트형 매치업 본문 미리보기 */
export function getMatchupShareTextPreview(matchup, { maxLen = 100 } = {}) {
  if (!matchup) return ''
  const parts = []
  const trim = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const clip = (s) => {
    const t = trim(s)
    if (!t) return ''
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t
  }
  if (matchup.left_type === 'text') {
    const body = clip(matchup.left_text)
    if (body) parts.push(`📝 ${trim(matchup.left_label) || 'A'}: ${body}`)
  }
  if (matchup.right_type === 'text') {
    const body = clip(matchup.right_text)
    if (body) parts.push(`📝 ${trim(matchup.right_label) || 'B'}: ${body}`)
  }
  return parts.join('\n')
}

/** OG description — 텍스트형 본문을 한 줄로 이어 붙임 */
export function buildMatchupShareOgDescription(matchup, baseDescription) {
  const preview = getMatchupShareTextPreview(matchup, { maxLen: 80 })
  if (!preview) return baseDescription
  return `${baseDescription} · ${preview.replace(/\n/g, ' · ')}`
}

/** 링크 복사·카톡 붙여넣기용 — 제목 + 설명 + (텍스트형 본문) + 빈 줄 + URL */
export function buildMatchupShareClipText({ matchup, url } = {}) {
  if (!url) return ''
  if (!matchup) return url
  const { clipHeadline, clipDesc } = buildMatchupShareCopy(matchup)
  return buildShareClipText({
    headline: clipHeadline,
    description: clipDesc,
    body: getMatchupShareTextPreview(matchup),
    url,
  })
}
