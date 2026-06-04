/** 1:1 문의 내역 — Supabase `inquiries` */

import { supabase } from './supabase'

/**
 * 접수 번호 생성: INQ-YYMMDD-XXXX
 */
export function generateReceiptId() {
  const d = new Date()
  const yymmdd =
    d.getFullYear().toString().slice(-2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `INQ-${yymmdd}-${rand}`
}

/** 문의 상태: 접수완료 | 처리중 | 답변완료 */
export const INQUIRY_STATUS = {
  received: 'received',
  processing: 'processing',
  replied: 'replied',
}

function mapDbStatus(status) {
  if (status === 'completed') return INQUIRY_STATUS.replied
  return INQUIRY_STATUS.received
}

function rowToListItem(row) {
  return {
    id: row.receipt_id,
    receiptId: row.receipt_id,
    inquiryId: row.id,
    category: row.category,
    categoryLabel: row.category_label || row.category,
    title: row.title,
    content: row.content,
    receiptTime: row.created_at,
    createdAt: row.created_at,
    status: mapDbStatus(row.status),
    _fromDb: true,
  }
}

/** @deprecated 로컬 백업 제거 — DB만 사용 */
export async function saveInquiry() {
  return null
}

/**
 * 내 문의 목록 (페이징 + 전체 건수) — `InquiryHistoryPage`용
 * @returns {{ rows: object[]; totalCount: number }}
 */
export async function fetchUserInquiriesPaged(userId, { page = 1, pageSize = 10 } = {}) {
  if (!userId) return { rows: [], totalCount: 0 }
  const size = Math.min(50, Math.max(1, pageSize))
  const p = Math.max(1, page)
  const from = (p - 1) * size
  const to = from + size - 1
  const { data, error, count } = await inquiriesQueryForUser(userId, { count: true })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) {
    console.warn('[inquiryStorage] fetchUserInquiriesPaged:', error.message)
    return { rows: [], totalCount: 0 }
  }
  return {
    rows: filterDemoInquiryRows(data),
    totalCount: typeof count === 'number' ? count : 0,
  }
}

/**
 * @returns {Promise<Array>}
 */
export async function getInquiryHistory(userId) {
  if (!userId) return []
  const { data, error } = await inquiriesQueryForUser(userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[inquiryStorage] getInquiryHistory:', error.message)
    return []
  }
  return filterDemoInquiryRows(data).map(rowToListItem)
}

export async function removeInquiryByReceiptId(receiptId, userId) {
  if (!receiptId || !userId) return false
  const norm = String(receiptId).replace(/^#/, '')
  const { error, count } = await supabase
    .from('inquiries')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('receipt_id', norm)
  if (error) {
    console.warn('[inquiryStorage] delete:', error.message)
    return false
  }
  return (count ?? 0) > 0
}

export function getDisplayStatus(item, index) {
  if (item.status && Object.values(INQUIRY_STATUS).includes(item.status)) {
    return item.status
  }
  const cycle = [INQUIRY_STATUS.replied, INQUIRY_STATUS.processing, INQUIRY_STATUS.received]
  return cycle[index % cycle.length]
}

const APPEAL_STOP = new Set([
  '그', '수', '및', '등', '이', '가', '을', '를', '에', '의', '은', '는', '도', '만', '로', '와', '과', '또', '더', '제', '조', '때',
  '안녕하세요', '감사합니다', '제가', '저는', '그런데', '그래서', '그리고', '첨부합니다', '합니다', '입니다', '드립니다',
  '있습니다', '주세요', '해주세요', '있어요', '없어요', '해요', '니다', '어요',
])

export function getAppealKeywordHints(item, maxWords = 2) {
  if (!item || item.category !== 'appeal') return []
  const raw = `${item.content || ''}\n${item.title || ''}`.replace(/\r/g, '\n')
  const tokens = raw
    .split(/[\s,.!?;:()[\]'"~…、]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const out = []
  for (const w of tokens) {
    if (w.length < 2 || w.length > 14) continue
    if (/^\d+$/.test(w)) continue
    if (APPEAL_STOP.has(w)) continue
    if (!out.includes(w)) out.push(w)
    if (out.length >= maxWords) break
  }
  return out
}

/** 예전 UI 더미 접수번호 — DB에 남아 있어도 목록·상세에서 제외 */
export function isDemoInquiryReceiptId(receiptId) {
  const id = String(receiptId || '').replace(/^#/, '').trim()
  return id.startsWith('INQ-VIRT-') || id.startsWith('OB_20260206_')
}

function filterDemoInquiryRows(rows) {
  return (rows || []).filter((row) => !isDemoInquiryReceiptId(row.receipt_id))
}

const INQUIRY_LIST_SELECT =
  'id, receipt_id, category, category_label, title, content, status, created_at'

function inquiriesQueryForUser(userId, { count } = {}) {
  return supabase
    .from('inquiries')
    .select(INQUIRY_LIST_SELECT, count ? { count: 'exact' } : undefined)
    .eq('user_id', userId)
    .not('receipt_id', 'like', 'INQ-VIRT%')
    .not('receipt_id', 'like', 'OB_20260206%')
}

/** @deprecated `getInquiryHistory`와 동일 — 더미 병합 제거 */
export async function getInquiryHistoryForDisplay(userId) {
  return getInquiryHistory(userId)
}

export async function getInquiryByReceiptId(receiptId, userId) {
  if (isDemoInquiryReceiptId(receiptId)) return null
  if (!userId) return null
  const norm = String(receiptId || '').replace(/^#/, '')
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, receipt_id, category, category_label, title, content, status, created_at')
    .eq('user_id', userId)
    .eq('receipt_id', norm)
    .maybeSingle()
  if (error || !data) return null
  return rowToListItem(data)
}
