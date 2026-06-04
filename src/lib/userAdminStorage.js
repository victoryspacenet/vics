/**
 * 유저 관리 — Supabase `profiles` + 관리자 전용 오버레이(`admin_ui_config` 키 `admin_user_overrides_v1`)
 * 메모: `admin_user_memos_v1`
 */
import { getAdminUiJson, setAdminUiJson } from './adminUiConfig'
import { supabase } from './supabase'

/** @deprecated 레거시 전체 목록 저장(마이그레이션 시 UUID 행만 오버레이로 승격) */
const ADMIN_USERS_KEY = 'admin_users_v1'
const ADMIN_USER_OVERRIDES_KEY = 'admin_user_overrides_v1'
const ADMIN_USER_MEMOS_KEY = 'admin_user_memos_v1'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 관리자 유저 목록·집계에서 제외할 테스트/가상 계정 닉네임 */
export const ADMIN_EXCLUDED_VIRTUAL_USER_NICKNAMES = Object.freeze([
  '수부타이',
  '랜디',
  '레젭',
  '빅스',
])

function isExcludedVirtualAdminUser(rowOrUser) {
  const nick = String(rowOrUser?.nickname ?? '').trim()
  return ADMIN_EXCLUDED_VIRTUAL_USER_NICKNAMES.includes(nick)
}

function applyVirtualUserExclusionToProfileQuery(q) {
  let x = q
  for (const nick of ADMIN_EXCLUDED_VIRTUAL_USER_NICKNAMES) {
    x = x.neq('nickname', nick)
  }
  return x
}

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'caution', label: '주의' },
  { value: 'suspended', label: '정지' },
  { value: 'blocked', label: '차단' },
  { value: 'withdrawn', label: '탈퇴' },
]

const REPORT_SORT_OPTIONS = [
  { value: 'reports_desc', label: '신고 많은 수' },
  { value: 'reports_asc', label: '신고 적은 수' },
]

const ACTIVITY_SORT_OPTIONS = [
  { value: 'created_desc', label: '생성 포인트 높은순' },
  { value: 'created_asc', label: '생성 포인트 낮은순' },
  { value: 'votes_desc', label: '투표 포인트 높은순' },
  { value: 'votes_asc', label: '투표 포인트 낮은순' },
]

const MOCK_USERS = [
  { id: 'u1', nickname: '홍대고양이',   email: 'user1@example.com',   matchupResultPoints: 2400, voteParticipationPoints: 3600, points: 6000, mannerScore: 98,   matchupsCreated: 152, totalVotes: 1200, matchupsTotal: 152, matchupsWins: 80, matchupsLosses: 72, voteWins: 720, voteLosses: 480, reportsCount: 0,  status: 'active',    joinedAt: '2026.01.15', social: '카카오 연동' },
  { id: 'u3', nickname: '스팸마스터',   email: 'user3@example.com',   matchupResultPoints: 0,    voteParticipationPoints: 0,    points: 0,    mannerScore: null, matchupsCreated: 0,   totalVotes: 0,    matchupsTotal: 0,   matchupsWins: 0,  matchupsLosses: 0,  voteWins: 0,   voteLosses: 0,   reportsCount: 12, status: 'suspended', joinedAt: '2026.01.10', social: '이메일' },
  { id: 'u7', nickname: '영구차단데모', email: 'blocked@example.com', matchupResultPoints: 100,  voteParticipationPoints: 50,   points: 150,  mannerScore: 20,   matchupsCreated: 1,   totalVotes: 5,    matchupsTotal: 1,   matchupsWins: 0,  matchupsLosses: 1,  voteWins: 2,   voteLosses: 3,   reportsCount: 0,  status: 'blocked',   joinedAt: '2026.02.01', social: '카카오 연동' },
  { id: 'u6', nickname: '탈퇴했어요',   email: 'user6@example.com',   matchupResultPoints: 160,  voteParticipationPoints: 240,  points: 400,  mannerScore: 45,   matchupsCreated: 12,  totalVotes: 80,   matchupsTotal: 12,  matchupsWins: 6,  matchupsLosses: 6,  voteWins: 45,  voteLosses: 35,  reportsCount: 3,  status: 'withdrawn', joinedAt: '2025.12.01', social: '카카오 연동' },
]

const MOCK_USER_DETAILS = {
  u1: {
    totalVotes: 1200,
    voteParticipationPoints: 3600,
    matchupResultPoints: 2400,
    topCategories: ['패션', '음식'],
    matchupsCreated: 152,
    reportReasons: {},
    sanctions: [],
    adminMemo: '',
  },
  u3: {
    totalVotes: 0,
    voteParticipationPoints: 0,
    matchupResultPoints: 0,
    topCategories: [],
    matchupsCreated: 0,
    reportReasons: { 광고: 10, 도배: 2 },
    sanctions: [],
    adminMemo: '',
  },
  u7: { totalVotes: 5,  voteParticipationPoints: 50,  matchupResultPoints: 100, topCategories: [],             matchupsCreated: 1,  reportReasons: {}, sanctions: [], adminMemo: '' },
  u6: { totalVotes: 80, voteParticipationPoints: 240, matchupResultPoints: 160, topCategories: [],             matchupsCreated: 12, reportReasons: {}, sanctions: [], adminMemo: '' },
}

/** 관리자 UI용 profiles 컬럼 (없는 컬럼이면 fetchProfilesForAdmin에서 축소 재시도) */
const PROFILE_ADMIN_FIELDS_FULL =
  'id, nickname, email, points, oracle_points, creator_wins, total_matchups, total_votes_received, vote_total, vote_hits, wins, losses, reports_received_count, created_at'

const PROFILE_ADMIN_FIELDS_MIN =
  'id, nickname, email, points, total_matchups, wins, losses, reports_received_count, created_at'

/** 목록 전용 — 상세·수정에 필요한 컬럼은 `getUserDetail` 등에서 조회 */
const PROFILE_ADMIN_LIST_FIELDS = PROFILE_ADMIN_FIELDS_FULL

const NON_ACTIVE_ID_NOT_IN_MAX = 320

function escapeIlikeUserSearch(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

function ilikeOrNicknameEmail(trimmed) {
  const inner = `%${escapeIlikeUserSearch(trimmed)}%`.replace(/"/g, '""')
  const q = `"${inner}"`
  return `nickname.ilike.${q},email.ilike.${q}`
}

function effectiveUserStatus(overrides, id) {
  const o = overrides[id]
  if (!o || typeof o.status !== 'string') return 'active'
  if (o.status === 'caution' && typeof o.cautionUntil === 'number' && o.cautionUntil <= Date.now()) {
    return 'active'
  }
  return o.status
}

function collectIdsWithEffectiveStatus(overrides, targetStatus) {
  const ids = []
  for (const id of Object.keys(overrides)) {
    if (!UUID_RE.test(String(id))) continue
    if (effectiveUserStatus(overrides, id) === targetStatus) ids.push(id)
  }
  return ids
}

function collectNonActiveIds(overrides) {
  const ids = []
  for (const id of Object.keys(overrides)) {
    if (!UUID_RE.test(String(id))) continue
    if (effectiveUserStatus(overrides, id) !== 'active') ids.push(id)
  }
  return ids
}

function compareAdminUsers(a, b, sortBy) {
  if (sortBy === 'reports_desc') return (b.reportsCount ?? 0) - (a.reportsCount ?? 0)
  if (sortBy === 'reports_asc') return (a.reportsCount ?? 0) - (b.reportsCount ?? 0)
  if (sortBy === 'created_desc') return (b.matchupResultPoints ?? 0) - (a.matchupResultPoints ?? 0)
  if (sortBy === 'created_asc') return (a.matchupResultPoints ?? 0) - (b.matchupResultPoints ?? 0)
  if (sortBy === 'votes_desc') return (b.voteParticipationPoints ?? 0) - (a.voteParticipationPoints ?? 0)
  if (sortBy === 'votes_asc') return (a.voteParticipationPoints ?? 0) - (b.voteParticipationPoints ?? 0)
  return 0
}

function tieBreakUsers(a, b) {
  return String(a.id).localeCompare(String(b.id))
}

function sortAdminUsersInPlace(list, sortBy) {
  if (!sortBy) {
    list.sort((a, b) => {
      const ta = String(a.__sortCreatedAt || '')
      const tb = String(b.__sortCreatedAt || '')
      if (ta !== tb) return tb.localeCompare(ta)
      return tieBreakUsers(a, b)
    })
    return
  }
  list.sort((a, b) => {
    const d = compareAdminUsers(a, b, sortBy)
    if (d !== 0) return d
    return tieBreakUsers(a, b)
  })
}

function applyProfileSortToQuery(q, sortBy) {
  switch (sortBy) {
    case 'reports_desc':
      return q.order('reports_received_count', { ascending: false }).order('id', { ascending: true })
    case 'reports_asc':
      return q.order('reports_received_count', { ascending: true }).order('id', { ascending: true })
    case 'votes_desc':
      return q.order('oracle_points', { ascending: false }).order('id', { ascending: true })
    case 'votes_asc':
      return q.order('oracle_points', { ascending: true }).order('id', { ascending: true })
    case 'created_desc':
      return q
        .order('total_matchups', { ascending: false })
        .order('creator_wins', { ascending: false })
        .order('id', { ascending: true })
    case 'created_asc':
      return q
        .order('total_matchups', { ascending: true })
        .order('creator_wins', { ascending: true })
        .order('id', { ascending: true })
    default:
      return q.order('created_at', { ascending: false }).order('id', { ascending: true })
  }
}

function applyProfileSortToQueryMin(q, sortBy) {
  switch (sortBy) {
    case 'reports_desc':
      return q.order('reports_received_count', { ascending: false }).order('id', { ascending: true })
    case 'reports_asc':
      return q.order('reports_received_count', { ascending: true }).order('id', { ascending: true })
    case 'votes_desc':
      return q.order('points', { ascending: false }).order('id', { ascending: true })
    case 'votes_asc':
      return q.order('points', { ascending: true }).order('id', { ascending: true })
    case 'created_desc':
      return q
        .order('total_matchups', { ascending: false })
        .order('wins', { ascending: false })
        .order('id', { ascending: true })
    case 'created_asc':
      return q
        .order('total_matchups', { ascending: true })
        .order('wins', { ascending: true })
        .order('id', { ascending: true })
    default:
      return q.order('created_at', { ascending: false }).order('id', { ascending: true })
  }
}

async function runProfilePagedQuery(cols, applyFilters, sortBy, from, to, useMinSort) {
  let q = supabase.from('profiles').select(cols, { count: 'exact' })
  q = applyFilters(q)
  q = useMinSort ? applyProfileSortToQueryMin(q, sortBy) : applyProfileSortToQuery(q, sortBy)
  const { data, error, count } = await q.range(from, to)
  return { data, error, count }
}

function filterUsersBySearch(list, searchRaw) {
  const q = String(searchRaw || '').trim().toLowerCase()
  const base = list.filter((u) => !isExcludedVirtualAdminUser(u))
  if (!q) return base
  return base.filter(
    (u) =>
      (u.nickname || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q),
  )
}

function stripAdminListSortMeta(u) {
  const { __sortCreatedAt, ...rest } = u
  return rest
}

async function getUsersLegacyPagedSnapshot({ page, pageSize, searchTrim, statusFilter, sortBy }) {
  const full = await readUsers()
  let list = statusFilter === 'all' || !statusFilter ? [...full] : full.filter((u) => u.status === statusFilter)
  list = filterUsersBySearch(list, searchTrim)
  sortAdminUsersInPlace(list, sortBy)
  const totalCount = list.length
  const start = (page - 1) * pageSize
  const slice = list.slice(start, start + pageSize).map(stripAdminListSortMeta)
  return { users: slice, totalCount, usedFullListFallback: true }
}

function rowsToDecoratedAdminUsers(rows, overrides) {
  return (rows || [])
    .filter((row) => !isExcludedVirtualAdminUser(row))
    .map((row) => ({
      ...mapProfileRowToAdminUser(row, overrides[row.id] || {}),
      __sortCreatedAt: row.created_at || '',
    }))
}

/**
 * 유저 관리 목록 — Supabase 서버 페이징·정렬 + 오버레이 상태.
 * (profiles 테이블이 비어 있는 데모 모드에서만 전체 스냅샷)
 * @param {{ page?: number; pageSize?: number; searchTrim?: string; statusFilter?: string; sortBy?: string }} opts
 * @returns {Promise<{ users: object[]; totalCount: number; usedFullListFallback?: boolean }>}
 */
export async function getUsersPaged({
  page = 1,
  pageSize = 10,
  searchTrim = '',
  statusFilter = 'all',
  sortBy = '',
} = {}) {
  const safeSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize)) || 10))
  const safePage = Math.max(1, Math.floor(Number(page)) || 1)
  const from = (safePage - 1) * safeSize
  const to = from + safeSize - 1
  const search = String(searchTrim || '').trim().slice(0, 120)

  const presence = await getProfilesTablePresence()
  if (presence === 'none') {
    return getUsersLegacyPagedSnapshot({
      page: safePage,
      pageSize: safeSize,
      searchTrim: search,
      statusFilter,
      sortBy,
    })
  }

  let overrides = await readOverridesById()
  overrides = await resolveExpiredCautionInOverrides(overrides)

  const statusKey = statusFilter === 'all' || !statusFilter ? 'all' : statusFilter

  if (statusKey !== 'all' && statusKey !== 'active') {
    const ids = collectIdsWithEffectiveStatus(overrides, statusKey)
    if (ids.length === 0) {
      return { users: [], totalCount: 0, usedFullListFallback: false }
    }

    const tryCols = async (cols) => {
      const rows = await fetchProfilesByIdsChunked(ids, cols)
      let decorated = rowsToDecoratedAdminUsers(rows, overrides)
      decorated = filterUsersBySearch(decorated, search)
      sortAdminUsersInPlace(decorated, sortBy)
      const totalCount = decorated.length
      const start = (safePage - 1) * safeSize
      const slice = decorated.slice(start, start + safeSize).map(stripAdminListSortMeta)
      return { users: slice, totalCount }
    }

    try {
      return { ...(await tryCols(PROFILE_ADMIN_LIST_FIELDS)), usedFullListFallback: false }
    } catch (e) {
      console.warn('[userAdminStorage] getUsersPaged status subset full cols:', e?.message || e)
      try {
        return { ...(await tryCols(PROFILE_ADMIN_FIELDS_MIN)), usedFullListFallback: false }
      } catch (e2) {
        console.warn('[userAdminStorage] getUsersPaged status subset min cols:', e2?.message || e2)
        return { users: [], totalCount: 0, usedFullListFallback: false }
      }
    }
  }

  const applyFilters = (q) => {
    let x = applyVirtualUserExclusionToProfileQuery(q)
    if (statusKey === 'active') {
      const raw = collectNonActiveIds(overrides)
      const capped = raw.slice(0, NON_ACTIVE_ID_NOT_IN_MAX)
      if (raw.length > NON_ACTIVE_ID_NOT_IN_MAX) {
        console.warn('[userAdminStorage] active filter: non-active id cap', raw.length)
      }
      if (capped.length) {
        x = x.not('id', 'in', `(${capped.join(',')})`)
      }
    }
    if (search) {
      x = x.or(ilikeOrNicknameEmail(search))
    }
    return x
  }

  try {
    const { data, error, count } = await runProfilePagedQuery(
      PROFILE_ADMIN_LIST_FIELDS,
      applyFilters,
      sortBy,
      from,
      to,
      false,
    )
    if (!error) {
      return {
        users: (data || []).map((row) =>
          stripAdminListSortMeta(rowsToDecoratedAdminUsers([row], overrides)[0]),
        ),
        totalCount: typeof count === 'number' ? count : 0,
        usedFullListFallback: false,
      }
    }
    console.warn('[userAdminStorage] getUsersPaged list full cols:', error.message)
  } catch (e) {
    console.warn('[userAdminStorage] getUsersPaged list full cols:', e?.message || e)
  }

  try {
    const { data, error, count } = await runProfilePagedQuery(
      PROFILE_ADMIN_FIELDS_MIN,
      applyFilters,
      sortBy,
      from,
      to,
      true,
    )
    if (error) throw error
    return {
      users: (data || []).map((row) =>
        stripAdminListSortMeta(rowsToDecoratedAdminUsers([row], overrides)[0]),
      ),
      totalCount: typeof count === 'number' ? count : 0,
      usedFullListFallback: false,
    }
  } catch (e2) {
    console.warn('[userAdminStorage] getUsersPaged list min cols:', e2?.message || e2)
    if (presence === 'none') {
      return getUsersLegacyPagedSnapshot({
        page: safePage,
        pageSize: safeSize,
        searchTrim: search,
        statusFilter: statusKey,
        sortBy,
      })
    }
    return { users: [], totalCount: 0, usedFullListFallback: false }
  }
}

async function fetchProfilesByIdsChunked(ids, cols) {
  const uniq = [...new Set(ids.map(String))]
  const rows = []
  const CH = 120
  for (let i = 0; i < uniq.length; i += CH) {
    const slice = uniq.slice(i, i + CH)
    if (!slice.length) continue
    const { data, error } = await supabase.from('profiles').select(cols).in('id', slice)
    if (error) throw error
    if (Array.isArray(data)) rows.push(...data)
  }
  return rows
}

/**
 * profiles 행 존재 여부 — `select().limit(1)` 실패 시 빈 테이블로 오인하면 데모 목록으로 떨어져
 * 실제 가입자가 관리자 UI에서 사라질 수 있어, head count로 구분합니다.
 * @returns {Promise<'none' | 'some' | 'unknown'>}
 */
async function getProfilesTablePresence() {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
  if (error) {
    console.warn('[userAdminStorage] getProfilesTablePresence:', error.message)
    return 'unknown'
  }
  return (count ?? 0) > 0 ? 'some' : 'none'
}

let _usersMemCache = null
let _memosMemCache = null

function normalizeUserRow(u) {
  const seed = MOCK_USERS.find((s) => s.id === u.id)
  const base = seed ? { ...seed, ...u } : { ...u }
  if (typeof base.points !== 'number') {
    base.points = typeof seed?.points === 'number' ? seed.points : 0
  }
  if (base.mannerScore === undefined && seed) base.mannerScore = seed.mannerScore
  if (typeof base.matchupsCreated !== 'number') {
    base.matchupsCreated = typeof seed?.matchupsCreated === 'number' ? seed.matchupsCreated : 0
  }
  if (typeof base.totalVotes !== 'number') {
    base.totalVotes = typeof seed?.totalVotes === 'number' ? seed.totalVotes : 0
  }
  if (typeof base.matchupResultPoints !== 'number') {
    base.matchupResultPoints = typeof seed?.matchupResultPoints === 'number' ? seed.matchupResultPoints : 0
  }
  if (typeof base.voteParticipationPoints !== 'number') {
    base.voteParticipationPoints = typeof seed?.voteParticipationPoints === 'number' ? seed.voteParticipationPoints : 0
  }
  if (typeof base.voteWins !== 'number') {
    base.voteWins = typeof seed?.voteWins === 'number' ? seed.voteWins : 0
  }
  if (typeof base.voteLosses !== 'number') {
    base.voteLosses = typeof seed?.voteLosses === 'number' ? seed.voteLosses : 0
  }
  return base
}

function formatJoinedAt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function pickOverlayFields(row) {
  const o = {}
  if (row.status) o.status = row.status
  if (typeof row.cautionUntil === 'number') o.cautionUntil = row.cautionUntil
  if (typeof row.reportsCount === 'number') o.reportsCount = row.reportsCount
  if (row.mannerScore !== undefined && row.mannerScore !== null) o.mannerScore = row.mannerScore
  return o
}

/**
 * @param {Record<string, unknown>} row — Supabase profiles 행
 * @param {Record<string, unknown>} overlay — 관리자 오버레이
 */
function mapProfileRowToAdminUser(row, overlay = {}) {
  const pts = Math.max(0, Math.floor(Number(row.points) || 0))
  const oracle = Math.max(0, Math.floor(Number(row.oracle_points) || 0))
  const champPts = Math.max(0, pts - oracle)
  const totalMatchups = Math.max(0, Math.floor(Number(row.total_matchups) || 0))
  const cw = Math.floor(Number(row.creator_wins ?? row.wins ?? 0)) || 0
  const voteTotal = Math.max(0, Math.floor(Number(row.vote_total) || 0))
  const voteHits = Math.max(0, Math.floor(Number(row.vote_hits) || 0))
  const totalVotesRec = Math.max(0, Math.floor(Number(row.total_votes_received) || 0))

  const status = typeof overlay.status === 'string' ? overlay.status : 'active'
  const cautionUntil = typeof overlay.cautionUntil === 'number' ? overlay.cautionUntil : undefined
  const dbReports = Math.max(0, Math.floor(Number(row.reports_received_count) || 0))
  const reportsCount = typeof overlay.reportsCount === 'number' ? overlay.reportsCount : dbReports
  const mannerScore =
    overlay.mannerScore !== undefined && overlay.mannerScore !== null ? overlay.mannerScore : null

  return {
    id: row.id,
    nickname: row.nickname || '',
    email: row.email || '',
    matchupResultPoints: champPts,
    voteParticipationPoints: oracle,
    points: pts,
    mannerScore,
    matchupsCreated: totalMatchups,
    totalVotes: totalVotesRec,
    matchupsTotal: totalMatchups,
    matchupsWins: cw,
    matchupsLosses: Math.max(0, totalMatchups - cw),
    voteWins: voteHits,
    voteLosses: Math.max(0, voteTotal - voteHits),
    reportsCount,
    status,
    ...(cautionUntil !== undefined ? { cautionUntil } : {}),
    joinedAt: formatJoinedAt(row.created_at),
    social: '앱',
  }
}

async function readOverridesById() {
  const direct = await getAdminUiJson(ADMIN_USER_OVERRIDES_KEY, null)
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return { ...direct }
  }

  const migrated = {}
  const legacy = await getAdminUiJson(ADMIN_USERS_KEY, null)
  if (Array.isArray(legacy)) {
    for (const row of legacy) {
      if (row?.id && UUID_RE.test(String(row.id))) {
        migrated[row.id] = pickOverlayFields(row)
      }
    }
  }
  if (Object.keys(migrated).length > 0) {
    await setAdminUiJson(ADMIN_USER_OVERRIDES_KEY, migrated)
  }
  return migrated
}

async function persistOverrides(byId) {
  await setAdminUiJson(ADMIN_USER_OVERRIDES_KEY, byId)
}

async function resolveExpiredCautionInOverrides(overrides) {
  const now = Date.now()
  const next = { ...overrides }
  let changed = false
  for (const [id, o] of Object.entries(next)) {
    if (o?.status === 'caution' && typeof o.cautionUntil === 'number' && o.cautionUntil <= now) {
      const { cautionUntil: _c, ...rest } = o
      next[id] = { ...rest, status: 'active' }
      changed = true
    }
  }
  if (changed) {
    await persistOverrides(next)
  }
  return next
}

/** profiles 테이블이 비었을 때만 쓰는 데모 목록용 */
async function resolveExpiredCautionLegacy(users) {
  const now = Date.now()
  let changed = false
  const next = users.map((u) => {
    if (u.status === 'caution' && typeof u.cautionUntil === 'number' && u.cautionUntil <= now) {
      changed = true
      const { cautionUntil: _c, ...rest } = u
      return { ...rest, status: 'active' }
    }
    return u
  })
  if (changed) {
    await setAdminUiJson(ADMIN_USERS_KEY, next)
  }
  return next
}

async function fetchProfilesForAdmin() {
  const trySelect = async (cols) => {
    let q = supabase.from('profiles').select(cols)
    q = applyVirtualUserExclusionToProfileQuery(q)
    const { data, error } = await q.order('created_at', { ascending: false })
    return { data, error }
  }

  const full = await trySelect(PROFILE_ADMIN_FIELDS_FULL)
  if (!full.error) {
    return (Array.isArray(full.data) ? full.data : []).filter((row) => !isExcludedVirtualAdminUser(row))
  }

  console.warn('[userAdminStorage] profiles full select failed, retry minimal:', full.error.message)
  const min = await trySelect(PROFILE_ADMIN_FIELDS_MIN)
  if (min.error) {
    console.warn('[userAdminStorage] profiles minimal select failed:', min.error.message)
    return []
  }
  return (Array.isArray(min.data) ? min.data : []).filter((row) => !isExcludedVirtualAdminUser(row))
}

function invalidateUserListCache() {
  _usersMemCache = null
  try {
    window.dispatchEvent(new CustomEvent('vics:adminUsers:updated'))
  } catch {
    /* ignore */
  }
}

async function readUsers() {
  if (_usersMemCache) return _usersMemCache

  let overrides = await readOverridesById()
  overrides = await resolveExpiredCautionInOverrides(overrides)

  const profiles = await fetchProfilesForAdmin()
  if (profiles.length > 0) {
    const list = profiles.map((row) => mapProfileRowToAdminUser(row, overrides[row.id] || {}))
    _usersMemCache = list
    return list
  }

  const presence = await getProfilesTablePresence()
  if (presence !== 'none') {
    _usersMemCache = []
    return []
  }

  const remote = await getAdminUiJson(ADMIN_USERS_KEY, null)
  let list =
    Array.isArray(remote) && remote.length > 0
      ? remote.map(normalizeUserRow)
      : JSON.parse(JSON.stringify(MOCK_USERS))
  list = await resolveExpiredCautionLegacy(list)
  _usersMemCache = list
  return list
}

/** 가상·시드 닉네임 제외 profiles 건수 (대시보드 등) */
export async function countAllProfiles() {
  try {
    let q = supabase.from('profiles').select('id', { count: 'exact', head: true })
    q = applyVirtualUserExclusionToProfileQuery(q)
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  } catch (e) {
    console.warn('[userAdminStorage] countAllProfiles', e)
    return null
  }
}

/**
 * 관리자 대시보드 회원 집계
 * @returns {Promise<{ totalMembers: number|null; withdrawnMembers: number|null; usedRpc: boolean }>}
 */
export async function fetchAdminMemberStats() {
  try {
    const { data, error } = await supabase.rpc('get_admin_member_stats')
    if (!error && data && typeof data === 'object') {
      const total =
        typeof data.total_members === 'number' ? data.total_members : Number(data.total_members)
      const withdrawn =
        typeof data.withdrawn_members === 'number'
          ? data.withdrawn_members
          : Number(data.withdrawn_members)
      return {
        totalMembers: Number.isFinite(total) ? total : null,
        withdrawnMembers: Number.isFinite(withdrawn) ? withdrawn : null,
        usedRpc: true,
      }
    }
    if (error) throw error
  } catch (e) {
    console.warn('[userAdminStorage] fetchAdminMemberStats rpc:', e?.message || e)
  }

  const totalMembers = await countAllProfiles()
  return { totalMembers, withdrawnMembers: null, usedRpc: false }
}

/** 오늘 00:00 이후 생성된 프로필 수 (대시보드 등) */
export async function countProfilesCreatedSince(isoStart) {
  try {
    let q = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', isoStart)
    q = applyVirtualUserExclusionToProfileQuery(q)
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  } catch (e) {
    console.warn('[userAdminStorage] countProfilesCreatedSince', e)
    return null
  }
}

/** 전체 유저 목록 */
export async function getUsers() {
  return readUsers()
}

export async function getUserDetail(id) {
  const savedMemos = await getAdminMemos(id)
  const buildResult = (user, detailBase) => {
    const detail = detailBase || {
      totalVotes: user.totalVotes ?? 0,
      voteParticipationPoints: user.voteParticipationPoints ?? 0,
      matchupResultPoints: user.matchupResultPoints ?? 0,
      topCategories: [],
      matchupsCreated: user.matchupsCreated ?? 0,
      reportReasons: {},
      sanctions: [],
      adminMemo: '',
    }
    const adminMemo =
      savedMemos.length > 0
        ? savedMemos.map((m) => `[${m.date}] ${m.text}`).join('\n\n')
        : detail.adminMemo || ''
    return { ...detail, ...user, adminMemo }
  }

  if (UUID_RE.test(String(id))) {
    let overrides = await readOverridesById()
    overrides = await resolveExpiredCautionInOverrides(overrides)

    const tryOne = async (cols) => {
      const { data, error } = await supabase.from('profiles').select(cols).eq('id', id).maybeSingle()
      return { data, error }
    }
    let row = null
    const full = await tryOne(PROFILE_ADMIN_FIELDS_FULL)
    if (!full.error && full.data) {
      row = full.data
    } else {
      if (full.error) {
        console.warn('[userAdminStorage] getUserDetail profile select:', full.error.message)
      }
      const min = await tryOne(PROFILE_ADMIN_FIELDS_MIN)
      if (!min.error && min.data) row = min.data
    }
    if (row) {
      if (isExcludedVirtualAdminUser(row)) return null
      const user = mapProfileRowToAdminUser(row, overrides[id] || {})
      const detail = MOCK_USER_DETAILS[user.id] || null
      return buildResult(user, detail)
    }
  }

  const users = await readUsers()
  const user = users.find((u) => u.id === id)
  if (!user) return null
  const detail = MOCK_USER_DETAILS[user.id] || {
    totalVotes: user.totalVotes ?? 0,
    voteParticipationPoints: user.voteParticipationPoints ?? 0,
    matchupResultPoints: user.matchupResultPoints ?? 0,
    topCategories: [],
    matchupsCreated: user.matchupsCreated ?? 0,
    reportReasons: {},
    sanctions: [],
    adminMemo: '',
  }
  return buildResult(user, detail)
}

export async function updateUserStatus(id, status) {
  invalidateUserListCache()
  let users = await readUsers()
  const idx = users.findIndex((u) => u.id === id)
  if (idx < 0) return null

  if (UUID_RE.test(String(id))) {
    const overrides = await readOverridesById()
    const prev = overrides[id] || {}
    const nextOv = { ...overrides, [id]: { ...prev, status } }
    if (status !== 'caution') {
      delete nextOv[id].cautionUntil
    }
    await persistOverrides(nextOv)
    invalidateUserListCache()
    users = await readUsers()
    return users.find((u) => u.id === id) ?? null
  }

  const next = users.map((u, i) => {
    if (i !== idx) return u
    const copy = { ...u, status }
    if (status !== 'caution') delete copy.cautionUntil
    return copy
  })
  await setAdminUiJson(ADMIN_USERS_KEY, next)
  _usersMemCache = next
  return next[idx]
}

/**
 * 이용 제한 기간 동안 상태를 주의로.
 */
export async function setCautionForPeriod(userId, periodEndMs) {
  if (typeof periodEndMs !== 'number' || !Number.isFinite(periodEndMs)) return null
  invalidateUserListCache()
  let users = await readUsers()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx < 0) return null
  const u = users[idx]
  if (u.status === 'suspended' || u.status === 'withdrawn' || u.status === 'blocked') return null

  if (UUID_RE.test(String(userId))) {
    const overrides = await readOverridesById()
    const prev = overrides[userId] || {}
    const prevEnd =
      typeof prev.cautionUntil === 'number'
        ? prev.cautionUntil
        : typeof u.cautionUntil === 'number'
          ? u.cautionUntil
          : 0
    const nextOv = {
      ...overrides,
      [userId]: {
        ...prev,
        status: 'caution',
        cautionUntil: Math.max(prevEnd, periodEndMs),
      },
    }
    await persistOverrides(nextOv)
    invalidateUserListCache()
    return (await readUsers()).find((row) => row.id === userId) ?? null
  }

  const prevEnd = typeof u.cautionUntil === 'number' ? u.cautionUntil : 0
  const next = users.map((row, i) =>
    i === idx
      ? { ...row, status: 'caution', cautionUntil: Math.max(prevEnd, periodEndMs) }
      : row
  )
  await setAdminUiJson(ADMIN_USERS_KEY, next)
  _usersMemCache = next
  return next[idx]
}

export const REVOKE_POINTS_MODES = [
  { id: 'vote_only', label: '투표 참여 포인트만' },
  { id: 'matchup_only', label: '생성(매치업) 포인트만' },
]

export async function revokeActivityPoints(userId, amountP, mode = 'vote_only') {
  const n = Math.floor(Number(amountP))
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'invalid' }

  let row = null
  const sel1 = await supabase.from('profiles').select('points, oracle_points').eq('id', userId).maybeSingle()
  if (!sel1.error && sel1.data) {
    row = sel1.data
  } else if (sel1.error) {
    console.warn('[userAdminStorage] revoke select (retry without oracle_points)', sel1.error.message)
    const sel2 = await supabase.from('profiles').select('points').eq('id', userId).maybeSingle()
    if (!sel2.error && sel2.data) {
      row = { points: sel2.data.points, oracle_points: 0 }
    } else if (sel2.error) {
      console.warn('[userAdminStorage] revoke select', sel2.error.message)
    }
  }

  if (!row) {
    invalidateUserListCache()
    const users = await readUsers()
    const idx = users.findIndex((u) => u.id === userId)
    if (idx < 0) return { ok: false, error: 'not_found' }
    const u = users[idx]
    let vp = Math.max(0, Math.floor(Number(u.voteParticipationPoints) || 0))
    let mp = Math.max(0, Math.floor(Number(u.matchupResultPoints) || 0))
    const oldVp = vp
    const oldMp = mp
    if (mode === 'matchup_only') {
      const cut = Math.min(n, mp)
      mp -= cut
    } else {
      const cut = Math.min(n, vp)
      vp -= cut
    }
    const revoked = oldVp - vp + (oldMp - mp)
    const next = users.map((r, i) =>
      i === idx
        ? {
            ...r,
            voteParticipationPoints: vp,
            matchupResultPoints: mp,
            points: vp + mp,
          }
        : r
    )
    await setAdminUiJson(ADMIN_USERS_KEY, next)
    _usersMemCache = next
    const uu = next[idx]
    return {
      ok: true,
      revoked,
      totalAfter: uu.points,
      voteAfter: vp,
      matchupAfter: mp,
    }
  }

  let pts = Math.max(0, Math.floor(Number(row.points) || 0))
  let oracle = Math.max(0, Math.floor(Number(row.oracle_points) || 0))
  if (oracle > pts) oracle = pts

  const champ = pts - oracle
  let cut = 0
  if (mode === 'matchup_only') {
    cut = Math.min(n, champ)
    pts = Math.max(0, pts - cut)
  } else {
    cut = Math.min(n, oracle)
    oracle = Math.max(0, oracle - cut)
    pts = Math.max(0, pts - cut)
  }

  const patch = { points: pts, oracle_points: oracle, updated_at: new Date().toISOString() }

  const { error: upErr } = await supabase.from('profiles').update(patch).eq('id', userId)

  if (upErr) {
    console.warn('[userAdminStorage] revoke update', upErr.message)
    return { ok: false, error: 'update_failed' }
  }

  invalidateUserListCache()
  return {
    ok: true,
    revoked: cut,
    totalAfter: pts,
    voteAfter: oracle,
    matchupAfter: Math.max(0, pts - oracle),
  }
}

async function readMemosMap() {
  if (_memosMemCache) return _memosMemCache
  const raw = await getAdminUiJson(ADMIN_USER_MEMOS_KEY, {})
  _memosMemCache = raw && typeof raw === 'object' ? raw : {}
  return _memosMemCache
}

async function persistMemosMap(map) {
  _memosMemCache = map
  await setAdminUiJson(ADMIN_USER_MEMOS_KEY, map)
}

export async function getAdminMemos(id) {
  const map = await readMemosMap()
  const entry = map[id]
  if (!entry) return []
  if (Array.isArray(entry.memos)) return entry.memos
  if (entry.memo && typeof entry.memo === 'string') {
    return [{ date: new Date().toISOString().slice(0, 10), text: entry.memo }]
  }
  return []
}

export async function addAdminMemo(id, text) {
  if (!text?.trim()) return false
  const map = { ...(await readMemosMap()) }
  const memos = await getAdminMemos(id)
  const date = new Date().toISOString().slice(0, 10)
  memos.push({ date, text: text.trim() })
  map[id] = { memos }
  await persistMemosMap(map)
  return true
}

export async function getAdminMemo(id) {
  const memos = await getAdminMemos(id)
  return memos.map((m) => `[${m.date}] ${m.text}`).join('\n\n')
}

export { STATUS_OPTIONS, REPORT_SORT_OPTIONS, ACTIVITY_SORT_OPTIONS }
