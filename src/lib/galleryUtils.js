/**
 * 나의 랭킹 히스토리 — Supabase `ranking_gallery_cards`
 */

import { supabase } from './supabase'

export const RANKING_GALLERY_UPDATED = 'vics:ranking-gallery:updated'
const GALLERY_MAX_CARDS = 40
const LEGACY_KEY = (uid) => `vics_rank_gallery_${uid}`
const LEGACY_SCHEMA_KEY = (uid) => `vics_rank_gallery_schema_${uid}`

/** @typedef {{ id?: string, rank?: number, nickname?: string, points?: number, period?: string, themeId?: string, matchupTierId?: string, thumbnail?: string, showNickname?: boolean, showPoints?: boolean, showRank?: boolean, savedAt?: string, isNew?: boolean }} GalleryCard */

export function normalizeGalleryCard(card) {
  if (!card || typeof card !== 'object') return null
  const rank = Number(card.rank)
  if (!Number.isFinite(rank) || rank < 1) return null
  return {
    ...card,
    id: card.id ? String(card.id) : undefined,
    rank,
    points: Number(card.points) || 0,
    period: card.period || 'weekly',
    themeId: card.themeId || card.theme_id || 'slate',
    matchupTierId: card.matchupTierId || card.matchup_tier_id || 'player',
    showNickname: card.showNickname !== false && card.show_nickname !== false,
    showPoints: card.showPoints !== false && card.show_points !== false,
    showRank: card.showRank !== false && card.show_rank !== false,
    savedAt: card.savedAt || card.saved_at || null,
    isNew: Boolean(card.isNew ?? card.is_new),
  }
}

export function getGalleryDrawOpts(card) {
  const row = normalizeGalleryCard(card)
  if (!row) return null
  return {
    rank: row.rank,
    nickname: row.nickname,
    points: row.points,
    period: row.period,
    themeId: row.themeId,
    showNickname: row.showNickname,
    showPoints: row.showPoints,
    showRank: row.showRank,
  }
}

function dispatchGalleryUpdated() {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(RANKING_GALLERY_UPDATED))
  } catch {
    /* ignore */
  }
}

function rowToGalleryCard(row) {
  if (!row) return null
  return normalizeGalleryCard({
    id: row.id,
    rank: row.rank,
    nickname: row.nickname,
    points: row.points,
    period: row.period,
    themeId: row.theme_id,
    matchupTierId: row.matchup_tier_id,
    thumbnail: row.thumbnail,
    showNickname: row.show_nickname,
    showPoints: row.show_points,
    showRank: row.show_rank,
    savedAt: row.saved_at,
    isNew: row.is_new,
  })
}

function cardDataToInsertRow(userId, cardData, { isNew = true, savedAt } = {}) {
  const normalized = normalizeGalleryCard(cardData)
  if (!normalized || !userId) return null
  return {
    user_id: userId,
    rank: normalized.rank,
    nickname: normalized.nickname || null,
    points: normalized.points,
    period: normalized.period,
    theme_id: normalized.themeId,
    matchup_tier_id: normalized.matchupTierId || 'player',
    show_nickname: normalized.showNickname,
    show_points: normalized.showPoints,
    show_rank: normalized.showRank,
    thumbnail: normalized.thumbnail || null,
    is_new: isNew,
    saved_at: savedAt || normalized.savedAt || new Date().toISOString(),
  }
}

async function migrateLegacyGallery(userId) {
  if (!userId || typeof localStorage === 'undefined') return

  let raw = null
  try {
    raw = localStorage.getItem(LEGACY_KEY(userId))
  } catch {
    return
  }
  if (!raw) return

  let legacyCards = []
  try {
    legacyCards = JSON.parse(raw)
  } catch {
    localStorage.removeItem(LEGACY_KEY(userId))
    localStorage.removeItem(LEGACY_SCHEMA_KEY(userId))
    return
  }

  if (!Array.isArray(legacyCards) || legacyCards.length === 0) {
    localStorage.removeItem(LEGACY_KEY(userId))
    localStorage.removeItem(LEGACY_SCHEMA_KEY(userId))
    return
  }

  const { count } = await supabase
    .from('ranking_gallery_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if ((count ?? 0) > 0) {
    localStorage.removeItem(LEGACY_KEY(userId))
    localStorage.removeItem(LEGACY_SCHEMA_KEY(userId))
    return
  }

  const rows = legacyCards
    .map((c) =>
      cardDataToInsertRow(userId, c, {
        isNew: false,
        savedAt: c.savedAt || c.saved_at,
      }),
    )
    .filter(Boolean)
    .slice(0, GALLERY_MAX_CARDS)

  if (rows.length > 0) {
    const { error } = await supabase.from('ranking_gallery_cards').insert(rows)
    if (error && import.meta.env.DEV) {
      console.warn('[galleryUtils] legacy migrate:', error.message)
    }
  }

  localStorage.removeItem(LEGACY_KEY(userId))
  localStorage.removeItem(LEGACY_SCHEMA_KEY(userId))
}

/**
 * @param {string} userId
 * @returns {Promise<GalleryCard[]>}
 */
export async function fetchGallery(userId) {
  if (!userId) return []

  await migrateLegacyGallery(userId)

  const { data, error } = await supabase
    .from('ranking_gallery_cards')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
    .limit(GALLERY_MAX_CARDS)

  if (error) {
    if (import.meta.env.DEV) console.warn('[galleryUtils] fetch:', error.message)
    return []
  }

  return (data || []).map(rowToGalleryCard).filter(Boolean)
}

/**
 * @param {string} userId
 * @param {object} cardData
 * @returns {Promise<GalleryCard|null>}
 */
export async function saveToGallery(userId, cardData) {
  if (!userId) return null

  const row = cardDataToInsertRow(userId, cardData, { isNew: true })
  if (!row) return null

  const { data, error } = await supabase
    .from('ranking_gallery_cards')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    if (import.meta.env.DEV) console.warn('[galleryUtils] save:', error.message)
    throw new Error(error.message || '랭킹 카드를 저장하지 못했어요')
  }

  dispatchGalleryUpdated()
  return rowToGalleryCard(data)
}

/**
 * @param {string} userId
 * @param {string} cardId
 */
export async function deleteFromGallery(userId, cardId) {
  if (!userId || !cardId) return { ok: false, error: '잘못된 요청이에요' }

  const { error } = await supabase
    .from('ranking_gallery_cards')
    .delete()
    .eq('user_id', userId)
    .eq('id', cardId)

  if (error) {
    if (import.meta.env.DEV) console.warn('[galleryUtils] delete:', error.message)
    return { ok: false, error: error.message || '삭제에 실패했어요' }
  }

  dispatchGalleryUpdated()
  return { ok: true }
}

/** @param {string} userId */
export async function markAllSeen(userId) {
  if (!userId) return

  const { error } = await supabase
    .from('ranking_gallery_cards')
    .update({ is_new: false })
    .eq('user_id', userId)
    .eq('is_new', true)

  if (error && import.meta.env.DEV) {
    console.warn('[galleryUtils] mark seen:', error.message)
    return
  }

  dispatchGalleryUpdated()
}

export function getBestCard(cards) {
  return cards.reduce((best, c) => (!best || c.rank < best.rank ? c : best), null)
}
