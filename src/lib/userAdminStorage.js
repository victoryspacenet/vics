/**
 * 유저 관리용 mock 데이터 — Supabase `admin_ui_config` (키: admin_users_v1, admin_user_memos_v1)
 */
import { getAdminUiJson, setAdminUiJson } from './adminUiConfig'

const ADMIN_USERS_KEY = 'admin_users_v1'
const ADMIN_USER_MEMOS_KEY = 'admin_user_memos_v1'

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

async function resolveExpiredCaution(users) {
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
    _usersMemCache = next
  }
  return next
}

async function readUsers() {
  if (_usersMemCache) return _usersMemCache
  const remote = await getAdminUiJson(ADMIN_USERS_KEY, null)
  let list =
    Array.isArray(remote) && remote.length > 0
      ? remote.map(normalizeUserRow)
      : JSON.parse(JSON.stringify(MOCK_USERS))
  list = await resolveExpiredCaution(list)
  _usersMemCache = list
  return list
}

async function persistUsers(users) {
  await setAdminUiJson(ADMIN_USERS_KEY, users)
  _usersMemCache = users
}

/** 전체 유저 목록 */
export async function getUsers() {
  return readUsers()
}

export async function getUserDetail(id) {
  const users = await readUsers()
  const user = users.find((u) => u.id === id)
  if (!user) return null
  const detail = MOCK_USER_DETAILS[user.id] || {
    totalVotes: 0,
    voteParticipationPoints: 0,
    matchupResultPoints: 0,
    topCategories: [],
    matchupsCreated: 0,
    reportReasons: {},
    sanctions: [],
    adminMemo: '',
  }
  const savedMemos = await getAdminMemos(id)
  const adminMemo =
    savedMemos.length > 0
      ? savedMemos.map((m) => `[${m.date}] ${m.text}`).join('\n\n')
      : detail.adminMemo || ''
  return { ...detail, ...user, adminMemo }
}

export async function updateUserStatus(id, status) {
  const users = await readUsers()
  const idx = users.findIndex((u) => u.id === id)
  if (idx < 0) return null
  const next = users.map((u, i) => {
    if (i !== idx) return u
    const copy = { ...u, status }
    if (status !== 'caution') delete copy.cautionUntil
    return copy
  })
  await persistUsers(next)
  return next[idx]
}

/**
 * 이용 제한 기간 동안 상태를 주의로.
 */
export async function setCautionForPeriod(userId, periodEndMs) {
  if (typeof periodEndMs !== 'number' || !Number.isFinite(periodEndMs)) return null
  const users = await readUsers()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx < 0) return null
  const u = users[idx]
  if (u.status === 'suspended' || u.status === 'withdrawn' || u.status === 'blocked') return null
  const prevEnd = typeof u.cautionUntil === 'number' ? u.cautionUntil : 0
  const next = users.map((row, i) =>
    i === idx
      ? { ...row, status: 'caution', cautionUntil: Math.max(prevEnd, periodEndMs) }
      : row
  )
  await persistUsers(next)
  return next[idx]
}

export const REVOKE_POINTS_MODES = [
  { id: 'vote_only', label: '투표 참여 포인트만' },
  { id: 'matchup_only', label: '생성(매치업) 포인트만' },
]

export async function revokeActivityPoints(userId, amountP, mode = 'vote_only') {
  const n = Math.floor(Number(amountP))
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'invalid' }
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
  const next = users.map((row, i) =>
    i === idx
      ? {
          ...row,
          voteParticipationPoints: vp,
          matchupResultPoints: mp,
          points: vp + mp,
        }
      : row
  )
  await persistUsers(next)
  const uu = next[idx]
  return {
    ok: true,
    revoked,
    totalAfter: uu.points,
    voteAfter: vp,
    matchupAfter: mp,
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
