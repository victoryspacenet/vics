/**
 * 관전봇 매치업 이미지 (OpenAI Images → matchup-media)
 * 생성: 왼쪽 주제 이미지. 도전: A측이 이미지일 때 오른쪽 이미지를 새로 만듦.
 * 회원 미디어는 재사용하지 않음. 실패 시 생성은 텍스트 유지, 이미지 도전은 슬롯을 되돌림.
 */
import { mapBotChallengeCategoryKey } from './botChallengeCopy.mjs'

const BUCKET = 'matchup-media'
const IMAGE_TIMEOUT_MS = 22_000
export const PHASE_BUDGET_MS = 50_000
const SAFETY =
  'Candid photorealistic smartphone photo of everyday Korean life, one or two people in their early-to-mid 20s with natural faces, ordinary clothes, not celebrities, not posed influencer studio, no readable text, no logos, no watermark, square composition.'

function openaiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim()
}

function imageModel() {
  return String(process.env.OPENAI_IMAGE_MODEL || 'dall-e-3').trim() || 'dall-e-3'
}

async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function generatePngBytes(scenePrompt) {
  const key = openaiKey()
  if (!key) return null
  const prompt = `${String(scenePrompt || '').trim()}. ${SAFETY}`
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/images/generations',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: imageModel(),
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    },
    IMAGE_TIMEOUT_MS,
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error?.message || `openai images ${res.status}`)
  }
  const b64 = json?.data?.[0]?.b64_json
  if (b64) return Buffer.from(b64, 'base64')
  const url = json?.data?.[0]?.url
  if (!url) throw new Error('openai images empty')
  const imgRes = await fetchWithTimeout(url, {}, IMAGE_TIMEOUT_MS)
  if (!imgRes.ok) throw new Error(`openai image url ${imgRes.status}`)
  return Buffer.from(await imgRes.arrayBuffer())
}

async function uploadBotPng(supabase, objectPath, bytes) {
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: 'image/png',
    upsert: true,
    cacheControl: '3600',
  })
  if (upErr) throw new Error(upErr.message)
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
  const publicUrl = pub?.publicUrl
  if (!publicUrl) throw new Error('public url missing')
  return publicUrl
}

function challengeScenePrompt({ title, category, description }) {
  const topic = String(title || 'this matchup').replace(/\s+/g, ' ').trim().slice(0, 80)
  const vibe = String(description || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const key = mapBotChallengeCategoryKey(category)
  const setting =
    key === 'fashion'
      ? 'street style and clothes in Seoul'
      : key === '맛집'
        ? 'a restaurant or neighborhood food spot in Korea'
        : key === '맛식'
          ? 'a close food moment at a Korean table'
          : 'everyday Korean life, dating or lifestyle'
  return `Opposing viewpoint photo about "${topic}". ${vibe}. Scene: ${setting}`
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} createdIds
 * @param {{ started?: number }} [opts]
 */
export async function attachBotMatchupImages(supabase, createdIds, opts = {}) {
  const ids = (createdIds || []).map((id) => String(id || '').trim()).filter(Boolean)
  if (!ids.length || !openaiKey()) {
    return { attempted: 0, attached: 0, skipped: ids.length ? 'no_openai_key' : 'none' }
  }

  const started = opts.started || Date.now()
  let attached = 0
  let attempted = 0
  const errors = []

  for (const id of ids) {
    if (Date.now() - started > PHASE_BUDGET_MS) {
      errors.push('time_budget')
      break
    }
    attempted += 1
    try {
      const { data: matchup, error: mErr } = await supabase
        .from('matchups')
        .select('id, title, left_type, right_type')
        .eq('id', id)
        .maybeSingle()
      if (mErr || !matchup) throw new Error(mErr?.message || 'matchup missing')
      if (matchup.right_type != null) continue

      const { data: prompt, error: pErr } = await supabase
        .from('virtual_bot_matchup_prompts')
        .select('image_prompt')
        .eq('title', matchup.title)
        .limit(1)
        .maybeSingle()
      if (pErr) throw new Error(pErr.message)
      const scene = String(prompt?.image_prompt || '').trim()
      if (!scene) continue

      const bytes = await generatePngBytes(scene)
      if (!bytes?.length) continue

      const publicUrl = await uploadBotPng(supabase, `bot/${id}/left.png`, bytes)
      const { error: uErr } = await supabase
        .from('matchups')
        .update({
          left_type: 'image',
          left_url: publicUrl,
          left_thumbnail_url: publicUrl,
          left_text: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .is('right_type', null)
      if (uErr) throw new Error(uErr.message)
      attached += 1
    } catch (e) {
      errors.push(`${id}: ${e?.message || e}`)
    }
  }

  return { attempted, attached, errors: errors.slice(0, 6) }
}

async function reopenBotChallenge(supabase, id) {
  await supabase
    .from('matchups')
    .update({
      right_type: null,
      right_url: null,
      right_text: null,
      right_thumbnail_url: null,
      right_description: null,
      right_label: null,
      right_user_id: null,
      is_complete: false,
      challenger_joined_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

async function reopenEmptyImageChallenges(supabase, ids) {
  let reopened = 0
  for (const id of ids) {
    const { data } = await supabase
      .from('matchups')
      .select('left_type, right_type, right_url')
      .eq('id', id)
      .maybeSingle()
    if (data?.left_type === 'image' && data?.right_type === 'image' && !String(data.right_url || '').trim()) {
      await reopenBotChallenge(supabase, id)
      reopened += 1
    }
  }
  return reopened
}

/**
 * A측이 이미지인 봇 도전에 반대 측 이미지를 새로 붙인다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[] | null | undefined} challengedIds
 * @param {{ started?: number }} [opts]
 */
export async function attachBotChallengeImages(supabase, challengedIds, opts = {}) {
  const ids = (challengedIds || []).map((id) => String(id || '').trim()).filter(Boolean)
  if (!ids.length) return { attempted: 0, attached: 0, skipped: 'none' }
  if (!openaiKey()) {
    const reopened = await reopenEmptyImageChallenges(supabase, ids)
    return { attempted: 0, attached: 0, skipped: 'no_openai_key', reopened }
  }

  const started = opts.started || Date.now()
  let attached = 0
  let attempted = 0
  let reopened = 0
  const errors = []

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    if (Date.now() - started > PHASE_BUDGET_MS) {
      errors.push('time_budget')
      reopened += await reopenEmptyImageChallenges(supabase, ids.slice(i))
      break
    }
    try {
      const { data: matchup, error: mErr } = await supabase
        .from('matchups')
        .select('id, title, category, left_type, right_type, right_url, right_description')
        .eq('id', id)
        .maybeSingle()
      if (mErr || !matchup) throw new Error(mErr?.message || 'matchup missing')
      if (matchup.left_type !== 'image' || matchup.right_type !== 'image') continue
      if (String(matchup.right_url || '').includes('/bot/')) continue

      attempted += 1
      const scene = challengeScenePrompt({
        title: matchup.title,
        category: matchup.category,
        description: matchup.right_description,
      })
      const bytes = await generatePngBytes(scene)
      if (!bytes?.length) {
        await reopenBotChallenge(supabase, id)
        reopened += 1
        continue
      }
      const publicUrl = await uploadBotPng(supabase, `bot/${id}/right.png`, bytes)
      const { error: uErr } = await supabase
        .from('matchups')
        .update({
          right_type: 'image',
          right_url: publicUrl,
          right_thumbnail_url: publicUrl,
          right_text: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (uErr) throw new Error(uErr.message)
      attached += 1
    } catch (e) {
      errors.push(`${id}: ${e?.message || e}`)
      try {
        await reopenBotChallenge(supabase, id)
        reopened += 1
      } catch {
        /* ignore */
      }
    }
  }

  return { attempted, attached, reopened, errors: errors.slice(0, 6) }
}
