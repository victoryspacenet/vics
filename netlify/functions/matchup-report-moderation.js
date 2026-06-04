/**
 * 매치업 챌린저(B) 측 신고 5건 이상 + OpenAI 부적절 판정 시 몰수패 RPC 호출
 * Netlify: OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
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

function buildModerationParts({ title, description, right }) {
  const parts = [
    {
      type: 'text',
      text:
        `아래는 커뮤니티 매치업의 "도전자(B)" 콘텐츠입니다. 다음 기준으로 부적절한지 판단하세요:\n` +
        `- 폭력·혐오·차별·성적 노출·불법·스팸·괴롭힘·욕설 과다·저작권 침해 유도 등\n` +
        `- 경쟁 주제와 무관한 명백한 악의 콘텐츠\n` +
        `JSON 한 객체만 출력: {"inappropriate":true|false,"confidence_0_100":0~100정수,"reason_ko":"한국어 한 문장"}\n\n` +
        `경쟁 제목: ${title || '(없음)'}\n` +
        `설명: ${description || '(없음)'}\n` +
        `B 타입: ${right.type}\n` +
        (right.type === 'text'
          ? `B 텍스트: ${(right.text || '').slice(0, 4000)}\n`
          : `B 미디어 URL: ${right.url || '(없음)'}\n`),
    },
  ]
  if (right.type !== 'text') {
    const img = right.thumb || right.url
    if (isHttpsMediaUrl(img)) {
      parts.push({ type: 'image_url', image_url: { url: img } })
    }
  }
  return parts
}

async function openAiModerateRight({ title, description, right }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_MODERATION_MODEL || 'gpt-4o-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a strict Korean community moderator for a user-vs-user content app. Output JSON only.',
        },
        {
          role: 'user',
          content: buildModerationParts({ title, description, right }),
        },
      ],
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  if (!raw) throw new Error('OpenAI 응답 없음')
  const parsed = JSON.parse(raw)
  const inappropriate = parsed.inappropriate === true
  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence_0_100))))
  if (!Number.isFinite(confidence)) throw new Error('confidence 파싱 실패')
  return {
    inappropriate,
    confidence,
    reason_ko: typeof parsed.reason_ko === 'string' ? parsed.reason_ko : '',
  }
}

exports.handler = withIpRateLimit(async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const authHeader = event.headers.authorization || event.headers.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: '로그인이 필요해요' })
  if (!supabaseUrl || !supabaseAnonKey) return json(500, { error: '서버 설정 오류' })
  if (!serviceRoleKey) return json(503, { error: '서비스 구성이 완료되지 않았어요' })

  let body
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {}
  } catch {
    return json(400, { error: '잘못된 요청이에요' })
  }

  const matchupId = body.matchupId
  if (!matchupId) return json(400, { error: 'matchupId가 필요해요' })

  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: authData, error: authErr } = await anon.auth.getUser(token)
  if (authErr || !authData?.user) return json(401, { error: '세션이 유효하지 않아요' })

  const svc = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const minReports = Math.max(1, Math.min(50, parseInt(process.env.MATCHUP_RIGHT_REPORTS_FORFEIT_MIN || '5', 10)))
  const minConfidence = Math.max(0, Math.min(100, parseInt(process.env.MATCHUP_MODERATION_CONFIDENCE_MIN || '55', 10)))

  const { count: rightReportCount, error: cntErr } = await svc
    .from('matchup_reports')
    .select('id', { count: 'exact', head: true })
    .eq('matchup_id', matchupId)
    .eq('reported_side', 'right')

  if (cntErr) {
    console.error('[matchup-report-moderation] count', cntErr)
    return json(500, { error: '신고 집계에 실패했어요' })
  }

  const rc = rightReportCount ?? 0
  if (rc < minReports) {
    return json(200, { ok: true, penalized: false, rightReportCount: rc, minReports })
  }

  const { data: row, error: rowErr } = await svc
    .from('matchups')
    .select(
      'id, user_id, title, description, is_complete, status, right_user_id, right_type, right_text, right_url, right_thumbnail_url, challenger_forfeit_at',
    )
    .eq('id', matchupId)
    .maybeSingle()

  if (rowErr || !row) return json(404, { error: '매치업을 찾을 수 없어요' })
  if (row.challenger_forfeit_at) {
    return json(200, { ok: true, penalized: false, skipped: true, reason: 'already_forfeited', rightReportCount: rc })
  }
  if (!row.is_complete || !row.right_user_id) {
    return json(200, { ok: true, penalized: false, reason: 'no_challenger', rightReportCount: rc })
  }

  const rightPayload = {
    type: row.right_type,
    text: row.right_text,
    url: row.right_url,
    thumb: row.right_thumbnail_url || row.right_url,
  }

  let ai = null
  try {
    ai = await openAiModerateRight({
      title: row.title,
      description: row.description,
      right: rightPayload,
    })
  } catch (e) {
    console.error('[matchup-report-moderation] OpenAI', e)
    return json(502, { ok: false, error: 'AI 판정을 수행하지 못했어요. 잠시 후 다시 시도해 주세요.' })
  }

  if (!ai) {
    return json(200, {
      ok: true,
      penalized: false,
      rightReportCount: rc,
      reason: 'no_openai_key',
    })
  }

  const shouldForfeit = ai.inappropriate === true && ai.confidence >= minConfidence

  await enqueueMatchupModerationAlert(svc, {
    matchupId,
    alertKind: ai.inappropriate ? 'inappropriate_ai' : 'reports_threshold',
    aiConfidence: ai.confidence,
    aiReasonKo: ai.reason_ko,
    rightReportCount: rc,
    autoActioned: shouldForfeit,
  })

  if (!shouldForfeit) {
    return json(200, {
      ok: true,
      penalized: false,
      rightReportCount: rc,
      ai,
    })
  }

  const reasonLine = [ai.reason_ko, `(AI 확신도 ${ai.confidence}%)`].filter(Boolean).join(' ')
  const { data: rpcData, error: rpcErr } = await svc.rpc('finalize_challenger_forfeit_moderation', {
    p_matchup_id: matchupId,
    p_reason: reasonLine.slice(0, 500),
  })

  if (rpcErr) {
    console.error('[matchup-report-moderation] rpc', rpcErr)
    return json(500, { error: rpcErr.message || '처리에 실패했어요' })
  }

  const payload = rpcData && typeof rpcData === 'object' ? rpcData : {}
  return json(200, {
    ok: true,
    penalized: !!payload.penalized,
    skipped: !!payload.skipped,
    rightReportCount: rc,
    ai,
    rpc: payload,
  })
})
