import { computeTendencyReport } from './tendencyReportAnalysis'

/** @typedef {'trendsetter' | 'mainstream' | 'unique'} DemoTendencyId */

const BASE = [
  { title: '치킨 vs 피자', category: 'food_gourmet', left_label: '치킨', right_label: '피자' },
  { title: '강아지 vs 고양이', category: 'balance_game', left_label: '강아지', right_label: '고양이' },
  { title: '아침형 vs 올빼미형', category: 'work_life', left_label: '아침형', right_label: '올빼미형' },
  { title: '캐주얼 vs 포멀', category: 'fashion', left_label: '캐주얼', right_label: '포멀' },
  { title: '집순이 vs 집밖', category: 'relationships', left_label: '집순이', right_label: '집밖' },
  { title: '커피 vs 차', category: 'food_gourmet', left_label: '커피', right_label: '차' },
  { title: '선톡 vs 기다림', category: 'romance', left_label: '선톡', right_label: '기다림' },
  { title: 'Netflix vs YouTube', category: 'balance_game', left_label: 'Netflix', right_label: 'YouTube' },
  { title: '운명 vs 우연', category: 'eternal_quest', left_label: '운명', right_label: '우연' },
  { title: '매운 vs 순한', category: 'food_gourmet', left_label: '매운', right_label: '순한' },
]

/**
 * @param {number} i
 * @param {'left'|'right'} side
 * @param {number} leftVotes
 * @param {number} rightVotes
 * @param {'left'|'right'|'draw'|null} winner
 */
function row(i, side, leftVotes, rightVotes, winner) {
  const b = BASE[i]
  return {
    side,
    matchups: {
      title: b.title,
      category: b.category,
      left_label: b.left_label,
      right_label: b.right_label,
      left_votes: leftVotes,
      right_votes: rightVotes,
      winner,
    },
  }
}

const DEMO_VOTES_MAINSTREAM = [
  row(0, 'left', 820, 180, 'left'),
  row(1, 'left', 710, 290, 'left'),
  row(2, 'right', 280, 720, 'right'),
  row(3, 'left', 680, 320, 'left'),
  row(4, 'left', 590, 410, 'left'),
  row(5, 'left', 900, 100, 'left'),
  row(6, 'right', 320, 680, 'right'),
  row(7, 'right', 210, 790, 'right'),
  row(8, 'left', 640, 360, 'left'),
  row(9, 'left', 770, 230, 'left'),
]

const DEMO_VOTES_UNIQUE = [
  row(0, 'right', 850, 150, 'left'),
  row(1, 'right', 780, 220, 'left'),
  row(2, 'left', 250, 750, 'right'),
  row(3, 'right', 700, 300, 'left'),
  row(4, 'left', 420, 580, 'right'),
  row(5, 'right', 880, 120, 'left'),
  row(6, 'left', 380, 620, 'right'),
  row(7, 'left', 520, 480, 'right'),
  row(8, 'right', 660, 340, 'left'),
  row(9, 'right', 800, 200, 'left'),
]

const DEMO_VOTES_TRENDSETTER = [
  row(0, 'left', 620, 380, 'left'),
  row(1, 'right', 720, 280, 'left'),
  row(2, 'right', 310, 690, 'right'),
  row(3, 'left', 810, 190, 'left'),
  row(4, 'right', 560, 440, 'left'),
  row(5, 'left', 390, 610, 'right'),
  row(6, 'left', 670, 330, 'left'),
  row(7, 'right', 470, 530, 'right'),
  row(8, 'left', 515, 485, 'left'),
  row(9, 'right', 610, 390, 'left'),
]

export const DEMO_TENDENCY_IDS = ['trendsetter', 'mainstream', 'unique']

export const DEMO_TENDENCY_LABELS = {
  trendsetter: '트렌드세터',
  mainstream: '대중적인 입맛',
  unique: '독특한 개성파',
}

export const DEMO_VOTE_ROWS_BY_TYPE = {
  trendsetter: DEMO_VOTES_TRENDSETTER,
  mainstream: DEMO_VOTES_MAINSTREAM,
  unique: DEMO_VOTES_UNIQUE,
}

/**
 * @param {string} presetId
 * @returns {DemoTendencyId | 'progress'}
 */
export function demoTypeFromCardPreset(presetId) {
  if (presetId === 'mainstream') return 'mainstream'
  if (presetId === 'unique') return 'unique'
  if (presetId === 'progress') return 'progress'
  return 'trendsetter'
}

/**
 * @param {string | null | undefined} raw
 * @returns {DemoTendencyId}
 */
export function parseDemoTendencyParam(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'mainstream' || v === 'unique' || v === 'trendsetter') return v
  return 'trendsetter'
}

/**
 * @param {DemoTendencyId} type
 * @param {string} [nickname]
 */
export function buildDemoTendencyReport(type, nickname = '미리보기') {
  const rows = DEMO_VOTE_ROWS_BY_TYPE[type] || DEMO_VOTES_TRENDSETTER
  return computeTendencyReport(rows, { nickname })
}

/**
 * @param {DemoTendencyId} type
 * @param {string} [nickname]
 */
export function demoReportHref(type, nickname) {
  const params = new URLSearchParams({ demo: '1', type })
  if (nickname) params.set('nickname', nickname)
  return `/report/tendency?${params.toString()}`
}
