/**
 * 공개 중인 봇 도전글 검수 — 주제가 안 맞으면 원글에 맞춰 다시 쓴다.
 * 다시 쓸 수 없으면: 실제 유저 원글은 B 자리와 기존 표를 비우고, 봇 원글은 비공개(closed).
 * 결과·원래 B글은 virtual_bot_challenge_reviews 에 남긴다.
 */
import { loadBotCategoryCatalog, resolveBotCategoryKey, resolveBotCategoryLabel } from './botCategoryMap.mjs'
import {
  assertBotChallengeTopicFit,
  composeCheckedBotChallenge,
  writeBotChallengeCopy,
} from './botChallengeWriter.mjs'
import { challengeScenePrompt, generatePngBytes, uploadBotPng } from './botMatchupImage.mjs'
import { resetMatchupVotes } from './botChallengeCopy.mjs'

const REVIEWS = 'virtual_bot_challenge_reviews'
const DEFAULT_LIMIT = 6

function isFatal(res) {
  return res?.reason === 'openai_auth' || /incorrect api key|invalid api key|invalid_api_key|openai 401/i.test(String(res?.error || ''))
}

async function listReviewTargets(supabase, limit) {
  const { data: bots, error: botErr } = await supabase.from('profiles').select('id').eq('is_bot', true)
  if (botErr) throw botErr
  const botIds = (bots || []).map((b) => b.id).filter(Boolean)
  if (!botIds.length) return { rows: [], botSet: new Set() }
  const botSet = new Set(botIds)

  const rows = []
  for (let i = 0; i < botIds.length; i += 80) {
    const { data, error } = await supabase
      .from('matchups')
      .select(
        'id, title, description, category, status, user_id, left_type, left_text, left_url, left_thumbnail_url, right_type, right_url, right_text, right_description, right_user_id, challenger_joined_at',
      )
      .in('right_user_id', botIds.slice(i, i + 80))
      .in('right_type', ['text', 'image'])
      .or('status.eq.active,status.is.null')
      .not('is_demo', 'eq', true)
    if (error) throw error
    rows.push(...(data || []))
  }
  if (!rows.length) return { rows: [], botSet }

  const reviewed = new Set()
  const ids = rows.map((r) => r.id)
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from(REVIEWS).select('matchup_id').in('matchup_id', ids.slice(i, i + 100))
    if (error) throw error
    for (const r of data || []) reviewed.add(r.matchup_id)
  }

  const pending = rows
    .filter((r) => !reviewed.has(r.id))
    // 실제 유저 원글 먼저, 그다음 최근 도전 순
    .sort((a, b) => {
      const ah = botSet.has(a.user_id) ? 1 : 0
      const bh = botSet.has(b.user_id) ? 1 : 0
      if (ah !== bh) return ah - bh
      return String(b.challenger_joined_at || '').localeCompare(String(a.challenger_joined_at || ''))
    })
  return { rows: pending.slice(0, limit), botSet }
}

function prevSnapshot(row) {
  return {
    prev_status: row.status || 'active',
    prev_right_type: row.right_type,
    prev_right_description: row.right_description,
    prev_right_text: row.right_text,
    prev_right_url: row.right_url,
    prev_right_user_id: row.right_user_id,
  }
}

async function saveReview(supabase, row, fields) {
  const { error } = await supabase.from(REVIEWS).upsert(
    { matchup_id: row.id, ...prevSnapshot(row), ...fields, reviewed_at: new Date().toISOString() },
    { onConflict: 'matchup_id' },
  )
  if (error) throw new Error(error.message)
}

async function withdrawChallenge(supabase, row, botSet) {
  const now = new Date().toISOString()
  if (!botSet.has(row.user_id)) {
    await resetMatchupVotes(supabase, row.id)
    const { data, error } = await supabase
      .from('matchups')
      .update({
        right_type: null,
        right_url: null,
        right_thumbnail_url: null,
        right_text: null,
        right_description: null,
        right_label: null,
        right_user_id: null,
        is_complete: false,
        challenger_joined_at: null,
        left_votes: 0,
        right_votes: 0,
        total_votes: 0,
        result_points_settled_at: null,
        updated_at: now,
      })
      .eq('id', row.id)
      .eq('right_user_id', row.right_user_id)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Error('challenge already changed')
    return 'withdrawn'
  }
  const { error } = await supabase.from('matchups').update({ status: 'closed', updated_at: now }).eq('id', row.id)
  if (error) throw new Error(error.message)
  return 'hidden'
}

async function repairText(supabase, row, categoryLabel) {
  const matchup = { ...row, left_type: row.left_type || 'text' }
  const copy = await composeCheckedBotChallenge({ matchup, categoryLabel, attempts: 2 })
  if (!copy.ok) return copy
  const { error } = await supabase
    .from('matchups')
    .update({ right_description: copy.description, right_text: copy.bodyText, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('right_user_id', row.right_user_id)
  if (error) throw new Error(error.message)
  return { ok: true, fit: copy.fit, new_right_description: copy.description, new_right_text: copy.bodyText }
}

async function repairImage(supabase, row, categoryLabel, categoryKey) {
  const copy = await writeBotChallengeCopy({ matchup: row, categoryLabel })
  if (!copy.ok) return copy
  let imageUrl = row.right_url
  let fit = await assertBotChallengeTopicFit({
    matchup: row,
    categoryLabel,
    right: { description: copy.description, imageUrl },
  })
  if (!fit.ok && fit.reason === 'topic_mismatch') {
    const bytes = await generatePngBytes(
      challengeScenePrompt({ title: row.title, categoryKey, description: copy.description, imagePrompt: copy.imagePrompt }),
    )
    if (!bytes?.length) return { ok: false, reason: 'empty_image' }
    imageUrl = await uploadBotPng(supabase, `bot/${row.id}/right-${crypto.randomUUID()}.png`, bytes)
    fit = await assertBotChallengeTopicFit({
      matchup: row,
      categoryLabel,
      right: { description: copy.description, imageUrl },
    })
  }
  if (!fit.ok) return fit
  const { error } = await supabase
    .from('matchups')
    .update({
      right_description: copy.description,
      right_url: imageUrl,
      right_thumbnail_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('right_user_id', row.right_user_id)
  if (error) throw new Error(error.message)
  return { ok: true, fit: fit.fit, new_right_description: copy.description, new_right_url: imageUrl }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ limit?: number, started?: number, budgetMs?: number }} [opts]
 */
export async function reviewBotChallenges(supabase, opts = {}) {
  const limit = Math.max(0, Number(opts.limit) || DEFAULT_LIMIT)
  const started = opts.started || Date.now()
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : 5 * 60 * 1000
  if (!limit) return { reviewed: 0, skipped: 'limit' }

  const { rows, botSet } = await listReviewTargets(supabase, limit)
  if (!rows.length) return { reviewed: 0, skipped: 'none' }

  const catalog = await loadBotCategoryCatalog(supabase)
  const counts = { ok: 0, rewritten: 0, withdrawn: 0, hidden: 0 }
  const errors = []

  for (const row of rows) {
    if (Date.now() - started > budgetMs) {
      errors.push('time_budget')
      break
    }
    const categoryLabel = resolveBotCategoryLabel(row.category, catalog)
    const categoryKey = resolveBotCategoryKey(row.category, catalog)
    try {
      const current = await assertBotChallengeTopicFit({
        matchup: { ...row, left_type: row.left_type || 'text' },
        categoryLabel,
        right: {
          description: row.right_description,
          bodyText: row.right_type === 'text' ? row.right_text : null,
          imageUrl: row.right_type === 'image' ? row.right_url : null,
        },
      })
      if (current.ok) {
        await saveReview(supabase, row, { result: 'ok', fit: current.fit, reason_ko: current.reason_ko })
        counts.ok += 1
        continue
      }
      if (current.reason !== 'topic_mismatch') {
        errors.push(`${row.id}: ${current.reason}`)
        if (isFatal(current)) break
        continue
      }

      const fixed =
        row.right_type === 'image'
          ? await repairImage(supabase, row, categoryLabel, categoryKey)
          : await repairText(supabase, row, categoryLabel)
      if (fixed.ok) {
        const { ok: _ok, ...rest } = fixed
        await saveReview(supabase, row, { result: 'rewritten', reason_ko: current.reason_ko, ...rest })
        counts.rewritten += 1
        continue
      }
      if (fixed.reason === 'ai_error' || isFatal(fixed)) {
        errors.push(`${row.id}: ${fixed.reason}`)
        if (isFatal(fixed)) break
        continue
      }
      const action = await withdrawChallenge(supabase, row, botSet)
      await saveReview(supabase, row, {
        result: action,
        fit: fixed.fit ?? current.fit ?? null,
        reason_ko: fixed.reason_ko || fixed.error || current.reason_ko || fixed.reason,
      })
      counts[action] += 1
    } catch (e) {
      errors.push(`${row.id}: ${e?.message || e}`)
    }
  }

  return { reviewed: counts.ok + counts.rewritten + counts.withdrawn + counts.hidden, ...counts, ...(errors.length ? { errors: errors.slice(0, 6) } : {}) }
}
