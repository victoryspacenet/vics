/**
 * 팝업 공지 — Supabase `popup_notices` + `popup_notice_snoozes`
 */
import { supabase } from './supabase'
import { getTier, tierAtLeast } from './tiers'

const POPUP_ROWS_TTL_MS = 5 * 60 * 1000
let popupRowsCache = { key: '', rows: null, fetchedAt: 0 }

export function invalidatePopupNoticeCache() {
  popupRowsCache = { key: '', rows: null, fetchedAt: 0 }
}

function dispatchPopupUpdated() {
  invalidatePopupNoticeCache()
  try {
    window.dispatchEvent(new CustomEvent('vics:popup-notices:updated'))
  } catch {
    void 0
  }
}

async function fetchPopupNoticeRows() {
  const cacheKey = 'active-candidates'
  const now = Date.now()
  if (
    popupRowsCache.key === cacheKey &&
    popupRowsCache.rows &&
    now - popupRowsCache.fetchedAt < POPUP_ROWS_TTL_MS
  ) {
    return popupRowsCache.rows
  }

  let rows = null
  const { data: rpcRows, error: rpcErr } = await supabase.rpc('list_popup_notices_active_candidates')
  if (!rpcErr && Array.isArray(rpcRows)) {
    rows = rpcRows
  } else {
    if (rpcErr) {
      console.warn('[popupNoticeStorage] list_popup_notices_active_candidates:', rpcErr.message)
    }
    const { data, error } = await supabase
      .from('popup_notices')
      .select('id, doc, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('[popupNoticeStorage] list:', error.message)
      return []
    }
    rows = (data || []).filter((row) => {
      const d = row?.doc && typeof row.doc === 'object' ? row.doc : {}
      return d.isActive !== false
    })
  }

  popupRowsCache = { key: cacheKey, rows, fetchedAt: now }
  return rows
}

// ── localStorage 스누즈 (비로그인 폴백 + Race-condition 보호) ──────────────
const LS_SNOOZE_PREFIX = 'vics:popup-snooze-v1:'

function getLocalSnoozes() {
  try {
    const result = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LS_SNOOZE_PREFIX)) {
        const popupId = key.slice(LS_SNOOZE_PREFIX.length)
        result[popupId] = localStorage.getItem(key)
      }
    }
    return result
  } catch {
    return {}
  }
}

function setLocalSnooze(popupId, untilIso) {
  try {
    localStorage.setItem(`${LS_SNOOZE_PREFIX}${String(popupId)}`, untilIso)
  } catch { /* ignore */ }
}

function clearLocalSnooze(popupId) {
  try {
    localStorage.removeItem(`${LS_SNOOZE_PREFIX}${String(popupId)}`)
  } catch { /* ignore */ }
}

function rowToPopup(row) {
  const d = row?.doc && typeof row.doc === 'object' ? row.doc : {}
  return {
    ...d,
    id: row.id,
    updatedAt: row.updated_at,
    createdAt: d.createdAt || row.created_at,
  }
}

function popupToDoc(p) {
  const copy = { ...p }
  delete copy.id
  delete copy.updatedAt
  return copy
}

/** ISO 문자열을 로컬 시간으로 파싱 (브라우저별 호환) */
function parseLocalDate(str) {
  if (!str) return new Date(0)
  const s = String(str).replace(/\.\d{3}Z?$/, '')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})/)
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0)
  }
  const d = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (d) {
    return new Date(+d[1], +d[2] - 1, +d[3], 0, 0, 0)
  }
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? new Date(0) : parsed
}

function parseEndDate(str) {
  if (!str) return new Date(0)
  const s = String(str).replace(/\.\d{3}Z?$/, '')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})/)
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 59)
  }
  const d = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (d) {
    return new Date(+d[1], +d[2] - 1, +d[3], 23, 59, 59)
  }
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? new Date(0) : parsed
}

async function fetchSnoozeMap(userId) {
  if (!userId) return {}
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('popup_notice_snoozes')
    .select('popup_id, snooze_until')
    .eq('user_id', userId)
    .gt('snooze_until', nowIso)
  if (error) {
    console.warn('[popupNoticeStorage] snoozes:', error.message)
    return {}
  }
  const m = {}
  for (const r of data || []) {
    m[r.popup_id] = r.snooze_until
  }
  return m
}

/** 현재 노출 가능한 팝업 목록 */
export async function getActivePopups(user = null, profile = null, rankInfo = null) {
  const rows = await fetchPopupNoticeRows()
  const list = (rows || []).map(rowToPopup)
  const dbDismissed = await fetchSnoozeMap(user?.id)
  // localStorage 스누즈: 비로그인 폴백 + DB 저장 Race-condition 보호
  const localDismissed = getLocalSnoozes()
  const now = new Date()

  return list.filter((p) => {
    if (!p.isActive) return false
    const start = parseLocalDate(p.startAt)
    const end = parseEndDate(p.endAt)
    if (now < start || now > end) return false

    if (p.target === 'new_user') {
      if (!user?.created_at) return false
      const created = new Date(user.created_at)
      if ((now - created) / 86400000 > 7) return false
    }
    if (p.target === 'tier') {
      if (!user || !profile) return false
      const requiredId = p.targetTierId || 'player'
      const userTier = getTier(profile, rankInfo || {})
      if (p.targetTierExact === true) {
        if (userTier.id !== requiredId) return false
      } else if (!tierAtLeast(userTier, requiredId)) {
        return false
      }
    }

    // DB 스누즈 또는 localStorage 스누즈 중 하나라도 유효하면 숨김
    const until = dbDismissed[p.id] || localDismissed[String(p.id)]
    if (until) {
      const u = new Date(until)
      if (u.getTime() > now.getTime()) return false
    }

    return true
  })
}

/** 팝업 닫기 (오늘 하루 보지 않기) */
export async function dismissPopup(popupId, optInDontShow24h = false, userId = null) {
  if (!optInDontShow24h || !popupId) return
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const until = end.toISOString()

  // localStorage에 즉시 기록 (Race-condition 보호 + 비로그인 폴백)
  setLocalSnooze(String(popupId), until)

  // 로그인 사용자는 DB에도 저장
  if (userId) {
    const { error } = await supabase.from('popup_notice_snoozes').upsert(
      {
        user_id: userId,
        popup_id: String(popupId),
        snooze_until: until,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,popup_id' }
    )
    if (error) console.warn('[popupNoticeStorage] dismiss:', error.message)
  }
  dispatchPopupUpdated()
}

export function getImmediateStartAt() {
  const d = new Date()
  d.setHours(Math.max(0, d.getHours() - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
}

/**
 * 즉시 노출 시 종료 시각: 폼에서 넘긴 userEndAt이 시작 이후면 그대로 사용, 아니면 오늘 기준 1개월 후 23:59.
 * @param {string} startAt - getImmediateStartAt() 등
 * @param {string | undefined} userEndAt
 */
export function resolveImmediateEndAt(startAt, userEndAt) {
  const startMs = parseLocalDate(startAt).getTime()
  if (userEndAt && typeof userEndAt === 'string') {
    const endMs = parseEndDate(userEndAt).getTime()
    if (endMs > startMs) return userEndAt
  }
  const end = new Date()
  end.setMonth(end.getMonth() + 1)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T23:59:00`
}

export async function savePopupNotice(data, { silent = false } = {}) {
  const id = data.id || `popup_${Date.now()}`
  let startAt = data.startAt
  let endAt = data.endAt
  if (data.immediate) {
    startAt = getImmediateStartAt()
    endAt = resolveImmediateEndAt(startAt, data.endAt)
  }
  const { data: existingRow } = await supabase.from('popup_notices').select('doc').eq('id', id).maybeSingle()
  const existing = existingRow?.doc ? rowToPopup({ id, doc: existingRow.doc }) : null

  const item = {
    id,
    name: data.name || '',
    isActive: data.isActive !== false,
    startAt,
    endAt,
    target: data.target || 'all',
    targetTierId: data.targetTierId ?? existing?.targetTierId ?? 'player',
    targetTierExact: data.targetTierExact ?? existing?.targetTierExact ?? false,
    frequency: data.frequency || 'every_time',
    imageUrl: data.imageUrl || '',
    linkType: data.linkType || 'notice',
    linkUrl: data.linkUrl || '',
    linkNoticeId: data.linkNoticeId || '',
    linkMatchupId: data.linkMatchupId || '',
    viewCount: existing?.viewCount ?? data.viewCount ?? 0,
    clickCount: existing?.clickCount ?? data.clickCount ?? 0,
    viewByPath: data.viewByPath ?? existing?.viewByPath ?? {},
    clickByPath: data.clickByPath ?? existing?.clickByPath ?? {},
    createdAt: data.createdAt || existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const doc = popupToDoc(item)
  const { error } = await supabase.from('popup_notices').upsert(
    {
      id,
      doc,
      updated_at: item.updatedAt,
    },
    { onConflict: 'id' }
  )
  if (error) {
    console.error('[popupNoticeStorage] save:', error.message)
    throw error
  }
  if (!silent) dispatchPopupUpdated()
  return item
}

export async function getPopupNotices() {
  const { data, error } = await supabase
    .from('popup_notices')
    .select('id, doc, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('[popupNoticeStorage] getPopupNotices:', error.message)
    return []
  }
  return (data || []).map(rowToPopup)
}

export async function clearDismissedAll() {
  // 스누즈는 사용자별이라 전역 초기화는 삭제하지 않음 (관리자 QA용 no-op)
  dispatchPopupUpdated()
}

export async function activateAllPopupsNow() {
  const list = await getPopupNotices()
  for (const p of list) {
    await activatePopupNow(p.id)
  }
  dispatchPopupUpdated()
}

export async function activatePopupNow(id) {
  const list = await getPopupNotices()
  const p = list.find((x) => x.id === id)
  if (!p) return null
  const startAt = getImmediateStartAt()
  const endAt = resolveImmediateEndAt(startAt, p.endAt)
  return savePopupNotice({ ...p, id, isActive: true, immediate: false, startAt, endAt })
}

export async function getPopupNotice(id) {
  const { data, error } = await supabase.from('popup_notices').select('id, doc, created_at, updated_at').eq('id', id).maybeSingle()
  if (error || !data) return null
  return rowToPopup(data)
}

export async function deletePopupNotice(id) {
  const { error } = await supabase.from('popup_notices').delete().eq('id', id)
  if (error) console.error('[popupNoticeStorage] delete:', error.message)
  dispatchPopupUpdated()
}

function normalizePath(path) {
  if (!path || typeof path !== 'string') return '/'
  const s = path.split('?')[0] || '/'
  return s.length > 1 && s.endsWith('/') ? s.slice(0, -1) || '/' : s
}

export async function incrementPopupView(popupId, path) {
  const p = await getPopupNotice(popupId)
  if (!p) return
  p.viewCount = (p.viewCount || 0) + 1
  const key = normalizePath(path)
  if (!p.viewByPath || typeof p.viewByPath !== 'object') p.viewByPath = {}
  p.viewByPath[key] = (p.viewByPath[key] || 0) + 1
  p.updatedAt = new Date().toISOString()
  // silent: 통계 집계는 팝업 목록 재조회를 트리거하지 않음 (Race-condition 방지)
  await savePopupNotice(p, { silent: true })
}

export async function incrementPopupClick(popupId, path) {
  const p = await getPopupNotice(popupId)
  if (!p) return
  p.clickCount = (p.clickCount || 0) + 1
  const key = normalizePath(path)
  if (!p.clickByPath || typeof p.clickByPath !== 'object') p.clickByPath = {}
  p.clickByPath[key] = (p.clickByPath[key] || 0) + 1
  p.updatedAt = new Date().toISOString()
  await savePopupNotice(p, { silent: true })
}

export async function addTestPopup() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(Math.max(0, start.getHours() - 1))
  const end = new Date(now)
  end.setMonth(end.getMonth() + 1)
  const startAt = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}T${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}:00`
  const endAt = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T23:59:00`
  return savePopupNotice({
    name: '테스트 팝업',
    isActive: true,
    startAt,
    endAt,
    target: 'all',
    frequency: 'every_time',
    imageUrl:
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"><rect fill="%2310b981" width="400" height="533"/><text x="200" y="260" font-size="24" fill="white" text-anchor="middle" font-family="sans-serif">테스트 팝업</text></svg>'
      ),
    linkType: 'notice',
    linkUrl: '',
    linkNoticeId: '',
    linkMatchupId: '',
  })
}
