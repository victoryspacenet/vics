/**
 * 가입 시 취향 체크 — VictorySpace 매치업·투표 컨셉
 */

export const SIGNUP_TASTE_QUESTIONS = [
  {
    id: 'personality_type',
    emoji: '✨',
    title: '매치업에서 나는?',
    subtitle: '투표할 때 나와 가장 가까운 스타일이에요',
    options: [
      { id: 'trendsetter', label: '트렌드세터', emoji: '🔮', hint: '흐름 읽기' },
      { id: 'mainstream', label: '대중적인 입맛', emoji: '🌊', hint: '공감형' },
      { id: 'unique', label: '독특한 개성파', emoji: '🎨', hint: '개성형' },
    ],
  },
  {
    id: 'matchup_role',
    emoji: '🎯',
    title: '매치업에서 나는2?',
    subtitle: 'VictorySpace에서 주로 하고 싶은 역할',
    options: [
      { id: 'voter', label: '투표하는 사람', emoji: '🗳️', hint: '참여형' },
      { id: 'creator', label: '업로드하는 사람', emoji: '📤', hint: '제작형' },
      { id: 'sharer', label: '공유하는 사람', emoji: '🔗', hint: '확산형' },
    ],
  },
  {
    id: 'interest_topic',
    emoji: '🔥',
    title: '관심 주제는?',
    subtitle: '당신의 취향저격',
    options: [
      { id: 'eternal_quest', label: '영원한 난제', emoji: '♾️' },
      { id: 'food_gourmet', label: '맛집&맛식', emoji: '🍜' },
      { id: 'fashion', label: '패션', emoji: '👗' },
    ],
  },
]

/** @typedef {Record<string, string>} SignupTasteAnswers */

export const SIGNUP_TASTE_ANSWER_KEYS = SIGNUP_TASTE_QUESTIONS.map((q) => q.id)

/**
 * @param {SignupTasteAnswers | null | undefined} answers
 */
export function isSignupTasteComplete(answers) {
  if (!answers || typeof answers !== 'object') return false
  return SIGNUP_TASTE_QUESTIONS.every((q) => {
    const v = answers[q.id]
    return typeof v === 'string' && q.options.some((o) => o.id === v)
  })
}

/**
 * @param {SignupTasteAnswers | null | undefined} answers
 */
export function normalizeSignupTasteAnswers(answers) {
  if (!answers || typeof answers !== 'object') return null
  /** @type {SignupTasteAnswers} */
  const out = {}
  for (const q of SIGNUP_TASTE_QUESTIONS) {
    const v = answers[q.id]
    if (typeof v === 'string' && q.options.some((o) => o.id === v)) {
      out[q.id] = v
    }
  }
  return isSignupTasteComplete(out) ? out : null
}

/**
 * @param {string} questionId
 * @param {string} optionId
 */
export function signupTasteOptionLabel(questionId, optionId) {
  const q = SIGNUP_TASTE_QUESTIONS.find((x) => x.id === questionId)
  const o = q?.options.find((x) => x.id === optionId)
  return o ? `${o.emoji} ${o.label}` : optionId
}

/**
 * @param {SignupTasteAnswers | null | undefined} raw
 */
export function normalizeLegacySignupTasteAnswers(raw) {
  if (!raw || typeof raw !== 'object') return null
  /** @type {SignupTasteAnswers} */
  const mapped = { ...raw }
  if (!mapped.personality_type && raw.vote_style) {
    const legacy = { gut: 'unique', predict: 'trendsetter' }
    mapped.personality_type = legacy[raw.vote_style] || raw.vote_style
  }
  if (!mapped.matchup_role && raw.matchup_vibe) {
    const legacy = { fun: 'sharer', deep: 'voter' }
    mapped.matchup_role = legacy[raw.matchup_vibe] || raw.matchup_vibe
  }
  if (mapped.interest_topic === 'romance') mapped.interest_topic = 'eternal_quest'
  if (mapped.interest_topic === 'daily') mapped.interest_topic = 'food_gourmet'
  if (mapped.interest_topic === 'work') mapped.interest_topic = 'fashion'
  if (mapped.interest_topic === 'all') mapped.interest_topic = 'eternal_quest'
  return normalizeSignupTasteAnswers(mapped)
}
