import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Bell, BellOff, ToggleLeft, ToggleRight,
  Loader2, RefreshCw, Save, AlertTriangle, Zap,
  Server, Users, ShieldAlert, MessageSquareWarning, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'

// ── 이벤트 카테고리 ──────────────────────────────────────────────
const EVENT_GROUPS = [
  {
    id: 'system',
    label: '시스템 오류',
    icon: Server,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-100',
    events: [
      { id: 'server_error_5xx',   label: '서버 오류 (5xx)',          desc: 'API 서버에서 5xx 오류가 발생할 때', defaultOn: true },
      { id: 'db_connection_fail', label: 'DB 연결 실패',              desc: 'Supabase 데이터베이스 연결이 끊길 때', defaultOn: true },
      { id: 'storage_full',       label: '스토리지 용량 90% 초과',    desc: 'Supabase Storage 사용량이 90%를 넘을 때', defaultOn: true },
    ],
  },
  {
    id: 'traffic',
    label: '트래픽 이상',
    icon: Zap,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100',
    events: [
      { id: 'traffic_spike',      label: '대량 트래픽 급증',          desc: '분당 요청 수가 기준치의 3배를 초과할 때', defaultOn: true },
      { id: 'rate_limit_breach',  label: 'API Rate Limit 초과',       desc: 'Supabase API 제한에 도달할 때', defaultOn: true },
      { id: 'concurrent_users',   label: '동시 접속자 급증',          desc: '동시 접속자가 1,000명을 초과할 때', defaultOn: false },
    ],
  },
  {
    id: 'security',
    label: '보안 이상',
    icon: ShieldAlert,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100',
    events: [
      { id: 'login_fail_burst',   label: '로그인 실패 반복',          desc: '동일 IP에서 5분 내 10회 이상 실패', defaultOn: true },
      { id: 'suspicious_query',   label: '비정상 쿼리 감지',          desc: 'SQL 인젝션 패턴이 감지될 때', defaultOn: true },
      { id: 'new_admin_login',    label: '신규 디바이스 어드민 로그인', desc: '새 기기에서 관리자 계정 로그인 시', defaultOn: false },
    ],
  },
  {
    id: 'service',
    label: '서비스 이벤트',
    icon: MessageSquareWarning,
    color: 'text-sky-500',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-100',
    events: [
      { id: 'sla_exceeded',       label: 'SLA 초과 문의 발생',        desc: '설정된 SLA 기준을 초과하는 미처리 문의 발생', defaultOn: true },
      { id: 'appeal_submitted',   label: '이의 신청 접수',            desc: '유저가 이의 신청을 제출할 때', defaultOn: false },
      { id: 'abuse_detected',     label: '어뷰징/매크로 감지',        desc: '비정상 투표 패턴이 감지될 때', defaultOn: true },
    ],
  },
]

// ── 알림 수신 채널 ───────────────────────────────────────────────
const CHANNELS = [
  { id: 'inapp',  label: '어드민 알림 패널', desc: '어드민 페이지 상단 알림 아이콘에 표시' },
  { id: 'email',  label: '이메일',           desc: '등록된 운영자 이메일로 발송' },
  { id: 'messenger', label: '메신저 연동',   desc: '외부 메신저 연동(Slack·Notion 등)으로 전달' },
]

const SETTING_KEY = 'system_push_settings'

function buildDefaultSettings() {
  const events = {}
  EVENT_GROUPS.forEach((g) => g.events.forEach((e) => { events[e.id] = e.defaultOn }))
  return {
    enabled: true,
    channels: { inapp: true, email: true, messenger: false },
    events,
  }
}

export function AdminSystemPushPage() {
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState(buildDefaultSettings())
  const [dirty, setDirty] = useState(false)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle()
      if (data?.value) {
        setSettings({ ...buildDefaultSettings(), ...data.value })
      }
    } catch {
      showToast('설정을 불러오는 중 오류가 발생했어요.', 'error')
    } finally {
      setLoading(false)
      setDirty(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const update = (patch) => {
    setSettings((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const toggleEnabled = () => update({ enabled: !settings.enabled })

  const toggleChannel = (id) =>
    update({ channels: { ...settings.channels, [id]: !settings.channels[id] } })

  const toggleEvent = (id) =>
    update({ events: { ...settings.events, [id]: !settings.events?.[id] } })

  const toggleGroupAll = (group) => {
    const ids = group.events.map((e) => e.id)
    const allOn = ids.every((id) => settings.events?.[id])
    const patch = {}
    ids.forEach((id) => { patch[id] = !allOn })
    update({ events: { ...settings.events, ...patch } })
  }

  const handleSaveConfirm = async () => {
    setSaveConfirmOpen(false)
    setSaving(true)
    try {
      await supabase
        .from('admin_settings')
        .upsert({ key: SETTING_KEY, value: settings }, { onConflict: 'key' })
      showToast('시스템 푸시 설정이 저장됐어요.', 'success')
      setDirty(false)
    } catch {
      showToast('저장 중 오류가 발생했어요.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const activeEventCount = Object.values(settings.events || {}).filter(Boolean).length
  const totalEventCount = EVENT_GROUPS.reduce((s, g) => s + g.events.length, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/admin/settings" className="hover:text-[#22282E] flex items-center gap-1">
            <ArrowLeft size={15} />
            설정 센터
          </Link>
          <span>/</span>
          <span className="text-[#22282E] font-semibold">시스템 푸시 설정</span>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              settings.enabled ? 'bg-sky-100' : 'bg-gray-100'
            }`}>
              {settings.enabled
                ? <Bell size={20} className="text-sky-600" />
                : <BellOff size={20} className="text-gray-400" />
              }
            </div>
            <div>
              <h1 className="text-lg font-black text-[#22282E]">시스템 푸시 설정</h1>
              <p className="text-xs text-gray-500">서버 오류, 트래픽 급증, 보안 이상 발생 시 관리자에게 알림을 전송합니다.</p>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                DB·스토리지·트래픽 급증 등은 호스팅(Supabase) 관측과 함께 쓰는 것이 좋아요. 앱에서는 SLA 초과(스케줄), 투표 API 오류/이상, Supabase 429, 관리자 UA 변경 등이 연결돼 있어요.
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* 마스터 ON/OFF */}
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#22282E]">시스템 푸시 알림</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {settings.enabled
                    ? `현재 활성화 상태 · ${activeEventCount}/${totalEventCount}개 이벤트 감시 중`
                    : '모든 시스템 푸시 알림이 꺼져 있어요.'}
                </p>
              </div>
              <button onClick={toggleEnabled} className="shrink-0">
                {settings.enabled
                  ? <ToggleRight size={40} className="text-sky-500" />
                  : <ToggleLeft size={40} className="text-gray-300" />
                }
              </button>
            </div>

            {/* 알림 수신 채널 */}
            <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden transition-opacity ${!settings.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-sm font-bold text-[#22282E]">알림 수신 채널</p>
                <p className="text-xs text-gray-500">알림을 전달받을 채널을 선택하세요.</p>
              </div>
              <div className="divide-y divide-gray-50">
                {CHANNELS.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-bold text-[#22282E]">{ch.label}</p>
                      <p className="text-xs text-gray-500">{ch.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleChannel(ch.id)}
                      className="shrink-0 ml-4"
                    >
                      {settings.channels?.[ch.id]
                        ? <ToggleRight size={32} className="text-sky-500" />
                        : <ToggleLeft size={32} className="text-gray-300" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 이벤트 그룹 */}
            <div className={`space-y-3 transition-opacity ${!settings.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-sm font-bold text-gray-600 px-1">감시할 이벤트 선택</p>
              {EVENT_GROUPS.map((group) => {
                const GroupIcon = group.icon
                const ids = group.events.map((e) => e.id)
                const allOn = ids.every((id) => settings.events?.[id])
                const someOn = ids.some((id) => settings.events?.[id])
                const isCollapsed = collapsed[group.id]

                return (
                  <div key={group.id} className={`bg-white rounded-xl border overflow-hidden ${someOn ? group.borderColor : 'border-gray-100'}`}>
                    {/* 그룹 헤더 */}
                    <div
                      className={`flex items-center justify-between px-5 py-3.5 cursor-pointer select-none ${someOn ? group.bgColor : 'bg-gray-50/60'}`}
                      onClick={() => setCollapsed((p) => ({ ...p, [group.id]: !p[group.id] }))}
                    >
                      <div className="flex items-center gap-2.5">
                        <GroupIcon size={16} className={someOn ? group.color : 'text-gray-400'} />
                        <p className="text-sm font-bold text-[#22282E]">{group.label}</p>
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                          allOn ? 'bg-emerald-100 text-emerald-700' :
                          someOn ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {ids.filter((id) => settings.events?.[id]).length}/{ids.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleGroupAll(group) }}
                          className="text-xs font-bold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-white/80"
                        >
                          {allOn ? '전체 해제' : '전체 선택'}
                        </button>
                        {isCollapsed ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronUp size={15} className="text-gray-400" />}
                      </div>
                    </div>

                    {/* 이벤트 목록 */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-50">
                        {group.events.map((ev) => (
                          <div key={ev.id} className="flex items-center justify-between px-5 py-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                id={`ev-${ev.id}`}
                                checked={settings.events?.[ev.id] ?? ev.defaultOn}
                                onChange={() => toggleEvent(ev.id)}
                                className="mt-0.5 w-4 h-4 accent-sky-500 cursor-pointer shrink-0"
                              />
                              <div>
                                <p className="text-sm font-bold text-[#22282E]">{ev.label}</p>
                                <p className="text-xs text-gray-500">{ev.desc}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 저장 버튼 */}
            <div className="flex justify-end pt-2 pb-8">
              <button
                onClick={() => dirty && setSaveConfirmOpen(true)}
                disabled={!dirty || saving}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  dirty && !saving
                    ? 'bg-[#22282E] text-white hover:bg-[#363d46]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                변경사항 저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 저장 확인 모달 */}
      <Modal isOpen={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title="시스템 푸시 설정 저장">
        <div className="space-y-4">
          <div className="bg-sky-50 border border-sky-100 rounded-lg px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-sky-500 shrink-0 mt-0.5" />
            <div className="text-sm text-sky-800">
              <p className="font-bold mb-1">변경 내용 요약</p>
              <ul className="space-y-0.5 text-xs text-sky-700">
                <li>• 푸시 알림: <strong>{settings.enabled ? 'ON' : 'OFF'}</strong></li>
                <li>• 감시 이벤트: <strong>{activeEventCount}개</strong> 활성화</li>
                <li>• 수신 채널: <strong>
                  {Object.entries(settings.channels || {})
                    .filter(([, v]) => v)
                    .map(([k]) => CHANNELS.find((c) => c.id === k)?.label)
                    .join(', ') || '없음'}
                </strong></li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-gray-600">위 내용으로 저장하시겠습니까?</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setSaveConfirmOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">취소</button>
            <button onClick={handleSaveConfirm} className="px-4 py-2 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46]">저장하기</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
