import { FolderOpen, Flag, Swords, Trophy, UserCircle } from 'lucide-react'
import { supabase } from './supabase'

const TABLE = 'inquiry_help_categories'
const HELP_TABLE = 'inquiry_category_help'

export const INQUIRY_HELP_CATEGORIES_LS_REV_KEY = 'vics_inquiry_help_categories_rev'
/** `inquiryCategoryHelp.js` 와 동일 — 순환 import 방지용 문자열 */
const INQUIRY_CATEGORY_HELP_LS_REV_KEY = 'vics_inquiry_category_help_rev'

function bumpRevision() {
  try {
    localStorage.setItem(INQUIRY_HELP_CATEGORIES_LS_REV_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vics:inquiry-help-categories:updated'))
  }
}

function bumpCategoryHelpRevision() {
  try {
    localStorage.setItem(INQUIRY_CATEGORY_HELP_LS_REV_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vics:inquiry-category-help:updated'))
  }
}

/** @param {string} s */
export function isValidHelpCategorySlug(s) {
  return typeof s === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s) && s.length <= 64
}

/**
 * @returns {Promise<{ slug: string, label: string, sort_order: number }[]>}
 */
export async function listInquiryHelpCategories() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('slug, label, sort_order')
    .order('sort_order', { ascending: true })
  if (error) {
    console.warn('[inquiryHelpCategories]', error.message)
    return []
  }
  return data || []
}

/**
 * @param {{ slug: string, label: string }} row
 */
export async function insertInquiryHelpCategory(row) {
  const slug = String(row.slug || '').trim().toLowerCase()
  const label = String(row.label || '').trim()
  if (!isValidHelpCategorySlug(slug)) throw new Error('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있어요.')
  if (!label) throw new Error('표시 이름을 입력해 주세요.')

  const existing = await listInquiryHelpCategories()
  const sort_order = existing.length ? Math.max(...existing.map((r) => r.sort_order)) + 1 : 0

  const { error } = await supabase.from(TABLE).insert({ slug, label, sort_order })
  if (error) {
    if (error.code === '23505') throw new Error('이미 같은 슬러그가 있어요.')
    throw new Error(error.message || '카테고리를 추가하지 못했어요.')
  }
  bumpRevision()
}

/**
 * 해당 슬러그의 도움말 행을 모두 지운 뒤 카테고리 정의를 삭제한다.
 * @param {string} slug
 */
export async function deleteInquiryHelpCategory(slug) {
  const s = String(slug || '').trim().toLowerCase()
  if (!isValidHelpCategorySlug(s)) throw new Error('잘못된 카테고리예요.')

  const { error: hErr } = await supabase.from(HELP_TABLE).delete().eq('category_slug', s)
  if (hErr) throw new Error(hErr.message || '도움말 데이터를 삭제하지 못했어요.')

  const { error: cErr } = await supabase.from(TABLE).delete().eq('slug', s)
  if (cErr) throw new Error(cErr.message || '카테고리를 삭제하지 못했어요.')

  bumpRevision()
  bumpCategoryHelpRevision()
}

const PRESET_STYLE = {
  matchup: { color: 'from-amber-400 to-orange-500', icon: Swords },
  account: { color: 'from-emerald-400 to-teal-500', icon: UserCircle },
  report: { color: 'from-rose-400 to-pink-500', icon: Flag },
  ranking: { color: 'from-violet-400 to-indigo-500', icon: Trophy },
}

/**
 * 유저 화면용: 슬러그에 맞는 그라데이션·아이콘 (미등록 슬러그는 기본 스타일)
 * @param {string} slug
 */
export function getHelpCategoryPresentation(slug) {
  const preset = PRESET_STYLE[slug]
  if (preset) {
    return { color: preset.color, Icon: preset.icon }
  }
  return {
    color: 'from-violet-400 to-fuchsia-500',
    Icon: FolderOpen,
  }
}
