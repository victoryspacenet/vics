/**
 * 공지사항 저장소 — Supabase notices 테이블 사용
 * supabase_notices.sql 을 먼저 실행해 테이블을 생성하세요.
 */
import { supabase } from './supabase'

const TAG_MAP = {
  notice: { tag: '공지',    tagColor: 'bg-gray-100 text-gray-700' },
  event:  { tag: '이벤트',  tagColor: 'bg-amber-100 text-amber-700' },
  update: { tag: '업데이트', tagColor: 'bg-blue-100 text-blue-700' },
  winner: { tag: '당첨자',  tagColor: 'bg-emerald-100 text-emerald-700' },
}

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
    author:           row.author ?? '관리자',
    isBanner:         row.is_banner ?? false,
    isHighlighted:    row.is_highlighted ?? false,
    source:           'admin',
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

/** 관리자가 게시한 공지 목록 조회 */
export async function getAdminNotices() {
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('is_banner', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(normalizeNotice)
  } catch (e) {
    console.warn('[noticeStorage] 조회 실패:', e)
    return []
  }
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
