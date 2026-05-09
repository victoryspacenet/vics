/**
 * DB `matchups.category` 에는 시드·과거 데이터가 한글/구 id로 들어가 있고,
 * 앱 LNB·생성 폼은 `categoryAdminStorage` 의 영문 id 를 씁니다.
 * 피드에서 탭별 필터 시 양쪽이 모두 매칭되도록 저장값 목록을 확장합니다.
 */

/** 영문 카테고리 id → DB에 들어갈 수 있는 동의어(한글 라벨, 구 id 등) */
const LEGACY_VALUES_BY_CANONICAL = {
  eternal_quest: ['영원한 난제'],
  romance: ['연애', 'idol'],
  relationships: ['인간관계'],
  work_life: ['직장&갓생', '직장', '갓생'],
  balance_game: ['밸런스', '밸런스게임', 'balance'],
  food_gourmet: ['맛집', '맛집&맛식', 'food', 'tanghulu'],
  fashion: ['패션', 'ootd'],
}

function buildStoredToCanonicalMap() {
  const m = new Map()
  for (const [canonical, legacy] of Object.entries(LEGACY_VALUES_BY_CANONICAL)) {
    m.set(canonical, canonical)
    for (const v of legacy) m.set(v, canonical)
  }
  return m
}

const STORED_TO_CANONICAL = buildStoredToCanonicalMap()

/**
 * DB에 저장된 category 문자열 → LNB/관리자에서 쓰는 영문 id.
 * 매핑 없으면 그대로 반환(커스텀 카테고리 id).
 */
export function canonicalCategoryIdFromStoredValue(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  if (STORED_TO_CANONICAL.has(s)) return STORED_TO_CANONICAL.get(s)
  return s
}

/** @param {string} canonicalId - LNB 선택값 (예: balance_game) */
export function storedCategoryValuesForFilter(canonicalId) {
  if (!canonicalId || canonicalId === 'all') return []
  const legacy = LEGACY_VALUES_BY_CANONICAL[canonicalId] || []
  return [...new Set([canonicalId, ...legacy])]
}
