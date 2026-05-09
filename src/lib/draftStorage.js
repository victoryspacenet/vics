/**
 * 매치업 임시 저장 (브라우저 종료·네트워크 끊김 대응)
 * - localStorage: 텍스트 필드
 * - IndexedDB: 파일(이미지/영상) - Blob 저장
 */

const STORAGE_KEYS = {
  create: 'vics_draft_create_matchup',
  challenge: 'vics_draft_challenge',
}

/** CreateMatchupDrawer `MAX_TAGS` 와 동일 */
const CREATE_MATCHUP_MAX_TAGS = 3

const IDB_NAME = 'vics_draft'
const IDB_STORE = 'files'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE, { keyPath: 'key' })
    }
  })
}

function saveFileToIDB(key, blob) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const store = tx.objectStore(IDB_STORE)
      store.put({ key, blob, type: blob.type, savedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  })
}

function loadFileFromIDB(key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve(req.result?.blob ?? null)
      req.onerror = () => reject(req.error)
    })
  })
}

function deleteFileFromIDB(key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  })
}

// ── CreateMatchupDrawer draft ──────────────────────────────────────

export function saveCreateMatchupDraft(data, userId) {
  if (!userId || typeof window === 'undefined') return
  const key = `${STORAGE_KEYS.create}_${userId}`

  const draft = {
    title: data.title || '',
    description: data.description || '',
    leftName: data.leftName || '',
    category: data.category || '',
    duration: data.duration || '24',
    tags: Array.isArray(data.tags) ? data.tags.slice(0, CREATE_MATCHUP_MAX_TAGS) : [],
    leftContentType: data.leftContent?.type || null,
    leftContentText: data.leftContent?.type === 'text' ? data.leftContent?.text || '' : '',
    savedAt: Date.now(),
  }

  // 파일이 있으면 IndexedDB에 저장
  const fileKey = `${key}_left_file`
  if (data.leftContent?.file && data.leftContent?.type !== 'text') {
    saveFileToIDB(fileKey, data.leftContent.file).catch(() => {})
  } else {
    deleteFileFromIDB(fileKey).catch(() => {})
  }

  try {
    localStorage.setItem(key, JSON.stringify(draft))
  } catch (e) {
    console.warn('[draftStorage] localStorage full', e)
  }
}

export async function loadCreateMatchupDraft(userId) {
  if (!userId || typeof window === 'undefined') return null
  const key = `${STORAGE_KEYS.create}_${userId}`
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft.savedAt || Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      clearCreateMatchupDraft(userId)
      return null
    }

    let leftContent = null
    if (draft.leftContentType === 'text' && draft.leftContentText) {
      leftContent = { type: 'text', text: draft.leftContentText }
    } else if (draft.leftContentType === 'image' || draft.leftContentType === 'video') {
      const blob = await loadFileFromIDB(`${key}_left_file`)
      if (blob) {
        const ext = blob.type?.includes('video') ? 'mp4' : 'jpg'
        const file = new File([blob], `draft.${ext}`, { type: blob.type })
        const preview = URL.createObjectURL(blob)
        leftContent = { type: draft.leftContentType, file, preview }
      }
    }

    return {
      title: draft.title || '',
      description: draft.description || '',
      leftName: draft.leftName || '',
      category: draft.category || '',
      duration: draft.duration || '24',
      tags: Array.isArray(draft.tags) ? draft.tags.slice(0, CREATE_MATCHUP_MAX_TAGS) : [],
      leftContent,
      hasRestoredFile: !!leftContent?.file,
    }
  } catch {
    return null
  }
}

export function clearCreateMatchupDraft(userId) {
  if (!userId || typeof window === 'undefined') return
  const key = `${STORAGE_KEYS.create}_${userId}`
  try {
    localStorage.removeItem(key)
    deleteFileFromIDB(`${key}_left_file`).catch(() => {})
  } catch {}
}

export function hasCreateMatchupDraft(userId) {
  if (!userId || typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.create}_${userId}`)
    if (!raw) return false
    const d = JSON.parse(raw)
    return d?.savedAt && Date.now() - d.savedAt < 7 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// ── ChallengeDrawer draft ───────────────────────────────────────────

export function saveChallengeDraft(matchupId, data, userId) {
  if (!matchupId || !userId || typeof window === 'undefined') return
  const key = `${STORAGE_KEYS.challenge}_${userId}_${matchupId}`

  const draft = {
    matchupId,
    rightContentType: data.rightContent?.type || null,
    rightContentText: data.rightContent?.type === 'text' ? data.rightContent?.text || '' : '',
    savedAt: Date.now(),
  }

  const fileKey = `${key}_right_file`
  if (data.rightContent?.file && data.rightContent?.type !== 'text') {
    saveFileToIDB(fileKey, data.rightContent.file).catch(() => {})
  } else {
    deleteFileFromIDB(fileKey).catch(() => {})
  }

  try {
    localStorage.setItem(key, JSON.stringify(draft))
  } catch (e) {
    console.warn('[draftStorage] localStorage full', e)
  }
}

export async function loadChallengeDraft(matchupId, userId) {
  if (!matchupId || !userId || typeof window === 'undefined') return null
  const key = `${STORAGE_KEYS.challenge}_${userId}_${matchupId}`
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft.savedAt || Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      clearChallengeDraft(matchupId, userId)
      return null
    }

    let rightContent = null
    if (draft.rightContentType === 'text' && draft.rightContentText) {
      rightContent = { type: 'text', text: draft.rightContentText }
    } else if (draft.rightContentType === 'image' || draft.rightContentType === 'video') {
      const blob = await loadFileFromIDB(`${key}_right_file`)
      if (blob) {
        const ext = blob.type?.includes('video') ? 'mp4' : 'jpg'
        const file = new File([blob], `draft.${ext}`, { type: blob.type })
        const preview = URL.createObjectURL(blob)
        rightContent = { type: draft.rightContentType, file, preview }
      }
    }

    return {
      rightContent,
      hasRestoredFile: !!rightContent?.file,
    }
  } catch {
    return null
  }
}

export function clearChallengeDraft(matchupId, userId) {
  if (!matchupId || !userId || typeof window === 'undefined') return
  const key = `${STORAGE_KEYS.challenge}_${userId}_${matchupId}`
  try {
    localStorage.removeItem(key)
    deleteFileFromIDB(`${key}_right_file`).catch(() => {})
  } catch {}
}

export function hasChallengeDraft(matchupId, userId) {
  if (!matchupId || !userId || typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.challenge}_${userId}_${matchupId}`)
    if (!raw) return false
    const d = JSON.parse(raw)
    return d?.savedAt && Date.now() - d.savedAt < 7 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// ── beforeunload (작성 중 이탈 방지) ─────────────────────────────────

export function setBeforeUnload(hasDraft) {
  if (typeof window === 'undefined') return
  const handler = (e) => {
    if (hasDraft) e.preventDefault()
  }
  if (hasDraft) {
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }
  return () => {}
}
