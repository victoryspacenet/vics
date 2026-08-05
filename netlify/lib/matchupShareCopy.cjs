/**
 * 카카오·OG·링크 복사용 — 매치업 상태별 문구 (Netlify)
 */

function isVotePeriodExpired(expiresAt) {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  return Number.isFinite(t) && t <= Date.now()
}

function isMatchupVotingFinalizedForShare(m) {
  if (!m || m.right_type == null) return false
  if ((m.total_votes || 0) <= 0 && !m.challenger_forfeit_at) return false
  if (m.status !== 'active') return true
  return isVotePeriodExpired(m.expires_at) || !!m.challenger_forfeit_at
}

function getMatchupSharePhase(matchup) {
  if (!matchup?.right_type && !matchup?.is_complete) return 'recruiting'
  if (isMatchupVotingFinalizedForShare(matchup)) return 'completed'
  return 'voting'
}

function buildMatchupShareCopy(matchup, options = {}) {
  const leftLabel = String(matchup?.left_label || 'A').trim()
  const rightLabel = String(matchup?.right_label || 'B').trim()
  const matchupTitle = String(options.title || matchup?.title || '').trim()
  const phase = getMatchupSharePhase(matchup)

  if (phase === 'recruiting') {
    const ogTitle = matchupTitle ? `${matchupTitle} — 도전자 모집 중` : `${leftLabel} · 도전자 모집 중`
    const ogDescription = matchupTitle
      ? `${matchupTitle} · ${leftLabel} 측 참여 완료 · 도전자(B)를 기다려요. VICS에서 참여해 보세요!`
      : `${leftLabel}의 매치업 · 도전자(B)를 모집 중이에요. VICS에서 도전해 보세요!`
    return { phase, ogTitle, ogDescription }
  }

  if (phase === 'completed') {
    const ogTitle = matchupTitle ? `${matchupTitle} — 투표 완료` : `${leftLabel} vs ${rightLabel} · 투표 완료`
    const ogDescription = matchupTitle
      ? `${matchupTitle} · ${leftLabel} vs ${rightLabel} — 투표가 마감됐어요. VICS에서 결과를 확인해 보세요!`
      : `${leftLabel} vs ${rightLabel} 대결 · 투표 마감! VICS에서 결과를 확인해 보세요.`
    return { phase, ogTitle, ogDescription }
  }

  const ogTitle = matchupTitle ? `${matchupTitle} — 투표 진행 중` : `${leftLabel} vs ${rightLabel} · 투표 진행 중!`
  const ogDescription = matchupTitle
    ? `${matchupTitle} · ${leftLabel} vs ${rightLabel} — 지금 VICS에서 투표해 보세요!`
    : `${leftLabel} vs ${rightLabel} 대결! 어느 쪽에 투표할까요? VICS에서 참여해 보세요.`
  return { phase, ogTitle, ogDescription }
}

/** 카톡·OG용 — 텍스트형 매치업 본문 미리보기 */
function getMatchupShareTextPreview(matchup, { maxLen = 100 } = {}) {
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
    if (body) parts.push(`${trim(matchup.left_label) || 'A'}: ${body}`)
  }
  if (matchup.right_type === 'text') {
    const body = clip(matchup.right_text)
    if (body) parts.push(`${trim(matchup.right_label) || 'B'}: ${body}`)
  }
  return parts.join(' · ')
}

function buildMatchupShareOgDescription(matchup, baseDescription) {
  const preview = getMatchupShareTextPreview(matchup, { maxLen: 80 })
  if (!preview) return baseDescription
  return `${baseDescription} · ${preview}`
}

module.exports = {
  getMatchupSharePhase,
  buildMatchupShareCopy,
  getMatchupShareTextPreview,
  buildMatchupShareOgDescription,
}
