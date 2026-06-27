/**
 * 매치업 A vs B 합성 썸네일 — 카카오·OG 공유용
 * GET /api/matchup-share-image?matchupId=<uuid>
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { composeMatchupShareImage } = require('../lib/matchupShareComposite.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const matchupId = event.queryStringParameters?.matchupId
  if (!matchupId || !UUID_RE.test(matchupId)) {
    return { statusCode: 400, body: 'Invalid matchupId' }
  }

  const host = event.headers['x-forwarded-host'] || event.headers.host || 'www.victoryspace.net'
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`

  if (!supabaseUrl || !supabaseAnonKey) {
    return { statusCode: 500, body: 'Server configuration error' }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: matchup, error } = await supabase
      .from('matchups')
      .select([
        'id',
        'left_type', 'left_url', 'left_thumbnail_url', 'left_label', 'left_text',
        'right_type', 'right_url', 'right_thumbnail_url', 'right_label', 'right_text',
        'is_complete',
      ].join(', '))
      .eq('id', matchupId)
      .single()

    if (error || !matchup) {
      return { statusCode: 404, body: 'Matchup not found' }
    }

    const buffer = await composeMatchupShareImage(matchup, baseUrl)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    console.error('[matchup-share-image]', err)
    return { statusCode: 500, body: 'Image generation failed' }
  }
}

exports.handler = withIpRateLimit(handler, { scope: 'matchup-share-image', maxRequests: 60 })
