/**
 * 공지사항 저장소 — Supabase notices 테이블 사용
 * supabase_notices.sql 을 먼저 실행해 테이블을 생성하세요.
 */
import { supabase } from './supabase'
import {
  applyPublicNoticeTitleFilter,
  filterPublicNoticeRows,
  isPublicNoticeTitle,
} from './noticePublicFeed'

const TAG_MAP = {
  notice: { tag: '공지',    tagColor: 'bg-gray-100 text-gray-700' },
  event:  { tag: '이벤트',  tagColor: 'bg-amber-100 text-amber-700' },
  update: { tag: '업데이트', tagColor: 'bg-blue-100 text-blue-700' },
  winner: { tag: '당첨자',  tagColor: 'bg-emerald-100 text-emerald-700' },
}

/** 목록·상세에서 공통으로 쓰는 select 컬럼 (select * 대역폭 완화) */
export const NOTICE_LIST_FIELDS =
  'id, category, title, content, summary, author, is_banner, is_highlighted, target_all, target_tier_id, target_tier_label, target_tier_exact, source, created_at, updated_at'

/** DB row → 컴포넌트에서 쓰는 형태로 변환 */
function normalizeNotice(row) {
  const { tag, tagColor } = TAG_MAP[row.category] || TAG_MAP.notice
  const date = row.created_at
    ? new Date(row.created_at)
        .toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\. /g, '.')
        .replace(/\.$/, '')
    : ''
  return {
    id:               row.id,
    category:         row.category,
    tag,
    tagColor,
    title:            row.title,
    content:          row.content ?? '',
    summary:          row.summary ?? '',
    date,
    /** 이웃 글·정렬 등 DB 쿼리용 */
    createdAtIso:     row.created_at ?? null,
    author:           row.author ?? '관리자',
    isBanner:         row.is_banner ?? false,
    isHighlighted:    row.is_highlighted ?? false,
    source:           row.source ?? 'admin',
    targetAll:        row.target_all ?? true,
    targetTierId:     row.target_tier_id ?? undefined,
    targetTierLabel:  row.target_tier_label ?? undefined,
    targetTierExact:  row.target_tier_exact === true,
  }
}

/** HTML → plain text 요약 */
function makeSummary(content = '') {
  const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 60) + (plain.length > 60 ? '...' : '')
}

/** 같은 탭의 구독자에게 갱신 알림 */
function notifyUpdated() {
  window.dispatchEvent(new CustomEvent('vics:notices:updated'))
}

// ─────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────

/**
 * 공지 목록 (서버 페이징 + count)
 * @param {{ page?: number; pageSize?: number; category?: string; listOnly?: boolean; forPublicFeed?: boolean }} opts
 * - `category`: `'all'`이면 생략, 그 외 `notices.category`와 일치
 * - `listOnly`: true면 상단 배너용 `is_banner=true` 행 제외(일반 목록만)
 * - `forPublicFeed`: true면 `빅스 정식 버전 개봉` 제목만 (유저 `/notice`)
 */
export async function getAdminNoticesPaged({
  page = 1,
  pageSize = 10,
  category = 'all',
  listOnly = false,
  forPublicFeed = false,
} = {}) {
  const safeSize = Math.min(100, Math.max(1, pageSize))
  const safePage = Math.max(1, page)
  const from = (safePage - 1) * safeSize
  const to = from + safeSize - 1

  try {
    let q = supabase
      .from('notices')
      .select(NOTICE_LIST_FIELDS, { count: 'exact' })
      .order('is_banner', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })

    if (category && category !== 'all') {
      q = q.eq('category', category)
    }
    if (listOnly) {
      q = q.eq('is_banner', false)
    }
    q = applyPublicNoticeTitleFilter(q, forPublicFeed)

    const { data, error, count } = await q.range(from, to)
    if (error) throw error
    const rows = forPublicFeed ? filterPublicNoticeRows(data ?? []) : data ?? []
    const notices = rows.map(normalizeNotice)
    return {
      notices,
      totalCount: typeof count === 'number' ? count : notices.length,
    }
  } catch (e) {
    console.warn('[noticeStorage] getAdminNoticesPaged 실패:', e)
    return { notices: [], totalCount: 0 }
  }
}

/**
 * 상단 배너 후보(핀 공지) — 티어 필터는 호출부에서 처리
 * @param {{ limit?: number; category?: string; forPublicFeed?: boolean }} opts category `'all'`이면 생략
 */
export async function getAdminPinnedNoticeCandidates({
  limit = 8,
  category = 'all',
  forPublicFeed = false,
} = {}) {
  try {
    let q = supabase
      .from('notices')
      .select(NOTICE_LIST_FIELDS)
      .eq('is_banner', true)
      .order('created_at', { ascending: false })
      .limit(Math.min(20, Math.max(1, limit)))
    if (category && category !== 'all') {
      q = q.eq('category', category)
    }
    q = applyPublicNoticeTitleFilter(q, forPublicFeed)
    const { data, error } = await q
    if (error) throw error
    const rows = forPublicFeed ? filterPublicNoticeRows(data ?? []) : data ?? []
    return rows.map(normalizeNotice)
  } catch (e) {
    console.warn('[noticeStorage] getAdminPinnedNoticeCandidates 실패:', e)
    return []
  }
}

/** 단건 조회 (수정 화면·상세 등) */
export async function getNoticeById(id, { forPublicFeed = false } = {}) {
  if (!id) return null
  try {
    const { data, error } = await supabase.from('notices').select(NOTICE_LIST_FIELDS).eq('id', id).maybeSingle()
    if (error) throw error
    if (data && forPublicFeed && !isPublicNoticeTitle(data.title)) return null
    return data ? normalizeNotice(data) : null
  } catch (e) {
    console.warn('[noticeStorage] getNoticeById 실패:', e)
    return null
  }
}

/**
 * @deprecated 대량 로드 — `getAdminNoticesPaged` 또는 `getNoticeById` 사용
 * 호환용: 최대 300건만 반환
 */
export async function getAdminNotices() {
  const { notices } = await getAdminNoticesPaged({ page: 1, pageSize: 300, category: 'all' })
  return notices
}

/** 팝업 링크용 공지 옵션 */
export async function getNoticeOptionsForPopup() {
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('id, title')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []).map((n) => ({ id: n.id, title: n.title }))
  } catch (e) {
    console.warn('[noticeStorage] 팝업 옵션 조회 실패:', e)
    return []
  }
}

/** 새 공지 저장 (게시) */
export async function saveNotice({
  category,
  title,
  content,
  author = '관리자',
  isPinned = false,
  isHighlighted = false,
  targetAll = true,
  targetTierId,
  targetTierLabel,
  targetTierExact = false,
}) {
  const { data, error } = await supabase
    .from('notices')
    .insert({
      category,
      title,
      content,
      summary: makeSummary(content),
      author,
      is_banner:     isPinned,
      is_highlighted: isHighlighted,
      target_all:    targetAll,
      target_tier_id:    targetAll ? null : (targetTierId ?? null),
      target_tier_label: targetAll ? null : (targetTierLabel ?? null),
      target_tier_exact: targetAll ? false : !!targetTierExact,
      source: 'admin',
    })
    .select()
    .single()

  if (error) throw error
  notifyUpdated()
  return normalizeNotice(data)
}

/** 기존 공지 수정 */
export async function updateNotice(id, {
  category,
  title,
  content,
  isPinned,
  isHighlighted,
  targetAll,
  targetTierId,
  targetTierLabel,
  targetTierExact = false,
}) {
  const { data, error } = await supabase
    .from('notices')
    .update({
      category,
      title,
      content,
      summary:        makeSummary(content),
      is_banner:      isPinned,
      is_highlighted: isHighlighted,
      target_all:     targetAll,
      target_tier_id:    targetAll ? null : (targetTierId ?? null),
      target_tier_label: targetAll ? null : (targetTierLabel ?? null),
      target_tier_exact: targetAll ? false : !!targetTierExact,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  notifyUpdated()
  return normalizeNotice(data)
}

/** 공지 단건 삭제 (복구 불가) */
export async function deleteNotice(id) {
  if (!id) throw new Error('공지 id가 필요합니다.')
  const { error } = await supabase.from('notices').delete().eq('id', id)
  if (error) throw error
  notifyUpdated()
}

/** 공지 다건 삭제 */
export async function deleteNotices(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (unique.length === 0) return
  const { error } = await supabase.from('notices').delete().in('id', unique)
  if (error) throw error
  notifyUpdated()
}
