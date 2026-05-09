/**
 * 콘텐츠 삭제 및 이용 제한 안내 — Supabase `content_deletion_notices`
 */
import { addContentDeletionPush } from './noticePushStorage'
import { supabase } from './supabase'

// 욕설/비속어 패턴 (마스킹용)
const MASK_PATTERNS = [
  /\b시발|씨발|ㅅㅂ|시팔|씨팔\b/gi,
  /\b개새|ㅅㅂ|병신|븅신|ㅂㅅ\b/gi,
  /\bXXX+|xxx+\b/gi,
]

/** 콘텐츠 요약 마스킹 */
export function maskContentSummary(text) {
  if (!text || typeof text !== 'string') return ''
  let result = text
  MASK_PATTERNS.forEach((re) => {
    result = result.replace(re, '...')
  })
  return result
}

function rowToNotice(row) {
  const doc = row.doc && typeof row.doc === 'object' ? row.doc : {}
  return {
    id: row.id,
    createdAt: row.created_at,
    contentType: doc.contentType || '댓글',
    contentCreatedAt: doc.contentCreatedAt || '',
    contentSummary: doc.contentSummary || '',
    contentSummaryMasked: doc.contentSummaryMasked || maskContentSummary(doc.contentSummary || ''),
    violationReasons: Array.isArray(doc.violationReasons) ? doc.violationReasons : [],
    actions: Array.isArray(doc.actions) ? doc.actions : ['해당 콘텐츠 즉시 삭제'],
    restrictionEndAt: doc.restrictionEndAt || null,
    is_read: !!row.is_read,
    userId: row.user_id,
  }
}

/**
 * 삭제 안내 추가 (관리자 신고 승인 등)
 * @param {{ userId: string } & Record<string, unknown>} payload
 */
export async function addContentDeletionNotice(payload) {
  const userId = payload.userId
  if (!userId) {
    console.warn('[contentDeletionNoticeStorage] userId 필요')
    return null
  }
  const doc = {
    contentType: payload.contentType || '댓글',
    contentCreatedAt: payload.contentCreatedAt || '',
    contentSummary: payload.contentSummary || '',
    contentSummaryMasked: maskContentSummary(payload.contentSummary || ''),
    violationReasons: payload.violationReasons || [],
    actions: payload.actions || ['해당 콘텐츠 즉시 삭제'],
    restrictionEndAt: payload.restrictionEndAt || null,
  }
  try {
    const { data, error } = await supabase
      .from('content_deletion_notices')
      .insert({ user_id: userId, doc, is_read: false })
      .select('id, user_id, doc, is_read, created_at')
      .single()
    if (error) throw error
    return rowToNotice(data)
  } catch (e) {
    console.warn('[contentDeletionNoticeStorage] insert 실패:', e)
    return null
  }
}

/** ID로 조회 */
export async function getContentDeletionNotice(id) {
  if (!id) return null
  try {
    const { data, error } = await supabase
      .from('content_deletion_notices')
      .select('id, user_id, doc, is_read, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? rowToNotice(data) : null
  } catch (e) {
    console.warn('[contentDeletionNoticeStorage] 조회 실패:', e)
    return null
  }
}

/** 사용자별 목록 (최신순) */
export async function getContentDeletionNoticesForUser(userId) {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('content_deletion_notices')
      .select('id, user_id, doc, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(rowToNotice)
  } catch (e) {
    console.warn('[contentDeletionNoticeStorage] 목록 실패:', e)
    return []
  }
}

/**
 * 데모용 샘플 (해당 유저에게 안내가 없을 때 1건 생성)
 */
export async function ensureDemoNotice(userId) {
  if (!userId) return null
  const existing = await getContentDeletionNoticesForUser(userId)
  if (existing.length > 0) return existing[0]
  const demo = await addContentDeletionNotice({
    userId,
    contentType: '댓글',
    contentCreatedAt: '02-02 14:20',
    contentSummary: '야 이 XXX들아 ㅋㅋㅋ 이게 뭐야 진짜',
    violationReasons: ['욕설 및 비하 발언', '타인에게 불쾌감을 주는 공격적 언행'],
    actions: ['해당 콘텐츠 즉시 삭제', '서비스 이용 3일 제한'],
    restrictionEndAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (demo?.id) {
    try {
      await addContentDeletionPush({
        userId,
        deletionId: demo.id,
        title: '⚠️ 커뮤니티 가이드 위반 안내',
        body: '회원님의 콘텐츠가 가이드 위반으로 삭제되었습니다. 자세한 내용을 확인하세요.',
      })
    } catch (e) {
      console.warn('[contentDeletionNoticeStorage] 데모 푸시 실패:', e)
    }
  }
  return demo
}

/** 읽음 처리 */
export async function markContentDeletionNoticeRead(id) {
  if (!id) return
  try {
    await supabase.from('content_deletion_notices').update({ is_read: true }).eq('id', id)
  } catch (e) {
    console.warn('[contentDeletionNoticeStorage] 읽음 처리 실패:', e)
  }
}

export function getDeletionNoticePushPayload(notice) {
  return {
    id: notice.id,
    type: 'content_deletion',
    title: '⚠️ 커뮤니티 가이드 위반 안내',
    body: '회원님의 콘텐츠가 가이드 위반으로 삭제되었습니다. 자세한 내용을 확인하세요.',
    linkTo: `/notice/deletion/${notice.id}`,
  }
}
