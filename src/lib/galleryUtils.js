const KEY = (uid) => `vics_rank_gallery_${uid}`

export function saveToGallery(userId, cardData) {
  const cards = loadGallery(userId)
  const card = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    ...cardData,
    savedAt: new Date().toISOString(),
    isNew: true,
  }
  try {
    localStorage.setItem(KEY(userId), JSON.stringify([card, ...cards].slice(0, 40)))
  } catch {
    // localStorage 용량 초과 시 오래된 것 제거 후 재시도
    const trimmed = [card, ...cards].slice(0, 10).map(c => ({ ...c, thumbnail: undefined }))
    localStorage.setItem(KEY(userId), JSON.stringify(trimmed))
  }
  return card
}

export function loadGallery(userId) {
  try { return JSON.parse(localStorage.getItem(KEY(userId)) || '[]') } catch { return [] }
}

export function deleteFromGallery(userId, cardId) {
  const cards = loadGallery(userId).filter(c => c.id !== cardId)
  localStorage.setItem(KEY(userId), JSON.stringify(cards))
}

export function markAllSeen(userId) {
  const cards = loadGallery(userId).map(c => ({ ...c, isNew: false }))
  localStorage.setItem(KEY(userId), JSON.stringify(cards))
}

export function getBestCard(cards) {
  return cards.reduce((best, c) => (!best || c.rank < best.rank) ? c : best, null)
}
