/**
 * 매치업 작성자(A) 콘텐츠 vs 선택한 카테고리 — 업로드 시 유사도 검사 (OpenAI 멀티모달, 선택)
 * Netlify 환경변수: OPENAI_API_KEY (없으면 스킵 또는 FAIL_OPEN)
 *
 * - 매치업 생성 시점에는 아직 DB row가 없어 클라이언트가 제목·설명·카테고리·A 콘텐츠를 직접 전달합니다.
 * - MATCHUP_CATEGORY_SIMILARITY_OPENAI_TIMEOUT_MS: OpenAI HTTP 타임아웃(ms), 기본 20000
 * - MATCHUP_CATEGORY_SIMILARITY_FAIL_OPEN=1: OpenAI 오류·타임아웃 시 검사 생략(통과)
 * - 멀티모달: 스틸컷 URL만 전달(본문 텍스트에 원본 미디어 URL 비포함)
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { enqueueMatchupModerationAlert } = require('../lib/moderationAlertsCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function json(statusCode, body) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (statusCode !== 204) headers['Content-Type'] = 'application/json'
  return {
    statusCode,
    headers,
    body: statusCode === 204 ? '' : JSON.stringify(body),
  }
}

function isHttpsMediaUrl(u) {
  if (!u || typeof u !== 'string') return false
  try {
    const { protocol, hostname } = new URL(u)
    if (protocol !== 'https:') return false
    if (hostname.endsWith('.supabase.co')) return true
    if (hostname.endsWith('netlify.app')) return true
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    return false
  } catch {
    return false
  }
}

function isLikelyRasterImageUrl(u) {
  if (!u || typeof u !== 'string') return false
  const path = u.split('?')[0].toLowerCase()
  if (/\.(jpe?g|png|webp|gif)(\b|\/|$)/i.test(path)) return true
  if (/\.supabase\.co\/storage\/v1\/object\//i.test(u) && /-poster(\.|$)/i.test(path)) return true
  return false
}

/** image/video side → OpenAI vision에 넣을 스틸컷 URL */
function resolveVisualImageUrl(side) {
  if (!side || side.type === 'text') return null
  const candidates = [side.thumb, side.url].filter(Boolean)
  for (const raw of candidates) {
    if (!isHttpsMediaUrl(raw)) continue
    if (isLikelyRasterImageUrl(raw)) return raw
    if (side.type === 'image' && /\.supabase\.co\/storage\//i.test(raw)) return raw
  }
  return null
}

/** 소재 제한이 없는 자유 주제 카테고리 — 카테고리·콘텐츠 유사도 검사 제외 */
const CATEGORY_SIMILARITY_EXEMPT_IDS = new Set(['eternal_quest'])
const CATEGORY_SIMILARITY_EXEMPT_LABELS = new Set(['영원한 난제'])

function categoryLabelIsExempt(rawLabel) {
  const cleaned = sanitizeCategoryLabel(rawLabel)
  return Boolean(cleaned && CATEGORY_SIMILARITY_EXEMPT_LABELS.has(cleaned))
}

/** 관리자가 자유롭게 카테고리를 추가할 수 있어 라벨은 클라이언트가 전달한 값을 신뢰 (이모지 등 접두어는 제거) */
function sanitizeCategoryLabel(label) {
  if (!label || typeof label !== 'string') return null
  const cleaned = label
    .normalize('NFC')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim()
    .slice(0, 40)
  return cleaned || null
}

/** 카테고리 라벨별 세부 판정 기준 — 관리자가 만든 카테고리 이름과 정확히 일치할 때만 적용 */
function categoryHintKo(categoryLabel) {
  if (categoryLabel === '맛집') {
    return (
      `⚠️ "맛집" 카테고리 세부 기준: 음식(요리) 자체가 아니라 "음식점이라는 공간"이 중심이어야 합니다.\n` +
      `외관·간판·매장 인테리어·좌석·웨이팅 줄·분위기 등 장소를 보여주는 콘텐츠는 높은 점수.\n` +
      `반대로 음식/요리 클로즈업이 화면의 주인공이고 매장 공간이 거의 안 보이면, 그건 "맛식"에 가까우니 낮은 점수(0~30)를 주세요.\n\n`
    )
  }
  if (categoryLabel === '맛식') {
    return (
      `⚠️ "맛식" 카테고리 세부 기준: 음식점이라는 공간이 아니라 "음식(요리) 자체"가 중심이어야 합니다.\n` +
      `플레이팅·요리 클로즈업·먹는 모습·재료 등 음식이 주인공인 콘텐츠는 높은 점수.\n` +
      `반대로 매장 외관·인테리어 등 공간만 보이고 음식이 주인공이 아니면, 그건 "맛집"에 가까우니 낮은 점수(0~30)를 주세요.\n\n`
    )
  }
  return ''
}

function buildUserContentParts({ title, description, categoryLabel, left }) {
  const leftImg = resolveVisualImageUrl(left)

  const parts = [
    {
      type: 'text',
      text:
        `아래는 한국어 매치업 앱 "VICS"에 작성자가 새로 올리는 경쟁 게시물입니다.\n` +
        `작성자가 고른 카테고리와 실제 게시물(제목·설명·콘텐츠)이 같은 주제·분야인지 0~100 정수로 엄격히 평가하세요.\n` +
        `100=카테고리와 완전히 일치하는 주제, 0=카테고리와 전혀 무관한 주제(예: 카테고리는 "맛식"인데 내용은 패션).\n` +
        `이미지/영상이 첨부되면 반드시 시각 내용을 우선해 판단하세요. 텍스트만으로 관대하게 점수를 주지 마세요.\n` +
        `반드시 JSON 한 객체만: {"similarity":정수0~100,"reason_ko":"한국어 한 문장"}\n\n` +
        categoryHintKo(categoryLabel) +
        `선택한 카테고리: ${categoryLabel || '(없음)'}\n` +
        `경쟁 제목: ${title || '(없음)'}\n` +
        `설명: ${description || '(없음)'}\n\n` +
        `콘텐츠 타입: ${left.type}\n` +
        (left.type === 'text'
          ? `콘텐츠 텍스트: ${(left.text || '').slice(0, 4000)}\n`
          : `콘텐츠 미디어: 아래 스틸컷 참고.\n`),
    },
  ]

  if (leftImg) {
    parts.push({ type: 'text', text: '\n[콘텐츠 스틸컷]' })
    parts.push({ type: 'image_url', image_url: { url: leftImg, detail: 'low' } })
  }

  return { parts, leftImg }
}

async function scoreWithOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model =
    process.env.OPENAI_CATEGORY_SIMILARITY_MODEL || process.env.OPENAI_SIMILARITY_MODEL || 'gpt-4o-mini'
  const { title, description, categoryLabel, left } = payload

  const { parts, leftImg } = buildUserContentParts({ title, description, categoryLabel, left })

  if (left.type !== 'text' && !leftImg) {
    throw new Error('콘텐츠 미디어를 분석할 수 없어요')
  }

  const timeoutMsRaw = parseInt(
    process.env.MATCHUP_CATEGORY_SIMILARITY_OPENAI_TIMEOUT_MS ||
      process.env.MATCHUP_SIMILARITY_OPENAI_TIMEOUT_MS ||
      '20000',
    10,
  )
  const timeoutMs = Math.min(90000, Math.max(5000, Number.isFinite(timeoutMsRaw) ? timeoutMsRaw : 20000))
  const ac = new AbortController()
  const kill = setTimeout(() => ac.abort(), timeoutMs)

  let res
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You check whether a Korean matchup app post matches its chosen category. ' +
              'Be strict: unrelated categories or visuals (e.g. category "food" but content is fashion) must score 0-25. ' +
              'Use attached images when present. Output JSON only.',
          },
          { role: 'user', content: parts },
        ],
      }),
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`OpenAI timeout after ${timeoutMs}ms`)
    }
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
  const parsed = JSON.parse(raw)
  const similarity = Math.max(0, Math.min(100, Math.round(Number(parsed.similarity))))
  if (!Number.isFinite(similarity)) throw new Error('유사도 파싱 실패')
  return {
    similarity,
    reason_ko: typeof parsed.reason_ko === 'string' ? parsed.reason_ko : '',
  }
}

exports.handler = withIpRateLimit(async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {})
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const authHeader = event.headers.authorization || event.headers.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return json(401, { error: '로그인이 필요해요' })
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { error: '서버 설정 오류' })
  }

  let body
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {}
  } catch {
    return json(400, { error: '잘못된 요청이에요' })
  }

  const { matchupId, title, description, category, left } = body

  if (!left || !left.type) {
    return json(400, { error: 'left(콘텐츠 타입 포함)가 필요해요' })
  }

  if (left.type === 'text') {
    if (!String(left.text || '').trim()) {
      return json(400, { error: '텍스트를 입력해 주세요' })
    }
  } else if (left.type === 'image' || left.type === 'video') {
    if (!isHttpsMediaUrl(left.url)) {
      return json(400, { error: '업로드된 미디어 URL만 검사할 수 있어요' })
    }
  } else {
    return json(400, { error: '지원하지 않는 콘텐츠 타입이에요' })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData?.user) {
    return json(401, { error: '세션이 유효하지 않아요' })
  }

  // "영원한 난제"는 소재 제한이 없는 자유 주제 카테고리라 카테고리·콘텐츠 유사도 검사 대상에서 제외.
  // (도전자(B) vs A 콘텐츠 유사도 검사는 matchup-challenge-similarity.js에서 그대로 유지됨)
  if (CATEGORY_SIMILARITY_EXEMPT_IDS.has(category) || categoryLabelIsExempt(body.categoryLabel)) {
    return json(200, { ok: true, skipped: false, similarity: 100, exempt: true })
  }

  const minSim = Math.max(
    0,
    Math.min(100, parseInt(process.env.MATCHUP_CATEGORY_SIMILARITY_MIN || '55', 10)),
  )
  const failOpen = String(process.env.MATCHUP_CATEGORY_SIMILARITY_FAIL_OPEN || '').trim() === '1'
  const requireAi = String(process.env.MATCHUP_CATEGORY_SIMILARITY_REQUIRE_AI || '').trim() === '1'

  const categoryLabel = sanitizeCategoryLabel(body.categoryLabel || category)

  const payload = {
    title: title || null,
    description: description || null,
    categoryLabel,
    left: {
      type: left.type,
      text: left.text ?? null,
      url: left.url ?? null,
      thumb: left.thumb ?? left.url ?? null,
    },
  }

  let scored = null
  try {
    scored = await scoreWithOpenAI(payload)
  } catch (e) {
    console.error('[matchup-category-similarity]', e)
    if (requireAi || !failOpen) {
      return json(502, { ok: false, error: '유사도 검사를 수행하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    }
    return json(200, { ok: true, skipped: true, reason: 'ai_error_fail_open' })
  }

  if (!scored) {
    if (requireAi || !failOpen) {
      return json(503, { ok: false, error: 'AI 유사도 검사가 설정되지 않았어요. 관리자에게 문의해 주세요.' })
    }
    return json(200, { ok: true, skipped: true, reason: 'no_openai_key' })
  }

  const ok = scored.similarity >= minSim

  // 생성 시점엔 아직 매치업 row가 없어 alert를 남길 수 없음 — 수정(matchupId 있음)일 때만 모니터링 큐에 적재
  if (!ok && matchupId && serviceRoleKey) {
    const svc = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await enqueueMatchupModerationAlert(svc, {
      matchupId,
      alertKind: 'low_similarity',
      similarityScore: scored.similarity,
      aiReasonKo: scored.reason_ko,
    })
  }

  return json(200, {
    ok,
    skipped: false,
    similarity: scored.similarity,
    minSimilarity: minSim,
    reason_ko: scored.reason_ko,
    message: ok
      ? null
      : `콘텐츠가 선택한 카테고리와의 유사도가 낮아요 (${scored.similarity}점 / 최소 ${minSim}점). ${scored.reason_ko || '카테고리에 맞는 콘텐츠로 다시 올려 주세요.'}`,
  })
})
