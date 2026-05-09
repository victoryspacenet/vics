import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Settings, Home, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useUIStore } from '../../store/uiStore'

const SLA_OPTIONS = ['6h', '12h', '24h']

const STATIC_SECTIONS = [
  {
    id: 'account',
    title: '[1] 계정 및 보안 (Account & Security)',
    items: [
      { id: 'admins',      label: '운영자 계정 관리',    desc: '관리자 추가, 삭제 및 접속 이력 확인',         action: '바로가기', href: '/admin/settings/operators' },
      { id: 'permissions', label: '권한 그룹 설정',       desc: '메뉴별 접근 권한(읽기/쓰기) 등급 부여',       action: '바로가기', href: '/admin/settings/permissions' },
      { id: '2fa',         label: '2단계 인증(2FA)',      desc: '보안 강화를 위한 OTP 및 로그인 인증 설정',     action: '바로가기', href: '/admin/settings/2fa' },
    ],
  },
  {
    id: 'policy',
    title: '[2] 서비스 운영 정책 (Operational Policy)',
    items: [
      { id: 'sla',     label: 'SLA 처리 기준',    desc: '미처리 문의 리마인드 기준(시간). 저장값은 DB 함수·스케줄 작업이 사용합니다.', type: 'sla' },
      { id: 'bot',     label: '자동 답변/봇 설정', desc: '유저 문의 시 1차 자동 응대 시나리오 관리', action: '편집하기', href: '/admin/settings/autobot' },
      { id: 'banned',  label: '금칙어 관리',       desc: '서비스 내 부적절한 단어 필터링 리스트 관리', action: '편집하기', href: '/admin/settings/banned-words' },
    ],
  },
  {
    id: 'integration',
    title: '[3] 시스템 알림 및 연동 (Integration)',
    items: [
      { id: 'messenger', label: '외부 메신저 연동', desc: 'Slack, Notion 등 업무용 툴 연동 관리',             action: '연동 관리', href: '/admin/settings/messenger' },
      { id: 'push',      label: '시스템 푸시 설정', desc: '서버 오류, 대량 트래픽 발생 시 관리자 알림',       action: '편집하기', href: '/admin/settings/system-push' },
      { id: 'api',       label: 'API 키 관리',      desc: '외부 서비스 연동을 위한 인증키 발급 및 관리',      action: '관리',   href: '/admin/settings/api-keys' },
    ],
  },
]

async function loadSLA() {
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'sla')
    .single()
  return data?.value?.hours ? `${data.value.hours}h` : '12h'
}

async function saveSLA(valueStr) {
  const hours = parseInt(valueStr, 10)
  await supabase
    .from('admin_settings')
    .upsert({ key: 'sla', value: { hours } }, { onConflict: 'key' })
}

export function AdminSettingsPage() {
  const { showToast } = useUIStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [slaValue, setSlaValue] = useState('12h')
  const [slaLoading, setSlaLoading] = useState(true)
  const [slaDirty, setSlaDirty] = useState(false)

  useEffect(() => {
    loadSLA().then((v) => { setSlaValue(v); setSlaLoading(false) })
  }, [])

  const handleSlaChange = (v) => { setSlaValue(v); setSlaDirty(true) }

  const handleSaveSLA = async () => {
    await saveSLA(slaValue)
    setSlaDirty(false)
    showToast(`SLA 기준이 ${slaValue}로 저장됐어요.`, 'success')
  }

  const filteredSections = (() => {
    if (!searchQuery.trim()) return STATIC_SECTIONS
    const q = searchQuery.trim().toLowerCase()
    return STATIC_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q)
      ),
    })).filter((s) => s.items.length > 0)
  })()

  return (
    <div className="max-w-4xl">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-gray-600" />
          <div>
            <h1 className="text-xl font-black text-[#22282E]">설정 센터</h1>
            <p className="text-sm text-gray-500">관리자: 운영팀장 (Master)</p>
          </div>
        </div>
      </div>

      {/* 설명 + 검색 */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-[#22282E] mb-1">시스템 환경 설정</h2>
        <p className="text-sm text-gray-500 mb-4">
          어드민 운영 정책 및 서비스 기본 환경을 관리합니다.
        </p>
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 설정 검색..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {/* 설정 섹션 */}
      <div className="space-y-6">
        {filteredSections.map((section) => (
          <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h3 className="px-5 py-4 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
              {section.title}
            </h3>
            <ul className="divide-y divide-gray-100">
              {section.items.map((item) => (
                <li key={item.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-[#22282E]">{item.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <div className="shrink-0">
                    {item.type === 'sla' ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={slaValue}
                          onChange={(e) => handleSlaChange(e.target.value)}
                          disabled={slaLoading}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
                        >
                          {SLA_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                        {slaDirty && (
                          <button
                            onClick={handleSaveSLA}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
                          >
                            저장
                          </button>
                        )}
                      </div>
                    ) : item.href ? (
                      <Link
                        to={item.href}
                        className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold hover:bg-emerald-200"
                      >
                        {item.action}
                      </Link>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                        item.status === '연결됨' || item.status === 'ON' ? 'bg-emerald-100 text-emerald-700' :
                        item.status === '설정중' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.action}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 하단 버튼 */}
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link
          to="/admin/dashboard"
          className="group inline-flex items-center gap-2.5 px-5 py-3 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/80 text-sm font-bold text-emerald-700 shadow-sm hover:shadow-md hover:border-emerald-300 hover:from-emerald-50/90 hover:to-emerald-100/60 transition-all duration-200"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200 group-hover:scale-105 transition-all duration-200">
            <Home size={18} strokeWidth={2.5} />
          </span>
          <span>대시보드로 돌아가기</span>
        </Link>
      </div>
    </div>
  )
}
