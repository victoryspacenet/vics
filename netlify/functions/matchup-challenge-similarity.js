/**
 * 도전자(B) 콘텐츠 vs 매치업 메이커(A) 콘텐츠 — 주제·톤 유사도 (OpenAI 멀티모달, 선택)
 * Netlify 환경변수: OPENAI_API_KEY (없으면 스킵 또는 FAIL_OPEN)
 *
 * - MATCHUP_SIMILARITY_OPENAI_TIMEOUT_MS: OpenAI HTTP 타임아웃(ms), 기본 20000
 * - MATCHUP_SIMILARITY_FAIL_OPEN=1: OpenAI 오류·타임아웃 시 검사 생략(통과)
 * - 멀티모달: 스틸컷 URL만 전달(본문 텍스트에 원본 미디어 URL 비포함)
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { enqueueMatchupModerationAlert } = require('../lib/moderationAlertsCore.cjs')
const {
  isHttpsMediaUrl,
  formatCategoryLabel,
  sanitizeCategoryLabel,
  minChallengeSimilarity,
  scoreChallengeSimilarity,
} = require('../lib/matchupChallengeSimilarityCore.cjs')

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

  const { matchupId, mode, title, description, right } = body

  if (!matchupId || !right || !right.type) {
    return json(400, { error: 'matchupId와 right(타입 포함)가 필요해요' })
  }

  if (right.type === 'text') {
    if (!String(right.text || '').trim()) {
      return json(400, { error: '텍스트를 입력해 주세요' })
    }
  } else if (right.type === 'image' || right.type === 'video') {
    if (!isHttpsMediaUrl(right.url)) {
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
  const uid = authData.user.id

  const { data: row, error: rowErr } = await supabase
    .from('matchups')
    .select(
      'id, user_id, title, description, category, left_type, left_text, left_url, left_thumbnail_url, right_user_id',
    )
    .eq('id', matchupId)
    .maybeSingle()

  if (rowErr || !row) {
    return json(404, { error: '매치업을 찾을 수 없어요' })
  }

  if (row.left_type && right.type !== row.left_type) {
    return json(400, {
      ok: false,
      error: 'A측과 B측 콘텐츠 형식(이미지·영상·텍스트)이 같아야 해요.',
    })
  }

  const isEdit = mode === 'edit'
  if (isEdit) {
    if (String(row.right_user_id || '') !== String(uid)) {
      return json(403, { error: '도전자만 수정할 수 있어요' })
    }
  } else {
    if (String(row.user_id) === String(uid)) {
      return json(403, { error: '본인이 연 매치업에는 도전할 수 없어요' })
    }
  }

  const minSim = minChallengeSimilarity()
  const failOpen = String(process.env.MATCHUP_SIMILARITY_FAIL_OPEN || '').trim() === '1'
  const requireAi = String(process.env.MATCHUP_SIMILARITY_REQUIRE_AI || '').trim() === '1'

  // 관리자가 자유롭게 추가한 카테고리(예: cat_wpxy=맛집)는 고정 맵에 없으므로,
  // 클라이언트가 전달한 표시 라벨을 우선 신뢰하고, 없을 때만 고정 맵/원본 id로 폴백.
  const categoryLabel =
    sanitizeCategoryLabel(body.categoryLabel) || formatCategoryLabel(body.category || row.category)

  const payload = {
    title: title || row.title,
    description: description || row.description,
    categoryLabel,
    left: {
      type: row.left_type,
      text: row.left_text,
      url: row.left_url,
      thumb: row.left_thumbnail_url || row.left_url,
    },
    right: {
      type: right.type,
      text: right.text ?? null,
      url: right.url ?? null,
      thumb: right.thumb ?? right.url ?? null,
    },
  }

  let scored = null
  try {
    scored = await scoreChallengeSimilarity(payload)
  } catch (e) {
    console.error('[matchup-challenge-similarity]', e)
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

  if (!ok && serviceRoleKey) {
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
      : `도전 콘텐츠가 경쟁 주제와의 유사도가 낮아요 (${scored.similarity}점 / 최소 ${minSim}점). ${scored.reason_ko || '주제에 맞는 콘텐츠로 다시 올려 주세요.'}`,
  })
})
