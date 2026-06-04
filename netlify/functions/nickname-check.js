/**
 * 닉네임 중복 여부 — 비로그인 가입 단계에서도 정확히 조회 (서비스 롤, RLS 무관)
 *
 * POST /.netlify/functions/nickname-check
 * Body: { nickname: string }
 * Response: { taken: boolean }
 */
'use strict'

const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
    body: JSON.stringify(body),
  }
}

exports.handler = withIpRateLimit(async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: '서버 설정이 부족해요' })
  }

  let body = {}
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {}
  } catch {
    return json(400, { error: '잘못된 요청이에요' })
  }

  const raw = typeof body.nickname === 'string' ? body.nickname : ''
  const nick = raw.trim().slice(0, 32)
  if (!nick) {
    return json(400, { error: 'nickname이 필요해요' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.from('profiles').select('id').eq('nickname', nick).maybeSingle()

  if (error) {
    console.error('[nickname-check]', error)
    return json(500, { error: '조회에 실패했어요' })
  }

  return json(200, { taken: !!data })
})
