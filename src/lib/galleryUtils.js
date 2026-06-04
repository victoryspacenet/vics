/** localStorage 스키마 — 올리면 기존 더미·테스트 카드 일괄 제거 */
const GALLERY_SCHEMA_VERSION = 2
const KEY = (uid) => `vics_rank_gallery_${uid}`
const SCHEMA_KEY = (uid) => `vics_rank_gallery_schema_${uid}`

function ensureGallerySchema(userId) {
  if (!userId) return
  const current = localStorage.getItem(SCHEMA_KEY(userId))
  if (current === String(GALLERY_SCHEMA_VERSION)) return
  localStorage.removeItem(KEY(userId))
  localStorage.setItem(SCHEMA_KEY(userId), String(GALLERY_SCHEMA_VERSION))
}

export function saveToGallery(userId, cardData) {
  ensureGallerySchema(userId)
  const cards = loadGallery(userId)
  const card = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    ...cardData,
    savedAt: new Date().toISOString(),
    isNew: true,
    savedFromEditor: true,
  }
  try {
    localStorage.setItem(KEY(userId), JSON.stringify([card, ...cards].slice(0, 40)))
  } catch {
    const trimmed = [card, ...cards].slice(0, 10).map((c) => ({ ...c, thumbnail: undefined }))
    localStorage.setItem(KEY(userId), JSON.stringify(trimmed))
  }
  return card
}

export function loadGallery(userId) {
  if (!userId) return []
  try {
    ensureGallerySchema(userId)
    const cards = JSON.parse(localStorage.getItem(KEY(userId)) || '[]')
    return Array.isArray(cards) ? cards.filter((c) => c?.savedFromEditor === true) : []
  } catch {
    return []
  }
}

export function clearGallery(userId) {
  if (!userId) return
  localStorage.removeItem(KEY(userId))
  localStorage.setItem(SCHEMA_KEY(userId), String(GALLERY_SCHEMA_VERSION))
}

export function deleteFromGallery(userId, cardId) {
  const cards = loadGallery(userId).filter((c) => c.id !== cardId)
  localStorage.setItem(KEY(userId), JSON.stringify(cards))
}

export function markAllSeen(userId) {
  const cards = loadGallery(userId).map((c) => ({ ...c, isNew: false }))
  localStorage.setItem(KEY(userId), JSON.stringify(cards))
}

export function getBestCard(cards) {
  return cards.reduce((best, c) => (!best || c.rank < best.rank ? c : best), null)
}
