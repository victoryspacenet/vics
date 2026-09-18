import similarityCore from './matchupChallengeSimilarityCore.cjs'

const {
  minChallengeSimilarity,
  scoreChallengeSimilarity,
} = similarityCore

function asLeftSide(matchup) {
  const type = String(matchup?.left_type || 'text').trim() || 'text'
  return {
    type,
    text: matchup?.left_text ?? null,
    url: matchup?.left_url ?? null,
    thumb: matchup?.left_thumbnail_url || matchup?.left_url || null,
  }
}

/**
 * 관전봇 도전은 사람 도전과 같은 유사도 검사를 통과해야 한다.
 * 검사 실패·키 없음·오류면 도전하지 않는다 (fail-closed).
 */
export async function assertBotChallengeSimilarity({ matchup, right, categoryLabel }) {
  if (!matchup?.id || !right?.type) {
    return { ok: false, reason: 'invalid_payload' }
  }
  if (matchup.left_type && right.type !== matchup.left_type) {
    return { ok: false, reason: 'type_mismatch' }
  }

  let scored
  try {
    scored = await scoreChallengeSimilarity({
      title: matchup.title,
      description: matchup.description,
      categoryLabel: categoryLabel || null,
      left: asLeftSide(matchup),
      right,
    })
  } catch (e) {
    const msg = e?.message || String(e)
    if (/incorrect api key|invalid api key|invalid_api_key|openai 401/i.test(msg)) {
      return { ok: false, reason: 'openai_auth', error: msg }
    }
    return { ok: false, reason: 'ai_error', error: msg }
  }

  if (!scored) {
    return { ok: false, reason: 'no_openai_key' }
  }

  const min = minChallengeSimilarity()
  if (scored.similarity < min) {
    return {
      ok: false,
      reason: 'low_similarity',
      similarity: scored.similarity,
      minSimilarity: min,
      reason_ko: scored.reason_ko,
    }
  }

  return {
    ok: true,
    similarity: scored.similarity,
    minSimilarity: min,
    reason_ko: scored.reason_ko,
  }
}
