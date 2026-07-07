/**
 * Vics 성향 리포트 — 투표 패턴 분석 (순수 함수)
 */

import { getCategoryConfig, getCategoryLabelById, DEFAULT_CATEGORY_EMOJI_BY_ID } from './categoryAdminStorage'
import { canonicalCategoryIdFromStoredValue } from './matchupCategoryAliases'
import { mapTiedMaxLabels } from './resolveTiedMaxLabels'

export const TENDENCY_REPORT_VOTE_THRESHOLD = 10

export const TENDENCY_TYPES = {
  trendsetter: {
    id: 'trendsetter',
    title: '트렌드세터',
    emoji: '🔮',
    tagline: '흐름을 읽는 감각파',
    gradient: 'from-violet-500 via-fuchsia-500 to-cyan-400',
    cardBg: 'from-violet-950 via-fuchsia-950 to-slate-950',
    accent: 'text-cyan-300',
    ring: 'ring-cyan-400/40',
  },
  mainstream: {
    id: 'mainstream',
    title: '대중적인 입맛',
    emoji: '🌊',
    tagline: '많은 이들과 닿는 선택',
    gradient: 'from-sky-400 via-blue-500 to-indigo-500',
    cardBg: 'from-sky-950 via-blue-950 to-indigo-950',
    accent: 'text-sky-300',
    ring: 'ring-sky-400/40',
  },
  unique: {
    id: 'unique',
    title: '독특한 개성파',
    emoji: '🎨',
    tagline: '남들과 다른 시선',
    gradient: 'from-rose-400 via-orange-500 to-amber-400',
    cardBg: 'from-rose-950 via-orange-950 to-amber-950',
    accent: 'text-amber-300',
    ring: 'ring-rose-400/40',
  },
}

const OTHER_CATEGORY_ID = 'other'

function knownCategoryIds() {
  return new Set(getCategoryConfig().activeCategories.map((c) => c.id))
}

/** DB·스냅샷 category → 현재 활성 카테고리 id (없으면 other) */
export function resolveReportCategoryId(raw) {
  const canonical = canonicalCategoryIdFromStoredValue(raw) || OTHER_CATEGORY_ID
  if (canonical === OTHER_CATEGORY_ID) return OTHER_CATEGORY_ID
  return knownCategoryIds().has(canonical) ? canonical : OTHER_CATEGORY_ID
}

function categoryLabel(id) {
  if (!id || id === OTHER_CATEGORY_ID) return '기타'
  return getCategoryLabelById(id)
}

function categoryEmoji(id) {
  if (!id || id === OTHER_CATEGORY_ID) return '📌'
  const found = getCategoryConfig().activeCategories.find((c) => c.id === id)
  if (found?.iconEmoji) return found.iconEmoji
  return DEFAULT_CATEGORY_EMOJI_BY_ID[id] || '📌'
}

function buildCategoryBreakdownList(categoryCounts, voteCount) {
  return Object.entries(categoryCounts)
    .filter(([id]) => id !== OTHER_CATEGORY_ID)
    .map(([id, count]) => ({
      id,
      label: categoryLabel(id),
      emoji: categoryEmoji(id),
      count,
      pct: voteCount > 0 ? Math.round((count / voteCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/** 저장된 스냅샷·구 리포트의 categoryBreakdown 정규화 */
export function normalizeCategoryBreakdown(rawBreakdown, voteCount = 0) {
  const counts = {}
  for (const row of rawBreakdown || []) {
    const id = resolveReportCategoryId(row?.id)
    if (id === OTHER_CATEGORY_ID) continue
    counts[id] = (counts[id] || 0) + Number(row?.count || 0)
  }
  return buildCategoryBreakdownList(counts, voteCount)
}

function majoritySide(m) {
  const left = Number(m?.left_votes ?? 0)
  const right = Number(m?.right_votes ?? 0)
  if (left > right) return 'left'
  if (right > left) return 'right'
  return null
}

function pickedLabel(m, side) {
  if (!m) return side === 'left' ? 'A' : 'B'
  return side === 'left' ? (m.left_label || 'A') : (m.right_label || 'B')
}

/**
 * @param {Array<{ side: string, matchups?: object | object[] }>} voteRows — created_at ASC
 * @param {{ nickname?: string }} [opts]
 */
export function computeTendencyReport(voteRows, opts = {}) {
  const rows = (voteRows || []).slice(0, TENDENCY_REPORT_VOTE_THRESHOLD)
  const nickname = opts.nickname || 'Victory'

  let mainstream = 0
  let contrarian = 0
  let neutralMajority = 0
  let hits = 0
  let completed = 0
  let leftCount = 0
  let rightCount = 0
  const categoryCounts = {}
  const choices = []

  for (const row of rows) {
    const m = Array.isArray(row.matchups) ? row.matchups[0] : row.matchups
    const side = row.side === 'right' ? 'right' : 'left'
    if (side === 'left') leftCount += 1
    else rightCount += 1

    const maj = majoritySide(m)
    if (maj) {
      if (side === maj) mainstream += 1
      else contrarian += 1
    } else {
      neutralMajority += 1
    }

    if (m?.winner && m.winner !== 'draw') {
      completed += 1
      if (side === m.winner) hits += 1
    }

    const cat = resolveReportCategoryId(m?.category)
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1

    choices.push({
      title: m?.title || '매치업',
      pickedLabel: pickedLabel(m, side),
      side,
      wasMajority: maj ? side === maj : null,
      category: cat,
    })
  }

  const validAlign = mainstream + contrarian
  const mainstreamPct = validAlign > 0 ? Math.round((mainstream / validAlign) * 100) : 50
  const contrarianPct = validAlign > 0 ? Math.round((contrarian / validAlign) * 100) : 50
  const hitRatePct = completed > 0 ? Math.round((hits / completed) * 100) : null
  const leftPct = rows.length > 0 ? Math.round((leftCount / rows.length) * 100) : 50
  const rightPct = rows.length > 0 ? 100 - leftPct : 50

  const tendencyType = classifyTendency({ mainstreamPct, contrarianPct, hitRatePct, completed })
  const meta = TENDENCY_TYPES[tendencyType]

  const categoryBreakdown = buildCategoryBreakdownList(categoryCounts, rows.length)

  const topCategory =
    categoryBreakdown[0] ||
    { id: OTHER_CATEGORY_ID, label: '기타', emoji: '📌', count: 0, pct: 0 }

  const { headline, summary, traits } = buildCopy({
    tendencyType,
    nickname,
    mainstreamPct,
    contrarianPct,
    hitRatePct,
    topCategory,
    voteCount: rows.length,
  })

  const highlightChoices = [...choices]
    .sort((a, b) => {
      if (a.wasMajority === false && b.wasMajority !== false) return -1
      if (b.wasMajority === false && a.wasMajority !== false) return 1
      return 0
    })
    .slice(0, 3)

  return {
    tendencyType,
    tendencyMeta: meta,
    voteCount: rows.length,
    nickname,
    stats: {
      mainstreamPct,
      contrarianPct,
      hitRatePct,
      completedCount: completed,
      leftPct,
      rightPct,
      neutralMajorityCount: neutralMajority,
    },
    topCategory,
    categoryBreakdown,
    highlightChoices,
    headline,
    summary,
    traits,
    generatedAt: new Date().toISOString(),
  }
}

function classifyTendency({ mainstreamPct, contrarianPct, hitRatePct, completed }) {
  if (contrarianPct >= 55) return 'unique'
  if (mainstreamPct >= 62) return 'mainstream'
  if (hitRatePct != null && hitRatePct >= 55 && completed >= 2) return 'trendsetter'
  if (contrarianPct >= 45 && mainstreamPct < 55) return 'unique'
  if (mainstreamPct >= 52) return 'mainstream'
  return 'trendsetter'
}

const ADMIN_TENDENCY_TYPE_PRIORITY = ['trendsetter', 'mainstream', 'unique']

function adminTendencyTypeLabelMap() {
  return {
    trendsetter: TENDENCY_TYPES.trendsetter.title,
    mainstream: TENDENCY_TYPES.mainstream.title,
    unique: TENDENCY_TYPES.unique.title,
  }
}

/**
 * 관리자 유저 상세 — 투표 정렬(다수/소수/박빙) 건수
 * @param {Array<{ side: string, matchups?: object | object[] }>} voteRows
 */
export function countVoteTendencyAlignment(voteRows) {
  const rows = (voteRows || []).slice(0, TENDENCY_REPORT_VOTE_THRESHOLD)
  let mainstream = 0
  let unique = 0
  let trendsetter = 0

  for (const row of rows) {
    const m = Array.isArray(row.matchups) ? row.matchups[0] : row.matchups
    const side = row.side === 'right' ? 'right' : 'left'
    const maj = majoritySide(m)
    if (!maj) trendsetter += 1
    else if (side === maj) mainstream += 1
    else unique += 1
  }

  return { mainstream, unique, trendsetter }
}

/**
 * @param {Array<{ side: string, matchups?: object | object[] }>} voteRows
 */
export function mapVoteTendencyLabelsFromVoteRows(voteRows) {
  const { keys, labels, label } = mapTiedMaxLabels(
    countVoteTendencyAlignment(voteRows),
    ADMIN_TENDENCY_TYPE_PRIORITY,
    adminTendencyTypeLabelMap(),
  )
  if (!labels.length) return {}
  return {
    voteTendencyTypes: keys,
    voteTendencyLabels: labels,
    voteTendencyLabel: label,
  }
}

function buildCopy({ tendencyType, nickname, mainstreamPct, contrarianPct, hitRatePct, topCategory, voteCount }) {
  const catLine = topCategory.count > 0 ? `특히 **${topCategory.emoji} ${topCategory.label}** 주제에 관심이 많아요.` : ''

  if (tendencyType === 'unique') {
    return {
      headline: `${nickname}님, 당신은 독특한 개성파예요`,
      summary: `10번의 선택 중 ${contrarianPct}%가 다수와 다른 쪽이에요. ${catLine} 남들이 고민할 때 당신은 자기만의 기준으로 고르는 편이에요.`,
      traits: ['소수파 선택에 거침없음', '남의 시선보다 내 취향 우선', '매치업에 새로운 관점을 더하는 타입'],
    }
  }

  if (tendencyType === 'mainstream') {
    return {
      headline: `${nickname}님, 당신은 대중적인 입맛이에요`,
      summary: `${voteCount}번의 투표 중 ${mainstreamPct}%가 많은 사람들과 같은 선택이에요. ${catLine} 공감대를 잘 읽고, 트렌드의 중심에 서 있는 편이에요.`,
      traits: ['다수의 선택과 잘 맞음', '화제성 있는 주제에 강함', '친구들과 의견 맞추기 쉬운 타입'],
    }
  }

  const hitLine =
    hitRatePct != null
      ? `종료된 매치업 예측 적중률은 ${hitRatePct}%예요. `
      : ''
  return {
    headline: `${nickname}님, 당신은 트렌드세터예요`,
    summary: `${hitLine}대중과 반대만 고르지도, 무조건 따라가지도 않아요. ${catLine} 흐름을 읽으며 한발 앞서 가는 감각이 느껴져요.`,
    traits: ['밸런스 있는 선택', '결과를 가늠하는 감각', '새로운 주제를 빠르게 흡수하는 타입'],
  }
}

/** 마크다운-style **bold** → plain for UI that doesn't render md */
export function stripReportMarkdown(text) {
  if (!text || typeof text !== 'string') return ''
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}
