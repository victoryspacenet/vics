/**
 * 관전봇 매치업 이미지 (OpenAI Images → matchup-media)
 * 생성: 사진을 만든 뒤에만 올린다. 실패하면 매치업을 만들지 않는다.
 * 도전: A측이 이미지일 때 오른쪽 이미지를 새로 만든 뒤에만 도전한다.
 * 회원 미디어는 재사용하지 않음.
 */
import { loadBotCategoryCatalog, resolveBotCategoryKey, resolveBotCategoryLabel } from './botCategoryMap.mjs'
import { resetMatchupVotes } from './botChallengeCopy.mjs'
import {
  assertBotChallengeTopicFit,
  composeCheckedBotChallenge,
  recordPassedBotChallenge,
  writeBotChallengeCopy,
} from './botChallengeWriter.mjs'

const BUCKET = 'matchup-media'
const CREATE_DEDUP_DAYS = 28
const IMAGE_TIMEOUT_MS = 22_000
export const PHASE_BUDGET_MS = 50_000
const SAFETY =
  'Candid photorealistic smartphone photo of everyday Korean life, one or two people in their early-to-mid 20s with natural faces, ordinary clothes, not celebrities, not posed influencer studio, no readable text, no logos, no watermark, square composition.'

function openaiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim()
}

function isFatalOpenAiError(err) {
  const msg = String(err?.message || err || '')
  return /incorrect api key|invalid api key|invalid_api_key|openai 401/i.test(msg)
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

export async function generatePngBytes(scenePrompt, safety = SAFETY) {
  const key = openaiKey()
  if (!key) return null
  const prompt = `${String(scenePrompt || '').trim()}. ${safety}`
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

export async function uploadBotPng(supabase, objectPath, bytes, contentType = 'image/png') {
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })
  if (upErr) throw new Error(upErr.message)
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath)
  const publicUrl = pub?.publicUrl
  if (!publicUrl) throw new Error('public url missing')
  return publicUrl
}

async function removeBotObject(supabase, objectPath) {
  if (!objectPath) return
  try {
    await supabase.storage.from(BUCKET).remove([objectPath])
  } catch {
    /* best-effort */
  }
}

export function challengeScenePrompt({ title, categoryKey, description, imagePrompt }) {
  const topic = String(title || 'this matchup').replace(/\s+/g, ' ').trim().slice(0, 80)
  const vibe = String(description || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const entry = String(imagePrompt || '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (entry) return `${entry} Topic: "${topic}". Mood: ${vibe}`
  const setting =
    categoryKey === 'fashion'
      ? 'street style and clothes in Seoul'
      : categoryKey === '맛집'
        ? 'a restaurant or neighborhood food spot in Korea'
        : categoryKey === '맛식'
          ? 'a close food moment at a Korean table'
          : categoryKey === 'lifestyle'
            ? 'everyday Korean lifestyle, a small choice or trend at home or in the city'
            : categoryKey === 'romance'
              ? 'a candid dating moment between two Korean people in their early 20s'
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
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : PHASE_BUDGET_MS
  let attached = 0
  let attempted = 0
  const errors = []

  for (const id of ids) {
    if (Date.now() - started > budgetMs) {
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

function shuffle(list) {
  const rows = [...list]
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }
  return rows
}

async function reopenBotChallenge(supabase, id) {
  await resetMatchupVotes(supabase, id)
  const { error } = await supabase
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
      left_votes: 0,
      right_votes: 0,
      total_votes: 0,
      result_points_settled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** 사진 없이 남은 이미지 봇 도전은 가이드 위반이므로 슬롯을 되돌린다. */
export async function abandonEmptyBotImageChallenges(supabase) {
  const { data: bots, error: botErr } = await supabase.from('profiles').select('id').eq('is_bot', true)
  if (botErr) throw botErr
  const botIds = (bots || []).map((b) => b.id).filter(Boolean)
  if (!botIds.length) return { reopened: 0 }

  const { data, error } = await supabase
    .from('matchups')
    .select('id')
    .eq('left_type', 'image')
    .eq('right_type', 'image')
    .in('right_user_id', botIds)
    .is('right_url', null)
  if (error) throw error

  let reopened = 0
  for (const row of data || []) {
    await reopenBotChallenge(supabase, row.id)
    reopened += 1
  }
  return { reopened }
}

async function listEligibleBots(supabase, intervalHours, recentColumn) {
  const hours = Math.max(1, Number(intervalHours) || 48)
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const { data: bots, error: botErr } = await supabase.from('profiles').select('id, nickname').eq('is_bot', true)
  if (botErr) throw botErr
  const all = bots || []
  if (!all.length) return []
  const busy = new Set()
  const chunk = 80
  const timeColumn = recentColumn === 'right_user_id' ? 'challenger_joined_at' : 'created_at'
  for (let i = 0; i < all.length; i += chunk) {
    const part = all.slice(i, i + chunk).map((b) => b.id)
    const { data: recent, error: recentErr } = await supabase
      .from('matchups')
      .select(recentColumn)
      .in(recentColumn, part)
      .gte(timeColumn, since)
    if (recentErr) throw recentErr
    for (const row of recent || []) {
      if (row[recentColumn]) busy.add(row[recentColumn])
    }
  }
  return shuffle(all.filter((b) => b?.id && !busy.has(b.id)))
}

async function listEligibleCreateBots(supabase, intervalHours) {
  return listEligibleBots(supabase, intervalHours, 'user_id')
}

function addCreateFingerprints(rows, used) {
  for (const row of rows || []) {
    const title = String(row.title || '').trim()
    const body = String(row.left_text || '').trim()
    if (title) used.titles.add(title)
    if (body) used.bodies.add(body)
  }
}

async function fetchMatchupsByColumnIn(supabase, column, values, since) {
  const rows = []
  const size = 40
  for (let i = 0; i < values.length; i += size) {
    const slice = values.slice(i, i + size)
    if (!slice.length) continue
    const { data, error } = await supabase
      .from('matchups')
      .select('title, left_text')
      .not('is_demo', 'eq', true)
      .gte('created_at', since)
      .in(column, slice)
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

async function listUsedCreateFingerprints(supabase) {
  const used = { titles: new Set(), bodies: new Set() }
  const { data: prompts, error: promptErr } = await supabase
    .from('virtual_bot_matchup_prompts')
    .select('title, body_text')
  if (promptErr) throw promptErr
  const titles = [
    ...new Set((prompts || []).map((row) => String(row.title || '').trim()).filter(Boolean)),
  ]
  const bodies = [
    ...new Set((prompts || []).map((row) => String(row.body_text || '').trim()).filter(Boolean)),
  ]
  const since = new Date(Date.now() - CREATE_DEDUP_DAYS * 24 * 3600 * 1000).toISOString()
  const byTitle = await fetchMatchupsByColumnIn(supabase, 'title', titles, since)
  const byBody = await fetchMatchupsByColumnIn(supabase, 'left_text', bodies, since)
  addCreateFingerprints(byTitle, used)
  addCreateFingerprints(byBody, used)
  return used
}

function markCreateFingerprint(used, prompt) {
  const title = String(prompt?.title || '').trim()
  const body = String(prompt?.body_text || '').trim()
  if (title) used.titles.add(title)
  if (body) used.bodies.add(body)
}

function isUnusedCreatePrompt(prompt, used) {
  const title = String(prompt?.title || '').trim()
  const body = String(prompt?.body_text || '').trim()
  if (!title) return false
  if (used.titles.has(title)) return false
  if (body && used.bodies.has(body)) return false
  return true
}

function adminIdForPromptKey(catalog, promptKey) {
  const key = String(promptKey || '').trim()
  if (!key || !catalog?.keyById) return ''
  for (const [id, mapped] of catalog.keyById.entries()) {
    if (mapped === key) return id
  }
  return ''
}

async function pickCreatePrompt(supabase, used) {
  const { data: category, error: catErr } = await supabase.rpc('bot_random_category_id')
  if (catErr) throw catErr
  const categoryId = String(category || '').trim()
  if (!categoryId) return null
  const { data: keyData, error: keyErr } = await supabase.rpc('bot_admin_category_prompt_key', {
    p_admin_id: categoryId,
  })
  if (keyErr) throw keyErr
  let promptKey = String(keyData || '').trim()
  if (!promptKey) {
    const catalog = await loadBotCategoryCatalog(supabase)
    promptKey = resolveBotCategoryKey(categoryId, catalog) || ''
  }
  if (!promptKey) return null
  const { data: prompts, error: promptErr } = await supabase
    .from('virtual_bot_matchup_prompts')
    .select('id, title, description, body_text, tags, image_prompt, category_id')
    .eq('category_id', promptKey)
  if (promptErr) throw promptErr
  const unused = shuffle((prompts || []).filter((row) => isUnusedCreatePrompt(row, used)))
  if (unused.length) return { categoryId, prompt: unused[0] }

  const { data: allPrompts, error: allErr } = await supabase
    .from('virtual_bot_matchup_prompts')
    .select('id, title, description, body_text, tags, image_prompt, category_id')
  if (allErr) throw allErr
  const unusedAny = shuffle((allPrompts || []).filter((row) => isUnusedCreatePrompt(row, used)))
  if (!unusedAny.length) return null
  const prompt = unusedAny[0]
  const catalog = await loadBotCategoryCatalog(supabase)
  const fallbackId = adminIdForPromptKey(catalog, prompt.category_id) || categoryId
  return { categoryId: fallbackId, prompt }
}

async function listEligibleChallengeBots(supabase, intervalHours) {
  return listEligibleBots(supabase, intervalHours, 'right_user_id')
}

/** 같은 제목의 다른 봇 글이 공개 중이면 그 봇 글에는 도전하지 않는다. */
async function dropDuplicateBotTitleTargets(supabase, targets) {
  const list = targets || []
  if (!list.length) return { kept: list, skipped: 0 }
  const { data: bots, error: botErr } = await supabase.from('profiles').select('id').eq('is_bot', true)
  if (botErr) throw botErr
  const botIds = new Set((bots || []).map((b) => b.id))
  const titles = [
    ...new Set(
      list
        .filter((t) => botIds.has(t.user_id))
        .map((t) => String(t.title || '').trim())
        .filter(Boolean),
    ),
  ]
  if (!titles.length) return { kept: list, skipped: 0 }

  const botPostsByTitle = new Map()
  for (let i = 0; i < titles.length; i += 40) {
    const { data, error } = await supabase
      .from('matchups')
      .select('id, title, user_id')
      .in('title', titles.slice(i, i + 40))
      .or('status.eq.active,status.is.null')
      .not('is_demo', 'eq', true)
    if (error) throw error
    for (const row of data || []) {
      if (!botIds.has(row.user_id)) continue
      const title = String(row.title || '').trim()
      botPostsByTitle.set(title, (botPostsByTitle.get(title) || 0) + 1)
    }
  }

  const kept = list.filter((t) => {
    if (!botIds.has(t.user_id)) return true
    return (botPostsByTitle.get(String(t.title || '').trim()) || 0) <= 1
  })
  return { kept, skipped: list.length - kept.length }
}

/**
 * 이미지 NEW는 매치업에 맞춘 B글·사진을 만들고 봇 전용 엄격 검사를 통과한 뒤에만 도전한다.
 */
export async function challengeBotImageMatchups(supabase, opts = {}) {
  const remaining = Math.max(0, Number(opts.remaining) || 0)
  if (remaining <= 0) return { attempted: 0, challenged: 0, skipped: 'quota' }
  if (!openaiKey()) return { attempted: 0, challenged: 0, skipped: 'no_openai_key' }

  const started = opts.started || Date.now()
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : PHASE_BUDGET_MS
  const intervalHours = opts.intervalHours || 48
  const bots = await listEligibleChallengeBots(supabase, intervalHours)
  if (!bots.length) return { attempted: 0, challenged: 0, skipped: 'no_eligible_bots' }

  const catalog = await loadBotCategoryCatalog(supabase)
  const { data: waiting, error: waitErr } = await supabase
    .from('matchups')
    .select('id, title, description, category, user_id, left_type, left_text, left_url, left_thumbnail_url')
    .eq('status', 'active')
    .eq('left_type', 'image')
    .is('right_type', null)
    .not('is_demo', 'eq', true)
    .is('challenger_forfeit_at', null)
    .order('created_at', { ascending: true })
    .limit(400)
  if (waitErr) throw waitErr

  const { kept, skipped: duplicateTitleSkipped } = await dropDuplicateBotTitleTargets(supabase, waiting)
  const targets = shuffle(kept)
  if (!targets.length) {
    return { attempted: 0, challenged: 0, skipped: 'no_image_waiting', duplicate_title_skipped: duplicateTitleSkipped }
  }

  const failed = new Set((opts.failedBotIds || []).map((id) => String(id)))
  if (!bots.some((bot) => !failed.has(String(bot.id)))) {
    return { attempted: 0, challenged: 0, skipped: 'image_failed_no_retry', duplicate_title_skipped: duplicateTitleSkipped }
  }

  let attempted = 0
  let challenged = 0
  const challengedIds = []
  const failedBotIds = []
  const errors = []
  let botIdx = 0

  for (const target of targets) {
    if (challenged >= remaining) break
    if (Date.now() - started > budgetMs) {
      errors.push('time_budget')
      break
    }
    while (bots[botIdx] && failed.has(String(bots[botIdx].id))) botIdx += 1
    const bot = bots[botIdx]
    if (!bot) break
    if (bot.id === target.user_id) continue

    const categoryKey = resolveBotCategoryKey(target.category, catalog)
    const categoryLabel = resolveBotCategoryLabel(target.category, catalog)

    attempted += 1
    let objectPath = ''
    try {
      const copy = await writeBotChallengeCopy({ matchup: target, categoryLabel })
      if (!copy.ok) {
        errors.push(`${target.id}: ${copy.reason}`)
        if (isFatalOpenAiError(copy.error)) {
          return {
            attempted,
            challenged,
            challenged_ids: challengedIds,
            skipped: 'openai_auth',
            errors: errors.slice(0, 6),
          }
        }
        continue
      }
      const scene = challengeScenePrompt({
        title: target.title,
        categoryKey,
        description: copy.description,
        imagePrompt: copy.imagePrompt,
      })
      let bytes
      try {
        bytes = await generatePngBytes(scene)
      } catch (e) {
        errors.push(`${target.id}: ${e?.message || e}`)
        failed.add(String(bot.id))
        failedBotIds.push(bot.id)
        botIdx += 1
        if (isFatalOpenAiError(e)) {
          return {
            attempted,
            challenged,
            challenged_ids: challengedIds,
            skipped: 'openai_auth',
            failedBotIds,
            errors: errors.slice(0, 6),
          }
        }
        continue
      }
      if (!bytes?.length) {
        errors.push(`${target.id}: empty_image`)
        failed.add(String(bot.id))
        failedBotIds.push(bot.id)
        botIdx += 1
        continue
      }
      objectPath = `bot/${target.id}/right-${crypto.randomUUID()}.png`
      const publicUrl = await uploadBotPng(supabase, objectPath, bytes)
      const sim = await assertBotChallengeTopicFit({
        matchup: target,
        categoryLabel,
        right: { description: copy.description, imageUrl: publicUrl },
      })
      if (!sim.ok) {
        await removeBotObject(supabase, objectPath)
        errors.push(`${target.id}: ${sim.reason}${sim.fit != null ? `(${sim.fit})` : ''}`)
        if (sim.reason === 'openai_auth' || isFatalOpenAiError(sim.error)) {
          return {
            attempted,
            challenged,
            challenged_ids: challengedIds,
            skipped: 'openai_auth',
            errors: errors.slice(0, 6),
          }
        }
        botIdx += 1
        continue
      }
      const nickname = String(bot.nickname || '').trim() || 'B'
      const { data: updated, error: uErr } = await supabase
        .from('matchups')
        .update({
          right_type: 'image',
          right_url: publicUrl,
          right_thumbnail_url: publicUrl,
          right_text: null,
          right_description: copy.description,
          right_label: nickname,
          right_user_id: bot.id,
          is_complete: true,
          challenger_joined_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.id)
        .is('right_type', null)
        .select('id')
      if (uErr) throw new Error(uErr.message)
      if (!updated?.length) {
        await removeBotObject(supabase, objectPath)
        continue
      }
      await recordPassedBotChallenge(supabase, {
        matchupId: target.id,
        fit: sim.fit,
        description: copy.description,
        url: publicUrl,
      })
      challenged += 1
      challengedIds.push(target.id)
      botIdx += 1
    } catch (e) {
      await removeBotObject(supabase, objectPath)
      errors.push(`${target.id}: ${e?.message || e}`)
      if (isFatalOpenAiError(e)) {
        return {
          attempted,
          challenged,
          challenged_ids: challengedIds,
          skipped: 'openai_auth',
          failedBotIds,
          errors: errors.slice(0, 6),
        }
      }
    }
  }

  return { attempted, challenged, challenged_ids: challengedIds, failedBotIds, errors: errors.slice(0, 6) }
}

/**
 * 텍스트 NEW는 매치업에 맞춘 B글을 쓰고 봇 전용 엄격 검사를 통과한 뒤에만 도전한다.
 */
export async function challengeBotTextMatchups(supabase, opts = {}) {
  const remaining = Math.max(0, Number(opts.remaining) || 0)
  if (remaining <= 0) return { attempted: 0, challenged: 0, skipped: 'quota' }
  if (!openaiKey()) return { attempted: 0, challenged: 0, skipped: 'no_openai_key' }

  const started = opts.started || Date.now()
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : PHASE_BUDGET_MS
  const intervalHours = opts.intervalHours || 48
  const bots = await listEligibleChallengeBots(supabase, intervalHours)
  if (!bots.length) return { attempted: 0, challenged: 0, skipped: 'no_eligible_bots' }

  const catalog = await loadBotCategoryCatalog(supabase)
  const { data: waiting, error: waitErr } = await supabase
    .from('matchups')
    .select('id, title, description, category, user_id, left_type, left_text, left_url, left_thumbnail_url')
    .eq('status', 'active')
    .or('left_type.eq.text,left_type.is.null')
    .is('right_type', null)
    .not('is_demo', 'eq', true)
    .is('challenger_forfeit_at', null)
    .order('created_at', { ascending: true })
    .limit(400)
  if (waitErr) throw waitErr

  const { kept, skipped: duplicateTitleSkipped } = await dropDuplicateBotTitleTargets(supabase, waiting)
  const targets = shuffle(kept)
  if (!targets.length) {
    return { attempted: 0, challenged: 0, skipped: 'no_text_waiting', duplicate_title_skipped: duplicateTitleSkipped }
  }

  let attempted = 0
  let challenged = 0
  const challengedIds = []
  const errors = []
  let botIdx = 0

  for (const target of targets) {
    if (challenged >= remaining) break
    if (Date.now() - started > budgetMs) {
      errors.push('time_budget')
      break
    }
    const bot = bots[botIdx]
    if (!bot) break
    if (bot.id === target.user_id) continue

    attempted += 1
    try {
      const copy = await composeCheckedBotChallenge({
        matchup: { ...target, left_type: target.left_type || 'text' },
        categoryLabel: resolveBotCategoryLabel(target.category, catalog),
      })
      if (!copy.ok) {
        errors.push(`${target.id}: ${copy.reason}${copy.fit != null ? `(${copy.fit})` : ''}`)
        if (copy.reason === 'openai_auth' || isFatalOpenAiError(copy.error)) {
          return {
            attempted,
            challenged,
            challenged_ids: challengedIds,
            skipped: 'openai_auth',
            errors: errors.slice(0, 6),
          }
        }
        continue
      }
      const nickname = String(bot.nickname || '').trim() || 'B'
      const { data: updated, error: uErr } = await supabase
        .from('matchups')
        .update({
          right_type: 'text',
          right_url: null,
          right_thumbnail_url: null,
          right_text: copy.bodyText,
          right_description: copy.description,
          right_label: nickname,
          right_user_id: bot.id,
          is_complete: true,
          challenger_joined_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.id)
        .is('right_type', null)
        .select('id')
      if (uErr) throw new Error(uErr.message)
      if (!updated?.length) continue
      await recordPassedBotChallenge(supabase, {
        matchupId: target.id,
        fit: copy.fit,
        description: copy.description,
        text: copy.bodyText,
      })
      challenged += 1
      challengedIds.push(target.id)
      botIdx += 1
    } catch (e) {
      errors.push(`${target.id}: ${e?.message || e}`)
      if (isFatalOpenAiError(e)) {
        return {
          attempted,
          challenged,
          challenged_ids: challengedIds,
          skipped: 'openai_auth',
          errors: errors.slice(0, 6),
        }
      }
    }
  }

  return { attempted, challenged, challenged_ids: challengedIds, errors: errors.slice(0, 6) }
}

function createScenePrompt(prompt) {
  const scene = String(prompt?.image_prompt || '').trim()
  if (scene) return scene
  const topic = String(prompt?.title || 'this matchup').replace(/\s+/g, ' ').trim().slice(0, 80)
  return `Everyday Korean lifestyle photo about "${topic}"`
}

export async function createBotTextMatchups(supabase, opts = {}) {
  const remaining = Math.max(0, Number(opts.remaining) || 0)
  if (remaining <= 0) return { attempted: 0, created: 0, skipped: 'quota' }

  const started = opts.started || Date.now()
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : PHASE_BUDGET_MS
  const intervalHours = opts.intervalHours || 48
  const bots = await listEligibleCreateBots(supabase, intervalHours)
  if (!bots.length) return { attempted: 0, created: 0, skipped: 'no_eligible_bots' }

  const used = await listUsedCreateFingerprints(supabase)
  let attempted = 0
  let created = 0
  const createdIds = []
  const errors = []

  for (const bot of bots) {
    if (created >= remaining) break
    if (Date.now() - started > budgetMs) {
      errors.push('time_budget')
      break
    }

    attempted += 1
    try {
      let picked = null
      for (let n = 0; n < 4 && !picked; n += 1) {
        picked = await pickCreatePrompt(supabase, used)
      }
      if (!picked?.prompt) {
        errors.push(`${bot.id}: duplicate_prompt`)
        continue
      }
      const nickname = String(bot.nickname || '').trim() || 'A'
      const tags = Array.isArray(picked.prompt.tags) ? picked.prompt.tags.filter(Boolean) : []
      const { data: inserted, error: insErr } = await supabase
        .from('matchups')
        .insert({
          user_id: bot.id,
          title: picked.prompt.title,
          description: picked.prompt.description || null,
          left_type: 'text',
          left_url: null,
          left_text: picked.prompt.body_text,
          left_thumbnail_url: null,
          left_label: nickname,
          right_type: null,
          tags: tags.length ? tags : null,
          category: picked.categoryId,
          expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          status: 'active',
          is_complete: false,
        })
        .select('id')
        .single()
      if (insErr) throw new Error(insErr.message)
      markCreateFingerprint(used, picked.prompt)
      created += 1
      if (inserted?.id) createdIds.push(inserted.id)
    } catch (e) {
      errors.push(`${bot.id}: ${e?.message || e}`)
    }
  }

  return { attempted, created, created_ids: createdIds, errors: errors.slice(0, 6) }
}

/**
 * 사진을 만든 뒤에만 이미지 매치업을 올린다. 실패하면 행을 만들지 않는다.
 */
export async function createBotImageMatchups(supabase, opts = {}) {
  const remaining = Math.max(0, Number(opts.remaining) || 0)
  if (remaining <= 0) return { attempted: 0, created: 0, skipped: 'quota' }
  if (!openaiKey()) return { attempted: 0, created: 0, skipped: 'no_openai_key' }

  const started = opts.started || Date.now()
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : PHASE_BUDGET_MS
  const intervalHours = opts.intervalHours || 48
  const bots = await listEligibleCreateBots(supabase, intervalHours)
  if (!bots.length) return { attempted: 0, created: 0, skipped: 'no_eligible_bots' }

  const used = await listUsedCreateFingerprints(supabase)
  const failed = new Set((opts.failedBotIds || []).map((id) => String(id)))
  const queue = bots.filter((bot) => !failed.has(bot.id))
  if (!queue.length) return { attempted: 0, created: 0, skipped: 'image_failed_no_retry' }

  let attempted = 0
  let created = 0
  const createdIds = []
  const failedBotIds = []
  const errors = []

  for (const bot of queue) {
    if (created >= remaining) break
    if (Date.now() - started > budgetMs) {
      errors.push('time_budget')
      break
    }

    attempted += 1
    try {
      let picked = null
      for (let n = 0; n < 4 && !picked; n += 1) {
        picked = await pickCreatePrompt(supabase, used)
      }
      if (!picked?.prompt) {
        errors.push(`${bot.id}: duplicate_prompt`)
        continue
      }
      let bytes
      try {
        bytes = await generatePngBytes(createScenePrompt(picked.prompt))
      } catch (e) {
        errors.push(`${bot.id}: ${e?.message || e}`)
        failed.add(String(bot.id))
        failedBotIds.push(bot.id)
        if (isFatalOpenAiError(e)) {
          return {
            attempted,
            created,
            created_ids: createdIds,
            skipped: 'openai_auth',
            failedBotIds,
            errors: errors.slice(0, 6),
          }
        }
        continue
      }
      if (!bytes?.length) {
        errors.push(`${bot.id}: empty_image`)
        failed.add(String(bot.id))
        failedBotIds.push(bot.id)
        continue
      }

      const id = crypto.randomUUID()
      const objectPath = `bot/${id}/left.png`
      const publicUrl = await uploadBotPng(supabase, objectPath, bytes)
      const nickname = String(bot.nickname || '').trim() || 'A'
      const tags = Array.isArray(picked.prompt.tags) ? picked.prompt.tags.filter(Boolean) : []
      const { error: insErr } = await supabase.from('matchups').insert({
        id,
        user_id: bot.id,
        title: picked.prompt.title,
        description: picked.prompt.description || null,
        left_type: 'image',
        left_url: publicUrl,
        left_text: null,
        left_thumbnail_url: publicUrl,
        left_label: nickname,
        right_type: null,
        tags: tags.length ? tags : null,
        category: picked.categoryId,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        status: 'active',
        is_complete: false,
      })
      if (insErr) {
        await removeBotObject(supabase, objectPath)
        throw new Error(insErr.message)
      }
      markCreateFingerprint(used, picked.prompt)
      created += 1
      createdIds.push(id)
    } catch (e) {
      errors.push(`${bot.id}: ${e?.message || e}`)
    }
  }

  return { attempted, created, created_ids: createdIds, failedBotIds, errors: errors.slice(0, 6) }
}
