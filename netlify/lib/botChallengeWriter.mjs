/**
 * 관전봇 도전글 — 매치업마다 제목·설명·A측을 읽고 반대편 B를 새로 쓴다.
 * 봇 전용 엄격 검사: 같은 구체적 주제 + A와 반대 입장 + A 베끼기 아님.
 * 사람 도전용 느슨한 검사(matchupChallengeSimilarityCore)와는 별개.
 * 쓰기·검사 실패, 키 없음, 오류면 도전하지 않는다 (fail-closed).
 */
const DESC_MAX = 200
const BODY_MAX = 200
const WRITER_TIMEOUT_MS = 9_000
const JUDGE_TIMEOUT_MS = 9_000

function openaiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim()
}

function chatModel() {
  return String(process.env.OPENAI_BOT_CHALLENGE_MODEL || process.env.OPENAI_SIMILARITY_MODEL || 'gpt-4o-mini').trim()
}

export function minBotTopicFit() {
  const n = parseInt(process.env.BOT_CHALLENGE_TOPIC_FIT_MIN || '75', 10)
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 75))
}

function clipChars(s, max) {
  return [...String(s || '').replace(/\s+/g, ' ').trim()].slice(0, max).join('')
}

function isHttpsImage(u) {
  try {
    return new URL(String(u || '')).protocol === 'https:'
  } catch {
    return false
  }
}

function leftImageUrl(matchup) {
  if (matchup?.left_type !== 'image') return null
  const u = matchup.left_thumbnail_url || matchup.left_url
  return isHttpsImage(u) ? u : null
}

async function chatJson({ system, userParts, timeoutMs, temperature }) {
  const key = openaiKey()
  if (!key) return null
  const ac = new AbortController()
  const kill = setTimeout(() => ac.abort(), timeoutMs)
  let res
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: chatModel(),
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userParts },
        ],
      }),
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error(`OpenAI timeout after ${timeoutMs}ms`)
    throw e
  } finally {
    clearTimeout(kill)
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  if (!raw) throw new Error('OpenAI 응답 없음')
  return JSON.parse(raw)
}

function matchupContextText(matchup, categoryLabel) {
  const leftType = matchup?.left_type || 'text'
  return (
    `카테고리: ${categoryLabel || '(없음)'}\n` +
    `제목: ${String(matchup?.title || '').trim() || '(없음)'}\n` +
    `설명: ${String(matchup?.description || '').trim() || '(없음)'}\n` +
    `A 타입: ${leftType}\n` +
    (leftType === 'text'
      ? `A 본문: ${String(matchup?.left_text || '').slice(0, 1500) || '(없음)'}\n`
      : `A 사진: 아래 첨부.\n`)
  )
}

const WRITER_SYSTEM =
  'You write the challenger (B) side of a Korean 1:1 matchup on the app VICS. ' +
  'A is the maker\'s entry. Voters compare A and B on the exact same question, so B must answer the SAME specific topic as the title ' +
  '(same question, same items being compared) and take the OTHER side or offer a clearly different concrete entry. ' +
  'If the title names two options (e.g. "X vs Y", "X임, Y임?"), B defends the option A did not pick. ' +
  'If the title asks for a pick (e.g. which name is prettier), B offers one different concrete answer and says why. ' +
  'Never agree with A, never restate or paraphrase A, never drift to a different subject, never use generic lines that could fit any matchup. ' +
  'Voice: a Korean in their early-to-mid 20s, casual 반말 ending like "~임", "~아님?", confident and a bit provocative, no insults, no hate, no profanity. ' +
  'Mention concrete details from the topic. No hashtags, no emojis. ' +
  'If the topic is about the author\'s private life in a way a stranger should not answer (health, grief, a private family matter beyond a simple pick), ' +
  'or it is impossible to make a sensible opposing entry, return {"skip":true,"reason_ko":"..."}. ' +
  'Otherwise return JSON only: {"skip":false,"description":"B 한줄 주장, 90자 이내","body_text":"B 근거, 120자 이내","image_prompt":"English scene for a photo of B\'s entry, concrete, 1 sentence"}.'

/**
 * @returns {Promise<{ ok: true, description: string, bodyText: string, imagePrompt: string } | { ok: false, reason: string, error?: string }>}
 */
export async function writeBotChallengeCopy({ matchup, categoryLabel }) {
  if (!openaiKey()) return { ok: false, reason: 'no_openai_key' }
  const parts = [{ type: 'text', text: matchupContextText(matchup, categoryLabel) }]
  const img = leftImageUrl(matchup)
  if (img) {
    parts.push({ type: 'text', text: '[A 사진]' })
    parts.push({ type: 'image_url', image_url: { url: img, detail: 'low' } })
  }
  let parsed
  try {
    parsed = await chatJson({ system: WRITER_SYSTEM, userParts: parts, timeoutMs: WRITER_TIMEOUT_MS, temperature: 0.8 })
  } catch (e) {
    return { ok: false, reason: 'ai_error', error: e?.message || String(e) }
  }
  if (!parsed) return { ok: false, reason: 'no_openai_key' }
  if (parsed.skip) return { ok: false, reason: 'writer_skip', error: String(parsed.reason_ko || '') }
  const description = clipChars(parsed.description, DESC_MAX)
  const bodyText = clipChars(parsed.body_text, BODY_MAX)
  if (!description || !bodyText) return { ok: false, reason: 'writer_empty' }
  return {
    ok: true,
    description,
    bodyText,
    imagePrompt: clipChars(parsed.image_prompt, 300),
  }
}

const JUDGE_SYSTEM =
  'You are a strict reviewer for challenger (B) entries written by automated accounts in a Korean matchup app. ' +
  'Real users will read A and B side by side; any mismatch destroys trust. Judge B against the title, description and A. ' +
  'same_topic: B addresses the exact same specific question/items as the title (not just the same broad category). ' +
  'opposes_a: B takes a different side or offers a different concrete entry than A (agreeing with A = false). ' +
  'copies_a: B restates or paraphrases A\'s point. ' +
  'natural: B reads like a real person\'s reply to this post, not a generic line that would fit any matchup. ' +
  'fit: 0-100 overall fit (100 = perfect opposing answer to this exact topic). ' +
  'If B has a photo, the photo must also depict the same topic. ' +
  'Output JSON only: {"same_topic":bool,"opposes_a":bool,"copies_a":bool,"natural":bool,"fit":int,"reason_ko":"한국어 한 문장"}.'

/**
 * @param {{ matchup: object, categoryLabel?: string|null, right: { description: string, bodyText?: string|null, imageUrl?: string|null } }} p
 */
export async function assertBotChallengeTopicFit({ matchup, categoryLabel, right }) {
  if (!openaiKey()) return { ok: false, reason: 'no_openai_key' }
  const parts = [
    {
      type: 'text',
      text:
        matchupContextText(matchup, categoryLabel) +
        `\nB 한줄 주장: ${right?.description || '(없음)'}\n` +
        (right?.bodyText ? `B 근거: ${right.bodyText}\n` : '') +
        (right?.imageUrl ? 'B 사진: 아래 첨부.\n' : ''),
    },
  ]
  const img = leftImageUrl(matchup)
  if (img) {
    parts.push({ type: 'text', text: '[A 사진]' })
    parts.push({ type: 'image_url', image_url: { url: img, detail: 'low' } })
  }
  if (right?.imageUrl && isHttpsImage(right.imageUrl)) {
    parts.push({ type: 'text', text: '[B 사진]' })
    parts.push({ type: 'image_url', image_url: { url: right.imageUrl, detail: 'low' } })
  }
  let parsed
  try {
    parsed = await chatJson({ system: JUDGE_SYSTEM, userParts: parts, timeoutMs: JUDGE_TIMEOUT_MS, temperature: 0 })
  } catch (e) {
    const msg = e?.message || String(e)
    if (/incorrect api key|invalid api key|invalid_api_key|openai 401/i.test(msg)) {
      return { ok: false, reason: 'openai_auth', error: msg }
    }
    return { ok: false, reason: 'ai_error', error: msg }
  }
  if (!parsed) return { ok: false, reason: 'no_openai_key' }
  const fit = Math.max(0, Math.min(100, Math.round(Number(parsed.fit))))
  const min = minBotTopicFit()
  const verdict = {
    fit: Number.isFinite(fit) ? fit : 0,
    minFit: min,
    same_topic: parsed.same_topic === true,
    opposes_a: parsed.opposes_a === true,
    copies_a: parsed.copies_a === true,
    natural: parsed.natural === true,
    reason_ko: typeof parsed.reason_ko === 'string' ? parsed.reason_ko : '',
  }
  const ok = verdict.same_topic && verdict.opposes_a && !verdict.copies_a && verdict.natural && verdict.fit >= min
  return ok ? { ok: true, ...verdict } : { ok: false, reason: 'topic_mismatch', ...verdict }
}

/**
 * 방금 엄격 검사를 통과해 올린 봇 도전은 검수 대상에서 뺀다.
 */
export async function recordPassedBotChallenge(supabase, { matchupId, fit, description, text, url }) {
  try {
    await supabase.from('virtual_bot_challenge_reviews').upsert(
      {
        matchup_id: matchupId,
        result: 'passed_at_create',
        fit: fit ?? null,
        new_right_description: description ?? null,
        new_right_text: text ?? null,
        new_right_url: url ?? null,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: 'matchup_id' },
    )
  } catch {
    /* best-effort */
  }
}

/**
 * 쓰기 → 엄격 검사. 통과한 글만 돌려준다 (최대 attempts회).
 */
export async function composeCheckedBotChallenge({ matchup, categoryLabel, attempts = 1 }) {
  let last = { ok: false, reason: 'not_attempted' }
  for (let i = 0; i < Math.max(1, attempts); i += 1) {
    const copy = await writeBotChallengeCopy({ matchup, categoryLabel })
    if (!copy.ok) return copy
    const fit = await assertBotChallengeTopicFit({
      matchup,
      categoryLabel,
      right: { description: copy.description, bodyText: copy.bodyText },
    })
    if (fit.ok) return { ...copy, fit: fit.fit }
    last = fit
    if (fit.reason !== 'topic_mismatch') return fit
  }
  return last
}
