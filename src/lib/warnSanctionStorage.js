/**
 * 경고 발송 및 제재 — Supabase `user_moderation_warnings`, `user_moderation_restrictions`
 */
import { setCautionForPeriod } from './userAdminStorage'
import { supabase } from './supabase'

export const WARN_REASONS = [
  { id: 'bad_language', label: '부적절한 언어 사용' },
  { id: 'harassment', label: '타인 비방 및 도배' },
  { id: 'fake_news', label: '허위 사실 유포' },
  { id: 'etc', label: '기타' },
]

export const RESTRICTION_TYPES = [
  { id: 'vote', label: '투표 금지' },
  { id: 'comment', label: '댓글 금지' },
  { id: 'matchup_create', label: '매치업 생성 금지' },
]

function restrictionTypeLabel(id) {
  const row = RESTRICTION_TYPES.find((t) => t.id === id)
  if (row) return row.label
  if (id === 'chat') return '댓글 금지'
  if (id === 'ranking') return '매치업 생성 금지'
  return id
}

export const RESTRICTION_PERIODS = [
  { id: '24h', label: '24시간', hours: 24 },
  { id: '3d', label: '3일', hours: 72 },
  { id: '7d', label: '7일', hours: 168 },
]

function payloadToHistoryRow(payload) {
  return {
    date: payload.date,
    reasonId: payload.reasonId,
    reasonLabel: payload.reasonLabel,
    message: payload.message,
    restrictions: payload.restrictions || [],
    periodHours: payload.periodHours ?? 0,
  }
}

/** 데모용: 이미 해제된 제한 추가 */
export async function addDemoEndedRestriction(userId) {
  if (!userId) return
  const endedAt = Date.now() - 60 * 60 * 1000
  try {
    await supabase.from('user_moderation_restrictions').insert({
      subject_user_id: userId,
      types: ['vote', 'comment'],
      ends_at_ms: endedAt,
      date_label: new Date(endedAt).toISOString().slice(0, 10).replace(/-/g, '.'),
    })
  } catch (e) {
    console.warn('[warnSanctionStorage] 데모 제한 추가 실패:', e)
  }
}

/** 누적 경고 횟수 */
export async function getWarningCount(userId) {
  if (!userId) return 0
  try {
    const { count, error } = await supabase
      .from('user_moderation_warnings')
      .select('*', { count: 'exact', head: true })
      .eq('subject_user_id', String(userId))
    if (error) throw error
    return count ?? 0
  } catch (e) {
    console.warn('[warnSanctionStorage] 경고 수 조회 실패:', e)
    return 0
  }
}

/** 경고 이력 (최신순) */
export async function getWarningHistory(userId) {
  if (!userId) return []
  try {
    const { data, error } = await supabase
      .from('user_moderation_warnings')
      .select('payload, created_at')
      .eq('subject_user_id', String(userId))
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => {
      const p = row.payload && typeof row.payload === 'object' ? row.payload : {}
      return payloadToHistoryRow({
        date: p.date || new Date(row.created_at).toISOString().slice(0, 10).replace(/-/g, '.'),
        reasonId: p.reasonId,
        reasonLabel: p.reasonLabel,
        message: p.message,
        restrictions: p.restrictions,
        periodHours: p.periodHours,
      })
    })
  } catch (e) {
    console.warn('[warnSanctionStorage] 경고 이력 실패:', e)
    return []
  }
}

/** 최근 제재 이력 (문구) */
export async function getLastSanctionLabel(userId, sanctionsFromDetail = []) {
  const history = await getWarningHistory(userId)
  if (history.length > 0) {
    const last = history[0]
    return `경고 ${last?.reasonLabel ?? '발송'} (${last?.date ?? ''})`
  }
  if (sanctionsFromDetail?.length > 0) {
    const s = sanctionsFromDetail[sanctionsFromDetail.length - 1]
    return `${s.text} (${s.date})`
  }
  return '없음'
}

/** 최근 제재 일자 */
export async function getLastSanctionDate(userId, sanctionsFromDetail = []) {
  const history = await getWarningHistory(userId)
  if (history.length > 0) return history[0].date
  if (sanctionsFromDetail?.length > 0) {
    return sanctionsFromDetail[sanctionsFromDetail.length - 1].date
  }
  return null
}

const MATCHUP_SUSPEND_RESTRICTIONS = ['vote', 'comment', 'matchup_create']

/**
 * 매치업 관리 유저 정지
 */
export async function applyMatchupAdminUserSuspension({ recipientUserIds, matchupId, title }) {
  if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
    return { applied: 0 }
  }
  const msg = `매치업 #${matchupId} 「${title}」 관련으로 투표·댓글·매치업 생성이 일시 제한(유저 정지)되었습니다.`
  for (const userId of recipientUserIds) {
    await sendWarning(userId, {
      reasonId: 'etc',
      reasonLabel: '매치업 관리 유저 정지',
      message: msg,
      restrictions: MATCHUP_SUSPEND_RESTRICTIONS,
      periodHours: 168,
    })
  }
  return { applied: recipientUserIds.length }
}

/** 경고 발송 + 제한 플래그 저장 (매너 점수 차감 없음) */
export async function sendWarning(userId, payload) {
  const { reasonId, reasonLabel, message, restrictions, periodHours, customDays } = payload
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.')

  const warnPayload = {
    date,
    reasonId,
    reasonLabel,
    message,
    restrictions: restrictions || [],
    periodHours: periodHours ?? (customDays ? customDays * 24 : 0),
  }

  let warningId = null
  try {
    const { data: wRow, error: wErr } = await supabase
      .from('user_moderation_warnings')
      .insert({
        subject_user_id: userId,
        payload: warnPayload,
      })
      .select('id')
      .single()
    if (wErr) throw wErr
    warningId = wRow?.id ?? null
  } catch (e) {
    console.warn('[warnSanctionStorage] 경고 insert 실패:', e)
  }

  if (restrictions && restrictions.length > 0) {
    const hrs = periodHours ?? (customDays ? customDays * 24 : 24)
    const endsAt = Date.now() + hrs * 60 * 60 * 1000
    try {
      await supabase.from('user_moderation_restrictions').insert({
        subject_user_id: userId,
        types: restrictions,
        ends_at_ms: endsAt,
        date_label: date,
        source_warning_id: warningId,
      })
    } catch (e) {
      console.warn('[warnSanctionStorage] 제한 insert 실패:', e)
    }
    await setCautionForPeriod(userId, endsAt)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vics:restriction:updated'))
    }
  }

  return { warningId }
}

/**
 * 활성 이용 제한 요약 (접속 제한 화면·가드용)
 * — `user_moderation_restrictions` 중 ends_at_ms > now 인 행을 합산
 */
export async function getActiveRestrictionSummary(userId) {
  if (!userId) return null
  const uid = String(userId)
  const now = Date.now()
  try {
    const { data: rows, error } = await supabase
      .from('user_moderation_restrictions')
      .select('types, ends_at_ms, date_label, created_at, source_warning_id')
      .eq('subject_user_id', uid)
      .gt('ends_at_ms', now)
    if (error) throw error
    if (!rows?.length) return null

    const endsAtMs = Math.max(...rows.map((r) => Number(r.ends_at_ms) || 0))
    const startedAtMs = Math.min(
      ...rows.map((r) => {
        const t = r.created_at ? new Date(r.created_at).getTime() : now
        return Number.isFinite(t) ? t : now
      }),
    )

    const sortedByCreated = [...rows].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
    )
    const sanctionWarningId =
      sortedByCreated.find((r) => r.source_warning_id)?.source_warning_id ?? null

    const typeSet = new Set()
    rows.forEach((r) => {
      (Array.isArray(r.types) ? r.types : []).forEach((t) => typeSet.add(t))
    })
    const typeLabels = [...typeSet].map(restrictionTypeLabel).filter(Boolean)
    const targetText =
      typeLabels.length > 0 ? typeLabels.join(' · ') : '일부 서비스 이용'

    const { data: warnRow, error: warnErr } = await supabase
      .from('user_moderation_warnings')
      .select('payload')
      .eq('subject_user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (warnErr) console.warn('[warnSanctionStorage] 경고 payload 조회:', warnErr.message)

    const p = warnRow?.payload && typeof warnRow.payload === 'object' ? warnRow.payload : {}
    let reasonText = ''
    if (p.reasonLabel && p.message) reasonText = `${p.reasonLabel} — ${p.message}`
    else if (p.reasonLabel) reasonText = String(p.reasonLabel)
    else if (p.message) reasonText = String(p.message)
    else reasonText = '커뮤니티 가이드라인 위반'

    const fmt = (ts) => {
      const d = new Date(ts)
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    }

    return {
      endsAtMs,
      reasonText,
      targetText,
      startDateFmt: fmt(startedAtMs),
      endDateFmt: fmt(endsAtMs),
      typeLabels,
      sanctionWarningId,
    }
  } catch (e) {
    console.warn('[warnSanctionStorage] 활성 제한 요약 조회 실패:', e)
    return null
  }
}

/** 활성 이용 제한이 하나라도 있으면 true */
export async function hasActiveModerationRestriction(userId) {
  const s = await getActiveRestrictionSummary(userId)
  return s != null
}

/** 현재 적용 중인 제한 */
export async function getActiveRestrictions(userId) {
  if (!userId) {
    return { vote: false, comment: false, matchup_create: false }
  }
  const now = Date.now()
  try {
    const { data, error } = await supabase
      .from('user_moderation_restrictions')
      .select('types')
      .eq('subject_user_id', String(userId))
      .gt('ends_at_ms', now)
    if (error) throw error
    const list = data || []
    if (list.length === 0) {
      return { vote: false, comment: false, matchup_create: false }
    }
    const merged = list.reduce((acc, row) => {
      const types = Array.isArray(row.types) ? row.types : []
      types.forEach((t) => {
        acc[t] = true
        if (t === 'chat') acc.comment = true
        if (t === 'ranking') acc.matchup_create = true
      })
      return acc
    }, {})
    return {
      vote: !!merged.vote,
      comment: !!(merged.comment || merged.chat),
      matchup_create: !!(merged.matchup_create || merged.ranking),
    }
  } catch (e) {
    console.warn('[warnSanctionStorage] 활성 제한 조회 실패:', e)
    return { vote: false, comment: false, matchup_create: false }
  }
}

/** 가장 최근에 해제된 제한 */
export async function getRecentlyEndedRestriction(userId) {
  if (!userId) return null
  const now = Date.now()
  try {
    const { data, error } = await supabase
      .from('user_moderation_restrictions')
      .select('types, ends_at_ms, date_label')
      .eq('subject_user_id', String(userId))
      .lte('ends_at_ms', now)
      .order('ends_at_ms', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      types: data.types || [],
      endsAt: Number(data.ends_at_ms),
      date: data.date_label || '',
    }
  } catch (e) {
    console.warn('[warnSanctionStorage] 종료된 제한 조회 실패:', e)
    return null
  }
}
