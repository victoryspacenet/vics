/**
 * 카테고리 관리용 설정 — Supabase `category_admin_config` (브라우저 저장소 없음)
 */

import { supabase } from './supabase'

const REMOTE_TABLE = 'category_admin_config'
const REMOTE_ROW_ID = 'default'

const hasSupabaseUrl = Boolean(import.meta.env.VITE_SUPABASE_URL)

/** JSON 구조 버전 */
const SCHEMA_VERSION = 2

/** pull/save 후 동기 getter가 읽는 메모리 캐시 */
let categoryRuntimeCache = null

/** 유저페이지 매치업 생성 카테고리와 동일 (관리자 기본값) */
const DEFAULT_ACTIVE_CATEGORIES = [
  { id: 'eternal_quest', slug: '영원한 난제', label: '영원한 난제', pinned: false },
  { id: 'romance', slug: '연애', label: '연애', pinned: false },
  { id: 'relationships', slug: '인간관계', label: '인간관계', pinned: false },
  { id: 'work_life', slug: '직장&갓생', label: '직장&갓생', pinned: false },
  { id: 'balance_game', slug: '밸런스게임', label: '밸런스게임', pinned: false },
  { id: 'food_gourmet', slug: '맛집&맛식', label: '맛집&맛식', pinned: false },
  { id: 'fashion', slug: '패션', label: '패션', pinned: false },
]

const DEFAULT_BANNER = {
  text: '지금 가장 킹받는 주제는? 🔥',
  linkedCategoryId: 'realtime_ranking',
}

const LINK_OPTIONS = [
  { value: 'realtime_ranking', label: '실시간 랭킹 매치업' },
  { value: 'eternal_quest', label: '영원한 난제' },
  { value: 'romance', label: '연애' },
  { value: 'relationships', label: '인간관계' },
  { value: 'work_life', label: '직장&갓생' },
  { value: 'balance_game', label: '밸런스게임' },
  { value: 'food_gourmet', label: '맛집&맛식' },
  { value: 'fashion', label: '패션' },
]

const LEGACY_IDS = ['ootd', 'tanghulu', 'idol']

/** 커스텀 이모지·이미지가 없을 때 id별 표시용 (관리자 칩·홈/랭킹 LNB 공통) */
export const DEFAULT_CATEGORY_EMOJI_BY_ID = {
  eternal_quest: '♾️',
  romance: '💕',
  relationships: '🤝',
  work_life: '💼',
  balance_game: '⚖️',
  food_gourmet: '🍜',
  fashion: '👗',
}

function normalizeCategoryData(data) {
  if (!data || typeof data !== 'object') {
    return {
      _schemaVersion: SCHEMA_VERSION,
      activeCategories: JSON.parse(JSON.stringify(DEFAULT_ACTIVE_CATEGORIES)),
      banner: { ...DEFAULT_BANNER },
    }
  }
  const ids = data.activeCategories?.map((c) => c.id) || []
  const isLegacy = ids.length <= 3 && ids.every((id) => LEGACY_IDS.includes(id))
  if (isLegacy) {
    return {
      _schemaVersion: SCHEMA_VERSION,
      activeCategories: JSON.parse(JSON.stringify(DEFAULT_ACTIVE_CATEGORIES)),
      banner: { ...DEFAULT_BANNER, ...data.banner },
    }
  }
  const next = { ...data }
  if (!Array.isArray(next.activeCategories) || next.activeCategories.length === 0) {
    next.activeCategories = JSON.parse(JSON.stringify(DEFAULT_ACTIVE_CATEGORIES))
  }
  if (!next.banner || typeof next.banner !== 'object') {
    next.banner = { ...DEFAULT_BANNER }
  }
  next._schemaVersion = SCHEMA_VERSION
  return next
}

function load() {
  if (categoryRuntimeCache) return categoryRuntimeCache
  return normalizeCategoryData(null)
}

function setRuntimeCache(data) {
  categoryRuntimeCache = normalizeCategoryData(data)
  return categoryRuntimeCache
}

function dispatchChanged() {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('vics_categories_changed'))
  } catch {
    /* ignore */
  }
}

function save(data) {
  const normalized = setRuntimeCache(data)
  dispatchChanged()
  void pushCategoryConfigToRemote(normalized)
}

/** 로그인한 경우에만 원격 upsert (RLS: authenticated) */
async function pushCategoryConfigToRemote(payload) {
  if (!hasSupabaseUrl) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const normalized = normalizeCategoryData(payload)
    const { error } = await supabase.from(REMOTE_TABLE).upsert(
      {
        id: REMOTE_ROW_ID,
        data: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (error) console.warn('[categoryAdmin] remote push:', error.message)
  } catch (e) {
    console.warn('[categoryAdmin] remote push failed', e)
  }
}

/**
 * 원격(웹 관리자가 저장한 값) → 로컬. 앱·다른 기기와 동일 목록 유지.
 * @returns {Promise<boolean>} 적용 여부
 */
export async function pullCategoryConfigFromRemote() {
  if (!hasSupabaseUrl || typeof window === 'undefined') return false
  try {
    const { data, error } = await supabase
      .from(REMOTE_TABLE)
      .select('data')
      .eq('id', REMOTE_ROW_ID)
      .maybeSingle()
    if (error) {
      console.warn('[categoryAdmin] remote pull:', error.message)
      return false
    }
    const raw = data?.data
    if (!raw || typeof raw !== 'object') return false
    if (!Array.isArray(raw.activeCategories) || raw.activeCategories.length === 0) return false

    const remoteVer = typeof raw._schemaVersion === 'number' ? raw._schemaVersion : 0
    if (remoteVer < SCHEMA_VERSION) {
      const localParsed = categoryRuntimeCache
      if (localParsed && localParsed._schemaVersion === SCHEMA_VERSION) {
        void pushCategoryConfigToRemote(normalizeCategoryData(localParsed))
      }
      return false
    }

    const normalized = normalizeCategoryData(raw)
    setRuntimeCache(normalized)
    dispatchChanged()
    return true
  } catch (e) {
    console.warn('[categoryAdmin] remote pull failed', e)
    return false
  }
}

/** 앱 부팅 시 한 번 호출 — 원격이 있으면 로컬을 덮어 동기화 */
export function startCategoryConfigRemoteSync() {
  if (typeof window === 'undefined') return
  queueMicrotask(() => {
    pullCategoryConfigFromRemote().catch(() => {})
  })
}

function sortedActiveCategories() {
  const data = load()
  return [...data.activeCategories].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })
}

/** 카테고리 표시명으로 시스템용 영문 id 제안 (소문자, a-z0-9_) */
export function suggestEnglishCategoryCode(displayName, existingIds = []) {
  const ids = new Set(existingIds.map((x) => String(x).toLowerCase()))
  const ascii = String(displayName || '')
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('_')
    .toLowerCase()
  let base = ascii.replace(/[^a-z0-9_]/g, '').slice(0, 24)
  if (base.length < 2) {
    let h = 0
    for (let i = 0; i < String(displayName).length; i++) {
      h = (h * 31 + String(displayName).charCodeAt(i)) | 0
    }
    base = `cat_${Math.abs(h).toString(36)}`
  }
  let candidate = base
  let n = 0
  while (ids.has(candidate)) {
    n += 1
    candidate = `${base}_${n}`
  }
  return candidate
}

function navExtrasFromCategory(c) {
  const iconImageUrl = c.iconImageDataUrl || null
  let icon = c.iconEmoji || null
  if (!iconImageUrl && !icon) {
    icon = DEFAULT_CATEGORY_EMOJI_BY_ID[c.id] || '📌'
  }
  return {
    icon,
    label: c.label,
    pointColor: c.pointColor || null,
    iconImageUrl,
  }
}

/**
 * 홈 피드 LNB — DB `matchups.category` id와 동일 (관리자 활성 목록)
 * @returns {{ id: string, icon: string | null, label: string, pointColor?: string | null, iconImageUrl?: string | null }[]}
 */
export function getFeedCategoryNavItems() {
  const sorted = sortedActiveCategories()
  return [
    { id: 'all', icon: '✨', label: '전체 매치', pointColor: null, iconImageUrl: null },
    ...sorted.map((c) => ({ id: c.id, ...navExtrasFromCategory(c) })),
  ]
}

/**
 * 랭킹 LNB·모바일 탭 — 동일 id, 전체 행만 문구·아이콘 다름
 */
export function getRankingCategoryNavItems() {
  const sorted = sortedActiveCategories()
  return [
    { id: 'all', icon: '🏆', label: '전체 랭킹', pointColor: null, iconImageUrl: null },
    ...sorted.map((c) => ({ id: c.id, ...navExtrasFromCategory(c) })),
  ]
}

/** 매치업 상세 등: 저장된 category id → 표시용 라벨 */
export function getCategoryLabelById(id) {
  if (!id) return '카테고리 선택'
  const data = load()
  const found = data.activeCategories.find((c) => c.id === id)
  if (found) return found.label
  return String(id)
}

/** 랭킹 모바일 탭 폴백 — 관리자 기본 활성 목록 상위 3개 id */
export const DEFAULT_RANKING_MOBILE_TAB_IDS = DEFAULT_ACTIVE_CATEGORIES.slice(0, 3).map((c) => c.id)

export function getCategoryConfig() {
  return load()
}

export function updateActiveCategories(categories) {
  const data = load()
  data.activeCategories = categories
  save(data)
  return data
}

function sanitizeCategoryRecord(category) {
  const id = String(category.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+/, '')
  if (!id || !/^[a-z][a-z0-9_]*$/.test(id)) return null
  const label = String(category.label || '').trim().slice(0, 10)
  if (!label) return null
  let iconImageDataUrl
  if (typeof category.iconImageDataUrl === 'string' && category.iconImageDataUrl.length < 190_000) {
    iconImageDataUrl = category.iconImageDataUrl
  }
  const pointColor =
    typeof category.pointColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(category.pointColor)
      ? category.pointColor
      : undefined
  const iconEmoji =
    typeof category.iconEmoji === 'string' ? [...category.iconEmoji].slice(0, 4).join('') : undefined
  return {
    id,
    slug: String(category.slug || label).trim().slice(0, 32),
    label,
    pinned: !!category.pinned,
    ...(iconEmoji ? { iconEmoji } : {}),
    ...(pointColor ? { pointColor } : {}),
    ...(iconImageDataUrl ? { iconImageDataUrl } : {}),
  }
}

export function addActiveCategory(category) {
  const row = sanitizeCategoryRecord(category)
  if (!row) return null
  const data = load()
  const exists = data.activeCategories.some((c) => c.id === row.id || c.slug === row.slug)
  if (exists) return null
  data.activeCategories.push(row)
  save(data)
  return data
}

export function removeActiveCategory(id) {
  const data = load()
  data.activeCategories = data.activeCategories.filter((c) => c.id !== id)
  save(data)
  return data
}

export function updateCategoryPinned(id, pinned) {
  const data = load()
  const idx = data.activeCategories.findIndex((c) => c.id === id)
  if (idx < 0) return null
  data.activeCategories[idx].pinned = pinned
  save(data)
  return data
}

export function updateBanner(banner) {
  const data = load()
  data.banner = { ...data.banner, ...banner }
  save(data)
  return data
}

export function getBannerLinkOptions() {
  const data = load()
  const fromActive = data.activeCategories.map((c) => ({ value: c.id, label: c.label }))
  const seen = new Set(LINK_OPTIONS.map((o) => o.value))
  const extra = fromActive.filter((c) => !seen.has(c.value))
  return [...LINK_OPTIONS, ...extra]
}

/** 매치업 생성 시 선택할 카테고리 목록 (고정 항목이 위로 — 피드·랭킹 LNB와 동일 순서) */
export function getMatchupCategories() {
  const sorted = sortedActiveCategories()
  const options = [
    { value: '', label: '카테고리 선택' },
    ...sorted.map((c) => {
      let prefix = ''
      if (c.iconEmoji) prefix = `${c.iconEmoji} `
      else if (!c.iconImageDataUrl) prefix = `${DEFAULT_CATEGORY_EMOJI_BY_ID[c.id] || '📌'} `
      return {
        value: c.id,
        label: `${prefix}${c.label}`,
      }
    }),
  ]
  return options
}

/** 관리자 매치업 목록 필터·검색 — `getMatchupCategories`와 동일 id·표기(이모지 접두), 선행만 `전체` */
export function getAdminMatchupCategoryFilterOptions() {
  return [
    { value: 'all', label: '전체' },
    ...getMatchupCategories()
      .filter((o) => o.value !== '')
      .map(({ value, label }) => ({ value, label })),
  ]
}

export { LINK_OPTIONS }
