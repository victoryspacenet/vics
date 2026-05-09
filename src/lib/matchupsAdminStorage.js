/**
 * 매치업 관리용 mock 데이터 — Supabase `admin_ui_config`
 */
import { getAdminUiJson, setAdminUiJson } from './adminUiConfig'

const KEY_MATCHUPS = 'admin_matchups_v1'
const KEY_WARN_LOGS = 'admin_matchup_warning_logs_v1'
const KEY_SUSPEND_LOGS = 'admin_matchup_suspension_logs_v1'

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행 중' },
  { value: 'review', label: '검토 대기' },
  { value: 'ended', label: '종료' },
  { value: 'blocked', label: '차단' },
]

const MATCHUP_STATUS_LABEL = {
  active: '진행 중',
  review: '검토 대기',
  ended: '종료',
  blocked: '차단',
}

export function getMatchupStatusLabel(status) {
  return MATCHUP_STATUS_LABEL[status] ?? String(status)
}

export const MATCHUP_INITIAL_STATUS_ON_REPORT = 'review'

/** category / categoryLabel — 유저 매치업 생성·LNB와 동일 id (`categoryAdminStorage` 기본 활성 목록) */
const MOCK_MATCHUPS = [
  { id: 992, category: 'eternal_quest',  categoryLabel: '영원한 난제', title: '아이언맨 vs 캡틴 아메리카',  reports: 0,  status: 'active',  createdAt: '02.12 10:00' },
  { id: 991, category: 'food_gourmet',   categoryLabel: '맛집&맛식',   title: '부먹 vs 찍먹 (논란의 중심)', reports: 8,  status: 'review',  createdAt: '02.12 09:30' },
  { id: 989, category: 'work_life',      categoryLabel: '직장&갓생',   title: 'iPhone 17 vs Galaxy S26',   reports: 0,  status: 'ended',   createdAt: '02.11 18:00' },
  { id: 988, category: 'balance_game',   categoryLabel: '밸런스게임',  title: '롤(LoL) vs 도타2(DOTA2)',   reports: 12, status: 'blocked', createdAt: '02.11 15:40' },
]

const MOCK_DETAILS = {
  992: {
    userA: { name: '홍대고양이', imageUrl: '/logo.png', title: '오늘의 착장' },
    userB: { name: '성수직장인', imageUrl: '/logo.png', title: '점심 메뉴 추천' },
    reportedSides: [],
    aiVerdict: { score: 12, label: '매우 낮음', reason: "User A는 '패션'이나 User B는 '음식' 이미지임. 주제 이탈 확실." },
  },
  991: {
    userA: { name: '부먹파', imageUrl: '/logo.png', title: '찍먹은 이단' },
    userB: { name: '찍먹파', imageUrl: '/logo.png', title: '부먹은 낭비' },
    reportedSides: ['a', 'b'],
    aiVerdict: { score: 45, label: '보통', reason: '양측 모두 음식 관련 이미지이나, 구도와 맥락이 상이함.' },
  },
  989: {
    userA: { name: '애플유저', imageUrl: '/logo.png', title: 'iPhone 17' },
    userB: { name: '삼성유저', imageUrl: '/logo.png', title: 'Galaxy S26' },
    reportedSides: [],
    aiVerdict: { score: 85, label: '매우 높음', reason: '동일 카테고리(스마트폰) 비교.' },
  },
  988: {
    userA: { name: '롤유저', imageUrl: '/logo.png', title: 'LoL' },
    userB: { name: '도타유저', imageUrl: '/logo.png', title: 'DOTA2' },
    reportedSides: ['a', 'b'],
    aiVerdict: { score: 62, label: '보통', reason: 'MOBA 장르 비교이나 게임별 특성 차이 있음.' },
  },
}

const DEFAULT_DETAIL = {
  userA: { name: 'User A', imageUrl: '/logo.png', title: '-' },
  userB: { name: 'User B', imageUrl: '/logo.png', title: '-' },
  reportedSides: [],
  aiVerdict: { score: 0, label: '-', reason: 'AI 판정 정보 없음.' },
}

let _matchupsCache = null
let _warnLogsCache = null
let _suspendLogsCache = null

async function readMatchups() {
  if (_matchupsCache) return _matchupsCache
  const remote = await getAdminUiJson(KEY_MATCHUPS, null)
  _matchupsCache =
    Array.isArray(remote) && remote.length > 0 ? remote : JSON.parse(JSON.stringify(MOCK_MATCHUPS))
  return _matchupsCache
}

async function persistMatchups(list) {
  await setAdminUiJson(KEY_MATCHUPS, list)
  _matchupsCache = list
}

export async function getMatchups() {
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
  const filtered = matchupId != null ? list.filter((e) => e.matchupId === Number(matchupId)) : list
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
  const filtered = matchupId != null ? list.filter((e) => e.matchupId === Number(matchupId)) : list
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

export async function getMatchupDetail(id) {
  const list = await readMatchups()
  const base = list.find((m) => m.id === Number(id))
  if (!base) return null
  const detail = MOCK_DETAILS[base.id] ?? DEFAULT_DETAIL
  const userIdA = detail.userA?.userId ?? `mock_mu_${base.id}_a`
  const userIdB = detail.userB?.userId ?? `mock_mu_${base.id}_b`
  const reportedSides = 'reportedSides' in detail ? detail.reportedSides : []
  return {
    ...base,
    ...detail,
    reportedSides,
    userA: { ...detail.userA, userId: userIdA },
    userB: { ...detail.userB, userId: userIdB },
  }
}

export async function updateMatchupStatus(id, status) {
  const list = await readMatchups()
  const idx = list.findIndex((m) => m.id === id)
  if (idx < 0) return false
  const next = list.map((m, i) => (i === idx ? { ...m, status } : m))
  await persistMatchups(next)
  return true
}

export async function bulkUpdateStatus(ids, status) {
  const list = await readMatchups()
  const idSet = new Set(ids.map(Number))
  let count = 0
  const next = list.map((m) => {
    if (idSet.has(m.id)) {
      count += 1
      return { ...m, status }
    }
    return m
  })
  await persistMatchups(next)
  return count
}

export async function getMatchupStats() {
  const list = await readMatchups()
  return {
    active: list.filter((m) => m.status === 'active').length,
    review: list.filter((m) => m.status === 'review').length,
    ended: list.filter((m) => m.status === 'ended').length,
    blocked: list.filter((m) => m.status === 'blocked').length,
  }
}

export { STATUS_OPTIONS }
