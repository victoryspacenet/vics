/**
 * Vics 성향 리포트 — 투표 패턴 분석 (순수 함수)
 */

import { DEFAULT_CATEGORY_EMOJI_BY_ID } from './categoryAdminStorage'

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

const DEFAULT_CATEGORY_LABELS = {
  eternal_quest: '영원한 난제',
  romance: '연애',
  relationships: '인간관계',
  work_life: '직장&갓생',
  balance_game: '밸런스게임',
  food_gourmet: '맛집&맛식',
  fashion: '패션',
}

function categoryLabel(id) {
  if (!id) return '기타'
  return DEFAULT_CATEGORY_LABELS[id] || id
}

function categoryEmoji(id) {
  return DEFAULT_CATEGORY_EMOJI_BY_ID[id] || '📌'
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

    const cat = m?.category || 'other'
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

  const categoryBreakdown = Object.entries(categoryCounts)
    .map(([id, count]) => ({
      id,
      label: categoryLabel(id),
      emoji: categoryEmoji(id),
      count,
      pct: rows.length > 0 ? Math.round((count / rows.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const topCategory = categoryBreakdown[0] || { id: 'other', label: '기타', emoji: '📌', count: 0, pct: 0 }

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
