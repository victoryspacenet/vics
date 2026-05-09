/** 고객문의 관리 — Supabase `inquiry_reply_templates` + `admin_ui_config`(목 데모 오버레이) */

import { supabase } from './supabase'
import { getAdminUiJson, setAdminUiJson } from './adminUiConfig'

const OVERRIDES_KEY = 'inquiry_admin_overrides_v1'

export const ADMIN_STATUS = {
  pending: 'pending',
  completed: 'completed',
}

export const INQUIRY_CATEGORIES = [
  { id: 'point', label: '포인트' },
  { id: 'account', label: '계정/인증' },
  { id: 'matchup', label: '매치업' },
  { id: 'report', label: '신고' },
  { id: 'bug', label: '버그/제보' },
  { id: 'suggestion', label: '건의' },
  { id: 'etc', label: '기타' },
]

const DEFAULT_TEMPLATES = [
  {
    id: 't1',
    name: '결제/포인트 문의',
    body: `안녕하세요, {nickname}님! VICTORYSPACE 고객센터입니다.
결제 관련으로 불편을 드려 정말 죄송합니다.
보내주신 영수증 확인 결과, 스토어 승인 지연으로 확인되어 담당 부서에 전달했습니다. 24시간 이내에 포인트가 반영될 예정입니다.
추가 문의사항이 있으시면 언제든 연락 주세요.`,
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
]

const MOCK_INQUIRIES = (() => {
  const h = (n) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString()
  return [
    // 미답변 (SLA 12h 이내)
    { id: 'ADM-005', receiptId: 'INQ-260203-I9J0', status: ADMIN_STATUS.pending, category: 'report', categoryLabel: '신고', title: '욕설 유저 신고합니다', nickname: '별빛사냥꾼', createdAt: h(3), content: '특정 유저가 댓글에서 지속적으로 욕설을 사용하고 있어요.', attachments: [], userLevel: 8, userTier: 'Star', userJoinedAt: '2026.02.01', reply: null, internalMemo: null },
    // 미답변 SLA초과 (36h 경과)
    { id: 'ADM-009', receiptId: 'INQ-260130-Q7R8', status: ADMIN_STATUS.pending, category: 'bug', categoryLabel: '버그/제보', title: '앱 실행 시 튕겨요 (iOS)', nickname: '아이폰마스터', createdAt: h(36), content: 'iOS 17.4 업데이트 이후 앱 실행 시 3초 만에 종료됩니다.', attachments: ['screenshot_ios.png'], userLevel: 20, userTier: 'Master', userJoinedAt: '2025.08.15', reply: null, internalMemo: null },
    // 완료
    { id: 'ADM-004', receiptId: 'INQ-260130-G7H8', status: ADMIN_STATUS.completed, category: 'matchup', categoryLabel: '매치업', title: '투표 결과가 이상해요', nickname: '루키안목', createdAt: h(72), content: '제가 투표한 항목이 결과에 반영이 안 된 것 같아요.', attachments: [], userLevel: 12, userTier: 'Star', userJoinedAt: '2025.11.20', reply: '확인 결과 정상 처리된 것으로 확인됩니다.', internalMemo: null },
  ]
})()

function mergeMockWithOverrides(saved) {
  const normalized = (saved || []).map((s) =>
    s.status === 'processing' ? { ...s, status: ADMIN_STATUS.pending } : s
  )
  const merged = [...MOCK_INQUIRIES]
  normalized.forEach((s) => {
    const idx = merged.findIndex((m) => m.id === s.id || m.receiptId === s.receiptId)
    if (idx >= 0) merged[idx] = { ...merged[idx], ...s }
    else merged.unshift(s)
  })
  return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function getAdminInquiries() {
  try {
    const saved = (await getAdminUiJson(OVERRIDES_KEY, [])) || []
    return mergeMockWithOverrides(Array.isArray(saved) ? saved : [])
  } catch {
    return mergeMockWithOverrides([])
  }
}

export async function getAdminInquiryById(id) {
  const list = await getAdminInquiries()
  return list.find((i) => i.id === id || i.receiptId === id) || null
}

export async function updateAdminInquiry(id, updates) {
  try {
    const saved = [...((await getAdminUiJson(OVERRIDES_KEY, [])) || [])]
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
  try {
    const { data, error } = await supabase.from('inquiry_reply_templates').select('id, name, body').order('updated_at', { ascending: false })
    if (error) throw error
    if (data && data.length > 0) {
      return data.map((r) => ({ id: r.id, name: r.name, body: r.body }))
    }
  } catch (e) {
    console.warn('[inquiryAdminStorage] 템플릿 조회 실패:', e)
  }
  return DEFAULT_TEMPLATES
}

export async function getTemplateBody(templateId, nickname = '고객') {
  const templates = await getReplyTemplates()
  const t = templates.find((x) => x.id === templateId)
  if (!t) return ''
  return (t.body || '').replace(/\{nickname\}/g, nickname)
}

export async function getAdminStats() {
  const list = await getAdminInquiries()
  const real = {
    pending: list.filter((i) => i.status === ADMIN_STATUS.pending).length,
    completed: list.filter((i) => i.status === ADMIN_STATUS.completed).length,
  }
  if (real.pending + real.completed < 1) {
    return { pending: 2, completed: 1 }
  }
  return real
}

export async function getNextPendingInquiry() {
  const list = await getAdminInquiries()
  const waiting = list.filter((i) => i.status === ADMIN_STATUS.pending)
  return waiting[waiting.length - 1] || null
}

export async function getPendingCount() {
  const list = await getAdminInquiries()
  return list.filter((i) => i.status === ADMIN_STATUS.pending).length
}
