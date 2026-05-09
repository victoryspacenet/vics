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
 * @returns {Promise<Array>}
 */
export async function getInquiryHistory(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, receipt_id, category, category_label, title, content, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[inquiryStorage] getInquiryHistory:', error.message)
    return []
  }
  return (data || []).map(rowToListItem)
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

const VIRTUAL_ITEMS = (() => {
  const base = new Date()
  return [
    {
      receiptId: 'INQ-VIRT-001',
      id: 'INQ-VIRT-001',
      category: 'point',
      categoryLabel: '매치업/포인트',
      title: '매치업에서 이겼는데 100P가 안 들어와요..',
      content: '매치업에서 이겼는데 100P가 안 들어와요..',
      status: INQUIRY_STATUS.replied,
      reply: '안녕하세요, 고객님! 확인 결과 시스템 지연으로 지급이 늦어졌습니다. 지금 바로 보너스를 포함해 지급해 드렸습니다! 💎',
      receiptTime: new Date(base.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(base.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      _virtual: true,
    },
    {
      receiptId: 'INQ-VIRT-002',
      id: 'INQ-VIRT-002',
      category: 'account',
      categoryLabel: '계정',
      title: '닉네임 변경권은 어디서 사나요?',
      content: '닉네임 변경권 구매 후 사용 방법을 알려주세요.',
      status: INQUIRY_STATUS.processing,
      reply: null,
      receiptTime: new Date(base.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(base.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      _virtual: true,
    },
    {
      receiptId: 'INQ-VIRT-003',
      id: 'INQ-VIRT-003',
      category: 'matchup',
      categoryLabel: '매치업',
      title: '매치업 생성 오류 제보합니다.',
      content: '매치업 생성 시 이미지 업로드가 되지 않습니다.',
      status: INQUIRY_STATUS.received,
      reply: null,
      receiptTime: new Date(base.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(base.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      _virtual: true,
    },
    {
      receiptId: 'OB_20260206_001',
      id: 'OB_20260206_001',
      category: 'appeal',
      categoryLabel: '이의 신청',
      title: '영구 정지 처분 이의 신청',
      content: '안녕하세요. 어제 채팅 중 오해가 있었습니다.\n상대방이 먼저 도발한 캡처본 첨부합니다.',
      status: INQUIRY_STATUS.replied,
      reply: '안녕하세요, 안목대장님.\n보내주신 자료를 면밀히 검토한 결과, 상대방의 선제적 위반 행위가 확인되어 정지 처분을 해제 조치해 드렸습니다. 이용에 불편을 드려 죄송합니다.',
      receiptTime: new Date(base.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      replyAt: new Date(base.getTime() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      attachments: ['evidence_01.jpg'],
      _virtual: true,
    },
  ]
})()

export async function getInquiryHistoryForDisplay(userId) {
  const real = userId ? await getInquiryHistory(userId) : []
  return [...VIRTUAL_ITEMS, ...real]
}

export async function getInquiryByReceiptId(receiptId, userId) {
  const virtual = VIRTUAL_ITEMS.find((item) => item.receiptId === receiptId || item.id === receiptId)
  if (virtual) return virtual
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
