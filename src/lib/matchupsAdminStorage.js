/**
 * 매치업 관리 — Supabase `matchups` + 관리자 상태 오버레이(`admin_ui_config`)
 */
import { getAdminUiJson, setAdminUiJson } from './adminUiConfig'
import { getCategoryLabelById } from './categoryAdminStorage'
import { supabase } from './supabase'
import {
  resolveMatchupSideMediaUrl,
  resolveMatchupSideType,
  readMatchupSideText,
} from './matchupSideDisplay'

const KEY_STATUS_OVERRIDES = 'admin_matchup_status_overrides_v1'

const ADMIN_MATCHUP_LIST_SELECT =
  'id, title, category, status, created_at, updated_at, challenger_joined_at, left_label, right_label, is_demo, right_type, expires_at'

const ADMIN_LIST_LIMIT = 500

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'waiting', label: '도전자 대기 (NEW)' },
  { value: 'active', label: '진행 중' },
  { value: 'ended', label: '종료' },
  { value: 'blocked', label: '차단' },
]

const MATCHUP_STATUS_LABEL = {
  waiting: '도전자 대기',
  active: '진행 중',
  ended: '종료',
  blocked: '차단',
}

const EMPTY_AI_VERDICT = {
  score: 0,
  label: '-',
  reason: 'AI 판정 정보 없음.',
}

let _matchupsCache = null
let _warnLogsCache = null
let _suspendLogsCache = null

const KEY_WARN_LOGS = 'admin_matchup_warning_logs_v1'
const KEY_SUSPEND_LOGS = 'admin_matchup_suspension_logs_v1'

export function getMatchupStatusLabel(status) {
  if (status === 'review') return '진행 중'
  return MATCHUP_STATUS_LABEL[status] ?? String(status)
}

function normalizeMatchupStatus(status) {
  return status === 'review' ? 'active' : status
}

export function invalidateMatchupsAdminCache() {
  _matchupsCache = null
}

function formatAdminCreatedAt(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}.${dd} ${hh}:${mi}`
}

function resolveChallengerRegisteredIso(row) {
  if (row.right_type == null) return null
  return row.challenger_joined_at || row.updated_at || row.created_at || null
}

function mapAdminMatchupDates(row) {
  const challengerIso = resolveChallengerRegisteredIso(row)
  return {
    registeredAt: challengerIso ? formatAdminCreatedAt(challengerIso) : '-',
    registeredAtIso: challengerIso,
    authorCreatedAtIso: row.created_at || null,
  }
}

function buildListTitle(row) {
  const title = String(row.title || '').trim()
  if (title) return title
  const left = String(row.left_label || '').trim()
  const right = String(row.right_label || '').trim()
  if (left && right) return `${left} vs ${right}`
  return left || right || '(제목 없음)'
}

async function readStatusOverrides() {
  const remote = await getAdminUiJson(KEY_STATUS_OVERRIDES, {})
  return remote && typeof remote === 'object' && !Array.isArray(remote) ? remote : {}
}

function isVotePeriodExpired(expiresAt) {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  return !Number.isNaN(t) && t <= Date.now()
}

/**
 * 메인 피드 NEW 탭과 동일: active + right_type 없음.
 * expires_at은 생성 시 투표 기간용으로만 저장되며, 도전자 참여 전에는 종료 판정에 쓰지 않음.
 */
function isNewWaitingMatchup(row) {
  if (!row || row.status !== 'active') return false
  return row.right_type == null
}

function mapRowToAdminStatus(row, overrides) {
  const ov = overrides[String(row.id)]
  if (ov === 'blocked') return 'blocked'
  if (ov === 'ended') return 'ended'
  if (row.status === 'closed') return 'ended'
  if (row.status === 'active' && row.right_type == null) {
    return 'waiting'
  }
  if (ov === 'active') return 'active'
  if (row.status === 'active') {
    return isVotePeriodExpired(row.expires_at) ? 'ended' : 'active'
  }
  return 'ended'
}

function adminStatusToDbStatus(adminStatus) {
  if (adminStatus === 'ended' || adminStatus === 'blocked') return 'closed'
  return 'active'
}

async function persistStatusOverride(matchupId, adminStatus) {
  const overrides = await readStatusOverrides()
  const key = String(matchupId)
  if (adminStatus === 'active') {
    delete overrides[key]
  } else {
    overrides[key] = adminStatus
  }
  await setAdminUiJson(KEY_STATUS_OVERRIDES, overrides)
}

async function fetchMatchupsFromSupabase() {
  const overrides = await readStatusOverrides()
  let selectCols = ADMIN_MATCHUP_LIST_SELECT
  let res = await supabase
    .from('matchups')
    .select(selectCols)
    .order('created_at', { ascending: false })
    .limit(ADMIN_LIST_LIMIT)

  if (res.error && /challenger_joined_at/i.test(res.error.message || '')) {
    selectCols = selectCols.replace(', challenger_joined_at', '')
    res = await supabase
      .from('matchups')
      .select(selectCols)
      .order('created_at', { ascending: false })
      .limit(ADMIN_LIST_LIMIT)
  }

  const { data, error } = res
  if (error) {
    console.warn('[matchupsAdminStorage] fetch list', error)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    category: row.category || '',
    categoryLabel: getCategoryLabelById(row.category),
    title: buildListTitle(row),
    reports: 0,
    status: normalizeMatchupStatus(mapRowToAdminStatus(row, overrides)),
    ...mapAdminMatchupDates(row),
    hasChallenger: row.right_type != null,
  }))
}

async function readMatchups() {
  if (_matchupsCache) return _matchupsCache
  _matchupsCache = await fetchMatchupsFromSupabase()
  return _matchupsCache
}

export async function getMatchups({ force = false } = {}) {
  if (force) invalidateMatchupsAdminCache()
  return readMatchups()
}

async function readWarnLogs() {
  if (_warnLogsCache) return _warnLogsCache
  const remote = await getAdminUiJson(KEY_WARN_LOGS, null)
  _warnLogsCache = Array.isArray(remote) ? remote : []
  return _warnLogsCache
}

async function persistWarnLogs(list) {
  await setAdminUiJson(KEY_WARN_LOGS, list)
  _warnLogsCache = list
}

async function readSuspendLogs() {
  if (_suspendLogsCache) return _suspendLogsCache
  const remote = await getAdminUiJson(KEY_SUSPEND_LOGS, null)
  _suspendLogsCache = Array.isArray(remote) ? remote : []
  return _suspendLogsCache
}

async function persistSuspendLogs(list) {
  await setAdminUiJson(KEY_SUSPEND_LOGS, list)
  _suspendLogsCache = list
}

export async function getMatchupAdminWarningLogs(matchupId) {
  const list = await readWarnLogs()
  const filtered = matchupId != null ? list.filter((e) => String(e.matchupId) === String(matchupId)) : list
  return filtered.slice().sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
}

export async function recordMatchupAdminWarningSent(matchupId, meta) {
  const list = [...(await readWarnLogs())]
  list.push({
    matchupId,
    title: meta.title,
    recipientUserIds: meta.recipientUserIds,
    sentAt: new Date().toISOString(),
  })
  await persistWarnLogs(list)
}

export async function getMatchupAdminSuspensionLogs(matchupId) {
  const list = await readSuspendLogs()
  const filtered = matchupId != null ? list.filter((e) => String(e.matchupId) === String(matchupId)) : list
  return filtered.slice().sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
}

export async function recordMatchupAdminSuspensionSent(matchupId, meta) {
  const list = [...(await readSuspendLogs())]
  list.push({
    matchupId,
    title: meta.title,
    recipientUserIds: meta.recipientUserIds,
    restrictionKinds: meta.restrictionKinds ?? ['vote', 'comment', 'matchup_create'],
    periodHours: meta.periodHours ?? 168,
    appliedAt: new Date().toISOString(),
  })
  await persistSuspendLogs(list)
}

export function getReportedParticipantUserIdsForWarning(matchup) {
  const sides = matchup.reportedSides
  if (!Array.isArray(sides) || sides.length === 0) return []
  const ids = []
  if (sides.includes('a') && matchup.userA?.userId) ids.push(matchup.userA.userId)
  if (sides.includes('b') && matchup.userB?.userId) ids.push(matchup.userB.userId)
  return ids
}

async function fetchMatchupDetailFromSupabase(id) {
  const { data: row, error } = await supabase
    .from('matchups')
    .select(
      `id, title, category, status, created_at, updated_at, challenger_joined_at, left_label, right_label, right_type, expires_at,
      left_type, left_text, right_text,
      left_url, left_thumbnail_url, right_url, right_thumbnail_url,
      user_id, right_user_id,
      profiles:user_id(id, nickname, avatar_url),
      right_profiles:right_user_id(id, nickname, avatar_url)`
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !row) return null

  const overrides = await readStatusOverrides()
  const listBase = {
    id: row.id,
    category: row.category || '',
    categoryLabel: getCategoryLabelById(row.category),
    title: buildListTitle(row),
    reports: 0,
    status: normalizeMatchupStatus(mapRowToAdminStatus(row, overrides)),
    ...mapAdminMatchupDates(row),
    hasChallenger: row.right_type != null,
  }

  const hasChallenger = row.right_type != null

  const mapAdminSide = (side) => {
    const isLeft = side === 'left'
    const rawType = isLeft ? row.left_type : row.right_type
    const text = isLeft ? row.left_text : row.right_text
    const url = isLeft ? row.left_url : row.right_url
    const thumb = isLeft ? row.left_thumbnail_url : row.right_thumbnail_url
    const sideType = resolveMatchupSideType(rawType, { text, url, thumbnail: thumb })
    return {
      sideType,
      sideText: readMatchupSideText(sideType, text),
      mediaUrl: resolveMatchupSideMediaUrl(sideType, { url, thumbnail: thumb }),
    }
  }

  const leftSide = mapAdminSide('left')
  const rightSide = hasChallenger ? mapAdminSide('right') : null

  return {
    ...listBase,
    userA: {
      name: row.profiles?.nickname ?? '-',
      imageUrl: leftSide.mediaUrl,
      sideType: leftSide.sideType,
      sideText: leftSide.sideText,
      title: row.left_label ?? '-',
      userId: row.user_id,
    },
    userB: hasChallenger
      ? {
          name: row.right_profiles?.nickname ?? '-',
          imageUrl: rightSide.mediaUrl,
          sideType: rightSide.sideType,
          sideText: rightSide.sideText,
          title: row.right_label ?? '-',
          userId: row.right_user_id,
        }
      : {
          name: null,
          imageUrl: null,
          sideType: null,
          sideText: '',
          title: null,
          userId: null,
        },
    reportedSides: [],
    aiVerdict: { ...EMPTY_AI_VERDICT },
  }
}

export async function getMatchupDetail(id) {
  const sid = String(id || '').trim()
  if (!UUID_RE.test(sid)) return null
  return fetchMatchupDetailFromSupabase(sid)
}

async function applyAdminStatusToSupabase(matchupId, adminStatus) {
  const dbStatus = adminStatusToDbStatus(adminStatus)
  const { error } = await supabase.from('matchups').update({ status: dbStatus }).eq('id', matchupId)
  if (error) {
    console.warn('[matchupsAdminStorage] update status (DB)', error)
  }
  await persistStatusOverride(matchupId, adminStatus)
  invalidateMatchupsAdminCache()
  return true
}

export async function updateMatchupStatus(id, status) {
  if (!UUID_RE.test(String(id))) return false
  return applyAdminStatusToSupabase(id, status)
}

export async function bulkUpdateStatus(ids, status) {
  const validIds = ids.filter((id) => UUID_RE.test(String(id)))
  let count = 0
  for (const id of validIds) {
    const ok = await applyAdminStatusToSupabase(id, status)
    if (ok) count += 1
  }
  return count
}

export async function getMatchupStats() {
  const list = await readMatchups()
  return {
    waiting: list.filter((m) => m.status === 'waiting').length,
    active: list.filter((m) => m.status === 'active').length,
    ended: list.filter((m) => m.status === 'ended').length,
    blocked: list.filter((m) => m.status === 'blocked').length,
  }
}

export { STATUS_OPTIONS }
