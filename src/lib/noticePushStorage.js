/**
 * 공지·제재·이의 등 시스템 알림 — Supabase `notifications` + RPC
 * FCM: Netlify Functions(관리자 JWT 또는 본인 한정)로 네이티브 기기 보조 알림
 */
import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'

function dispatchNotifUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('vics:notifications:updated'))
  } catch {
    void 0
  }
}

async function dispatchFcmNoticeTopic({ title, body, noticeId }) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch(resolveSiteUrl('/api/fcm-notice-broadcast'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body: typeof body === 'string' ? body : '',
        ...(noticeId ? { noticeId: String(noticeId) } : {}),
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[noticePushStorage] fcm-notice-broadcast:', res.status, t)
    }
  } catch (e) {
    console.warn('[noticePushStorage] fcm-notice-broadcast:', e)
  }
}

async function dispatchFcmTargetedUsers({ userIds, title, body, data }) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : []
    if (!ids.length) return
    const res = await fetch(resolveSiteUrl('/api/fcm-send-users'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds: ids.map(String),
        title,
        body: typeof body === 'string' ? body : '',
        data: data && typeof data === 'object' ? data : {},
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[noticePushStorage] fcm-send-users:', res.status, t)
    }
  } catch (e) {
    console.warn('[noticePushStorage] fcm-send-users:', e)
  }
}

/** 공지 게시 시 전 유저 알림 (RPC) */
export async function addNoticePush({ noticeId, title, body }) {
  const { data, error } = await supabase.rpc('broadcast_notice_push', {
    p_notice_id: noticeId,
    p_title: title,
    p_body: body,
  })
  if (error) {
    console.error('[noticePushStorage] broadcast_notice_push:', error.message)
    throw error
  }
  dispatchNotifUpdated()
  void dispatchFcmNoticeTopic({ title, body, noticeId })
  return typeof data === 'number' ? data : 0
}

/** 콘텐츠 삭제 안내 알림 (대상 유저 1명) */
export async function addContentDeletionPush({ userId, deletionId, title, body }) {
  if (!userId) {
    console.warn('[noticePushStorage] addContentDeletionPush: userId 필요')
    return null
  }
  const { error } = await supabase.rpc('create_user_notification', {
    p_user_id: userId,
    p_type: 'content_deletion',
    p_title: title || '⚠️ 커뮤니티 가이드 위반 안내',
    p_body: body || '회원님의 콘텐츠가 가이드 위반으로 삭제되었습니다. 자세한 내용을 확인하세요.',
    p_payload: { deletionId: deletionId || null },
    p_related_notice_id: null,
  })
  if (error) {
    console.error('[noticePushStorage] content_deletion push:', error.message)
    throw error
  }
  dispatchNotifUpdated()
  const delId = deletionId != null ? String(deletionId) : ''
  void dispatchFcmTargetedUsers({
    userIds: [userId],
    title: title || '⚠️ 커뮤니티 가이드 위반 안내',
    body: body || '회원님의 콘텐츠가 가이드 위반으로 삭제되었습니다. 자세한 내용을 확인하세요.',
    data: {
      type: 'content_deletion',
      route: delId ? `/notice/deletion/${delId}` : '/notice/deletion',
      deletionId: delId,
    },
  })
  return true
}

/** 이용 제한 해제 안내 (대상 유저 1명) */
export async function addRestrictionLiftPush({ userId, nickname, avatarUrl, title, body, endsAtMs }) {
  if (!userId) return null
  const { error } = await supabase.rpc('create_user_notification', {
    p_user_id: userId,
    p_type: 'restriction_lift',
    p_title: title || '🏠 기다렸어요! 이용 제한이 해제되었습니다.',
    p_body:
      body ||
      `${nickname || '회원'}님, 이제 다시 VICTORYSPACE의 모든 활동이 가능해요. 지금 바로 확인해보세요! ✨`,
    p_payload: {
      nickname: nickname || null,
      avatarUrl: avatarUrl || null,
      endsAtMs: typeof endsAtMs === 'number' ? endsAtMs : null,
    },
    p_related_notice_id: null,
  })
  if (error) {
    console.error('[noticePushStorage] restriction_lift push:', error.message)
    throw error
  }
  dispatchNotifUpdated()
  void dispatchFcmTargetedUsers({
    userIds: [userId],
    title: title || '🏠 기다렸어요! 이용 제한이 해제되었습니다.',
    body:
      body ||
      `${nickname || '회원'}님, 이제 다시 VICTORYSPACE의 모든 활동이 가능해요. 지금 바로 확인해보세요! ✨`,
    data: { type: 'restriction_lift', route: '/matchups' },
  })
  return true
}

/**
 * 이의 신청 결과 통보 (대상 유저 1명)
 * @param {{ userId: string, receiptId: string, decision: string }} params
 */
export async function addAppealResultPush({ userId, receiptId, decision }) {
  if (!userId) {
    console.warn('[noticePushStorage] addAppealResultPush: userId 필요')
    return null
  }
  const isApproved = decision === 'approve'
  const title = isApproved
    ? '✨ 이의 신청 결과, 제재가 해제되었습니다.'
    : '이의 신청 심사 결과가 등록되었습니다.'
  const body = isApproved ? '다시 만나서 반가워요! ✨' : '상세 내용을 확인해 주세요.'
  const { error } = await supabase.rpc('create_user_notification', {
    p_user_id: userId,
    p_type: 'appeal_result',
    p_title: title,
    p_body: body,
    p_payload: { receiptId: receiptId || '', decision: decision || '' },
    p_related_notice_id: null,
  })
  if (error) {
    console.error('[noticePushStorage] appeal_result push:', error.message)
    throw error
  }
  dispatchNotifUpdated()
  const rid = receiptId != null ? String(receiptId) : ''
  void dispatchFcmTargetedUsers({
    userIds: [userId],
    title,
    body,
    data: {
      type: 'appeal_result',
      route: rid ? `/appeal-result/${encodeURIComponent(rid)}` : '/appeal-result',
      receiptId: rid,
      decision: String(decision || ''),
    },
  })
  return true
}
