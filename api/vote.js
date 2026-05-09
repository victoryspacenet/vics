/**
 * 투표 API - 동일 IP/기기 무한 투표 방지
 * 서버에서 클라이언트 IP를 추출해 votes.ip_address에 저장
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

function getHeader(req, name) {
  const h = req.headers
  return h?.get?.(name) ?? h?.[name] ?? h?.[name.toLowerCase()]
}

function getClientIp(req) {
  const forwarded = getHeader(req, 'x-forwarded-for') || getHeader(req, 'x-real-ip')
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return getHeader(req, 'cf-connecting-ip') || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = getHeader(req, 'authorization') || getHeader(req, 'Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(401).json({ error: '로그인이 필요해요' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  } catch {
    return res.status(400).json({ error: '잘못된 요청이에요' })
  }

  const { matchup_id, side } = body
  if (!matchup_id || !['left', 'right'].includes(side)) {
    return res.status(400).json({ error: 'matchup_id와 side(left/right)가 필요해요' })
  }

  const clientIp = getClientIp(req) || 'unknown'

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: '로그인이 필요해요' })
  }

  const { error } = await supabase
    .from('votes')
    .insert({ user_id: user.id, matchup_id, side, ip_address: clientIp })

  if (error) {
    if (error.message?.includes('VOTE_IP_LIMIT') || error.code === 'P0001') {
      return res.status(429).json({
        error: '이 기기/네트워크에서 해당 매치업에 대한 투표 한도를 초과했어요 (최대 3표)',
        code: 'VOTE_IP_LIMIT',
      })
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: '이미 투표했어요' })
    }
    console.error('[vote API]', error)
    return res.status(500).json({ error: '투표 중 오류가 발생했어요' })
  }

  return res.status(200).json({ ok: true })
}
