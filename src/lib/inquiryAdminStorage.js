/** 고객문의 관리 — Supabase `inquiries` + `inquiry_reply_templates` + 선택적 `admin_ui_config` 오버레이 */

import { supabase } from './supabase'
import { getAdminUiJson, setAdminUiJson } from './adminUiConfig'
import { getAutoReplyExcludedInquiryIds } from './inquiryAdminAutoReplyIds'

const OVERRIDES_KEY = 'inquiry_admin_overrides_v1'

/** 예전 목(오버레이) 데모 id — admin_ui_config 에 남아 있으면 제거 */
const DEMO_ADMIN_INQUIRY_ID_RE = /^ADM-\d+$/i

export const ADMIN_STATUS = {
  pending: 'pending',
  completed: 'completed',
}

/** 1:1 문의 폼에서 제거됨 — `appeals` 테이블·/admin/appeals 로만 접수 */
export const INQUIRY_CATEGORY_APPEAL = 'appeal'

export const INQUIRY_CATEGORIES = [
  { id: 'point', label: '포인트' },
  { id: 'account', label: '계정/인증' },
  { id: 'matchup', label: '매치업' },
  { id: 'report', label: '신고' },
  { id: 'bug', label: '버그/제보' },
  { id: 'suggestion', label: '건의' },
  { id: 'etc', label: '기타' },
]

/** 관리자 1:1 문의 목록·집계에서 제외 (이의는 appeals 전용) */
export function applyInquiryAdminListExclusions(q) {
  return q.neq('category', INQUIRY_CATEGORY_APPEAL)
}

const DEFAULT_TEMPLATES = [
  {
    id: 't1',
    name: '포인트 지급 누락',
    body: `헉, {닉네임}님! 소중한 보상이 아직 도착하지 않았나요? 많이 기다리셨죠! 😭
확인 결과, {원인: }으로 인해 지급이 늦어진 것으로 파악되었습니다. 방금 포인트를 정상 지급해 드렸으니 [Point Reward Center]를 확인해 주세요! 불편을 드려 죄송합니다. 🎁`,
  },
  {
    id: 't2',
    name: '비밀번호 분실',
    body: `안녕하세요, {nickname}님!
비밀번호 재설정은 로그인 화면에서 "비밀번호를 잊으셨나요?"를 탭하시면 이메일로 재설정 링크를 보내드립니다.
소셜 로그인(Google, Kakao 등)으로 가입하신 경우, 해당 서비스의 비밀번호 설정을 확인해 주세요.`,
  },
  {
    id: 't3',
    name: '포인트 지급 기준',
    body: `안녕하세요, {nickname}님!
포인트는 매치업 결과 확정 후 24시간 이내에 자동 지급됩니다.
마이페이지/랭킹페이지에서 내 포인트 현황을 확인하실 수 있어요.`,
  },
  {
    id: 't4',
    name: '닉네임 변경',
    body: `안녕하세요, {nickname}님!
닉네임은 마이페이지 → 프로필 수정에서 변경 가능합니다.
변경 후 같은 시즌 동안 재변경이 제한되며, 한 시즌에 1회 변경 가능하니 참고해 주세요.`,
  },
  {
    id: 't5',
    name: '주제 불일치 매치업 반려',
    body: `안녕하세요, {닉네임}님! 빅스 운영팀입니다. 🔥
신청해주신 매치업을 확인해 보았으나, 아쉽게도 이번 경쟁은 [주제 불일치] 사유로 반려되었습니다. 😢
팁: 다른 유저들이 더 재미있게 투표할 수 있도록, 주제와 딱 맞는 게시물로 다시 한번 도전해 보시겠어요? {닉네임}님의 센스 있는 다음 매치업을 기다릴게요!`,
  },
  {
    id: 't6',
    name: '부적절 게시물 신고',
    body: `안녕하세요, {닉네임}님! 깨끗한 victoryspace를 위해 제보해주셔서 감사합니다. 🙏
제보해주신 게시물은 운영 정책에 따라 [즉시 삭제 및 해당 유저 경고] 조치가 완료되었습니다. 저희 빅스는 모두가 즐겁게 경쟁할 수 있는 환경을 지향합니다. 앞으로도 이상한 게시물을 발견하시면 언제든 알려주세요! (포상으로 소정의 포인트를 지급해 드렸어요! 💎)`,
  },
  {
    id: 't7',
    name: '계정 연동&로그인 오류',
    body: `이용에 불편을 드려 죄송합니다, {닉네임}님! 🛠️
현재 {소셜 플랫폼 명: 카카오/구글 등} 연동 과정에서 일시적인 통신 장애가 발생한 것으로 보입니다. 아래 방법을 시도해 보시겠어요?
*앱/웹 브라우저를 완전히 종료 후 재접속*`,
  },
  {
    id: 't8',
    name: '새로운 기능&카테고리',
    body: `와! {닉네임}님, 정말 천재적인 아이디어네요! 💡
제안해주신 ''은 저희 기획팀에서도 "오, 이건 진짜 재밌겠다!"라며 긍정적으로 검토하기 시작했습니다. 모든 아이디어를 바로 적용하긴 어렵지만, {닉네임}님 같은 열정적인 유저분들의 의견이 빅스를 성장시키는 큰 힘이 됩니다. 업데이트 소식을 기대해 주세요! 🚀`,
  },
  {
    id: 't9',
    name: '투표 부정행위 신고',
    body: `공정한 경쟁을 위해 예리하게 지켜봐 주셔서 감사합니다! 🕵️‍♂️
해당 매치업의 투표 로그를 전수 조사한 결과, {조치 내용:  } 처리를 완료했습니다. 빅스는 정정당당한 경쟁만을 지지합니다. 앞으로도 의심스러운 정황이 있다면 주저 말고 제보해 주세요! (포상으로 소정의 포인트를 지급해 드렸어요! 💎)`,
  },
]

function isDemoAdminInquiry(item) {
  if (!item || typeof item !== 'object') return false
  return DEMO_ADMIN_INQUIRY_ID_RE.test(String(item.id || '').trim())
}

function normalizeOverrideRow(s) {
  return s.status === 'processing' ? { ...s, status: ADMIN_STATUS.pending } : s
}

async function loadSavedOverrides() {
  const saved = (await getAdminUiJson(OVERRIDES_KEY, [])) || []
  const arr = Array.isArray(saved) ? saved.map(normalizeOverrideRow) : []
  const cleaned = arr.filter((s) => !isDemoAdminInquiry(s))
  if (cleaned.length !== arr.length) {
    await setAdminUiJson(OVERRIDES_KEY, cleaned)
  }
  return cleaned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

function applyAutoReplyExclusionToQuery(q, autoInquiryIds) {
  if (!autoInquiryIds?.length) return q
  return q.not('id', 'in', `(${autoInquiryIds.join(',')})`)
}

/** @deprecated 목업 제거 — Supabase 미연동 레거시 오버레이만 (보통 빈 배열) */
export async function getAdminInquiries() {
  try {
    return await loadSavedOverrides()
  } catch {
    return []
  }
}

export async function getAdminInquiryById(id) {
  const list = await getAdminInquiries()
  return list.find((i) => i.id === id || i.receiptId === id) || null
}

export async function updateAdminInquiry(id, updates) {
  try {
    const saved = [...(await loadSavedOverrides())]
    const existing = await getAdminInquiryById(id)
    const base = existing || { id }
    const item = { ...base, ...updates }
    const idx = saved.findIndex((s) => s.id === id || s.receiptId === id)
    if (idx >= 0) saved[idx] = item
    else saved.unshift(item)
    await setAdminUiJson(OVERRIDES_KEY, saved)
    return item
  } catch {
    return null
  }
}

export async function getReplyTemplates() {
  const defaultIds = new Set(DEFAULT_TEMPLATES.map((d) => d.id))
  try {
    const { data, error } = await supabase.from('inquiry_reply_templates').select('id, name, body').order('updated_at', { ascending: false })
    if (error) throw error
    const rows = data || []
    const extras = rows.filter((r) => !defaultIds.has(r.id)).map((r) => ({ id: r.id, name: r.name, body: r.body }))
    return [...DEFAULT_TEMPLATES.map((d) => ({ id: d.id, name: d.name, body: d.body })), ...extras]
  } catch (e) {
    console.warn('[inquiryAdminStorage] 템플릿 조회 실패:', e)
  }
  return DEFAULT_TEMPLATES.map((d) => ({ id: d.id, name: d.name, body: d.body }))
}

export async function getTemplateBody(templateId, nickname = '고객') {
  const templates = await getReplyTemplates()
  const t = templates.find((x) => x.id === templateId)
  if (!t) return ''
  const nick = nickname || '고객'
  return String(t.body || '')
    .replace(/\{nickname\}/g, nick)
    .replace(/\{닉네임\}/g, nick)
    .replace(/\{원인\s*:\s*\}/g, '일시적인 처리 지연')
    .replace(/\{소셜 플랫폼 명:\s*카카오\/구글 등\}/g, '카카오·구글 등')
    .replace(/\{제안 내용\}/g, '')
    .replace(/\{조치 내용\s*:\s*\}/g, '이상 투표에 대한 제재 및 정정')
}

export async function getAdminStats() {
  const list = await getAdminInquiries()
  return {
    pending: list.filter((i) => i.status === ADMIN_STATUS.pending).length,
    completed: list.filter((i) => i.status === ADMIN_STATUS.completed).length,
  }
}

/** Supabase 미답변 문의 1건 (오래된 순, 자동응답 제외) */
export async function getNextPendingInquiry() {
  try {
    const autoIds = await getAutoReplyExcludedInquiryIds()
    let q = applyInquiryAdminListExclusions(
      supabase
        .from('inquiries')
        .select('id, receipt_id, created_at')
        .neq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(1),
    )
    q = applyAutoReplyExclusionToQuery(q, autoIds)
    const { data, error } = await q.maybeSingle()
    if (error) throw error
    if (!data) return null
    return { id: data.id, receiptId: data.receipt_id, createdAt: data.created_at }
  } catch (e) {
    console.warn('[inquiryAdminStorage] getNextPendingInquiry', e)
    return null
  }
}

export async function getPendingCount() {
  try {
    const autoIds = await getAutoReplyExcludedInquiryIds()
    let q = applyInquiryAdminListExclusions(
      supabase.from('inquiries').select('id', { count: 'exact', head: true }).neq('status', 'completed'),
    )
    q = applyAutoReplyExclusionToQuery(q, autoIds)
    const { count, error } = await q
    if (error) throw error
    return typeof count === 'number' ? count : 0
  } catch (e) {
    console.warn('[inquiryAdminStorage] getPendingCount', e)
    return 0
  }
}
