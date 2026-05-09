import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Link2, Link2Off, CheckCircle2, XCircle,
  Send, Loader2, Eye, EyeOff, Pencil, RefreshCw,
} from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'

// ── 메신저 플랫폼 정의 ────────────────────────────────────────────
const PLATFORMS = [
  {
    id: 'slack',
    name: 'Slack',
    desc: '채널에 웹훅 메시지로 알림을 전송합니다.',
    color: 'bg-[#4A154B]',
    lightColor: 'bg-[#4A154B]/10',
    textColor: 'text-[#4A154B]',
    borderColor: 'border-[#4A154B]/20',
    logo: (
      <svg viewBox="0 0 54 54" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.7 33.1a4.4 4.4 0 1 1-4.4-4.4H19.7v4.4z" fill="#E01E5A"/>
        <path d="M21.9 33.1a4.4 4.4 0 0 1 8.8 0v11a4.4 4.4 0 0 1-8.8 0v-11z" fill="#E01E5A"/>
        <path d="M26.3 19.7a4.4 4.4 0 1 1-4.4-4.4V19.7h4.4z" fill="#36C5F0"/>
        <path d="M26.3 21.9a4.4 4.4 0 0 1 0 8.8H15.3a4.4 4.4 0 0 1 0-8.8h11z" fill="#36C5F0"/>
        <path d="M39.7 26.3a4.4 4.4 0 1 1 4.4 4.4H39.7v-4.4z" fill="#2EB67D"/>
        <path d="M37.5 26.3a4.4 4.4 0 0 1-8.8 0v-11a4.4 4.4 0 0 1 8.8 0v11z" fill="#2EB67D"/>
        <path d="M33.1 39.7a4.4 4.4 0 1 1 4.4 4.4V39.7h-4.4z" fill="#ECB22E"/>
        <path d="M33.1 37.5a4.4 4.4 0 0 1 0-8.8h11a4.4 4.4 0 0 1 0 8.8h-11z" fill="#ECB22E"/>
      </svg>
    ),
    placeholder: 'https://hooks.slack.com/services/T.../B.../...',
    guide: 'Slack 앱 설정 → Incoming Webhooks → Webhook URL을 복사하세요.',
    testBody: (url) => ({ text: '✅ [VICTORYSPACE] Slack 연동 테스트 메시지입니다.' }),
  },
  {
    id: 'notion',
    name: 'Notion',
    desc: 'Notion 데이터베이스에 알림 내용을 자동으로 기록합니다.',
    color: 'bg-[#000000]',
    lightColor: 'bg-gray-100',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-200',
    logo: (
      <svg viewBox="0 0 54 54" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <rect width="54" height="54" rx="10" fill="#ffffff" stroke="#e5e7eb" strokeWidth="2"/>
        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="#000000" fontSize="22" fontWeight="900">N</text>
      </svg>
    ),
    placeholder: 'https://api.notion.com/v1/pages',
    guide: 'Notion → 설정 → 연동 → 새 API 통합 생성 후, 데이터베이스에 연동을 공유하세요.',
    testBody: (url) => ({ parent: { database_id: '' }, properties: { Name: { title: [{ text: { content: '✅ [VICTORYSPACE] Notion 연동 테스트' } }] } } }),
  },
  {
    id: 'discord',
    name: 'Discord',
    desc: '서버 채널에 웹훅으로 알림을 전송합니다.',
    color: 'bg-[#5865F2]',
    lightColor: 'bg-[#5865F2]/10',
    textColor: 'text-[#5865F2]',
    borderColor: 'border-[#5865F2]/20',
    logo: (
      <svg viewBox="0 0 54 54" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <rect width="54" height="54" rx="10" fill="#5865F2"/>
        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">D</text>
      </svg>
    ),
    placeholder: 'https://discord.com/api/webhooks/...',
    guide: 'Discord 채널 설정 → 연동 → 웹후크 → URL 복사를 클릭하세요.',
    testBody: (url) => ({ content: '✅ [VICTORYSPACE] Discord 연동 테스트 메시지입니다.' }),
  },
  {
    id: 'googlechat',
    name: 'Google Chat',
    desc: 'Google Workspace 채널에 웹훅 알림을 전송합니다.',
    color: 'bg-[#00897B]',
    lightColor: 'bg-[#00897B]/10',
    textColor: 'text-[#00897B]',
    borderColor: 'border-[#00897B]/20',
    logo: (
      <svg viewBox="0 0 54 54" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
        <rect width="54" height="54" rx="10" fill="#00897B"/>
        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">G</text>
      </svg>
    ),
    placeholder: 'https://chat.googleapis.com/v1/spaces/.../messages?key=...',
    guide: 'Google Chat 채널 → 웹훅 → 웹훅 URL 복사를 클릭하세요.',
    testBody: (url) => ({ text: '✅ [VICTORYSPACE] Google Chat 연동 테스트 메시지입니다.' }),
  },
]

// 알림 트리거 항목 정의
const NOTIFY_EVENTS = [
  { id: 'sla_exceeded',    label: 'SLA 초과 미처리 문의', desc: '기준 시간 초과 시 즉시 알림' },
  { id: 'new_appeal',      label: '신규 이의 신청 접수', desc: '유저가 이의를 신청하면 알림' },
  { id: 'matchup_report',  label: '매치업 신고 접수',    desc: '매치업 신고 발생 시 알림' },
]

function maskUrl(url) {
  if (!url || url.length < 20) return url
  return url.slice(0, 30) + '•••' + url.slice(-8)
}

export function AdminMessengerPage() {
  const { showToast } = useUIStore()
  const [integrations, setIntegrations] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [testing, setTesting] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editUrl, setEditUrl] = useState('')
  const [editEvents, setEditEvents] = useState({})
  const [showUrl, setShowUrl] = useState({})
  const [disconnectTarget, setDisconnectTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .like('key', '%_integration')
      const map = {}
      ;(data || []).forEach(({ key, value }) => {
        const id = key.replace('_integration', '')
        map[id] = value
      })
      setIntegrations(map)
    } catch {
      showToast('설정을 불러오는 중 오류가 발생했어요.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const getInteg = (id) => integrations[id] || { enabled: false, webhook_url: '', events: {} }

  // 연동 설정 모달 열기
  const openEdit = (platform) => {
    const integ = getInteg(platform.id)
    setEditUrl(integ.webhook_url || '')
    const evts = {}
    NOTIFY_EVENTS.forEach((e) => { evts[e.id] = integ.events?.[e.id] ?? true })
    setEditEvents(evts)
    setEditTarget(platform)
  }

  // 저장
  const handleSave = async () => {
    if (!editUrl.trim()) { showToast('웹훅 URL을 입력해 주세요.', 'error'); return }
    if (!editUrl.startsWith('https://')) { showToast('유효한 HTTPS URL을 입력해 주세요.', 'error'); return }
    setSaving(editTarget.id)
    try {
      const key = `${editTarget.id}_integration`
      const value = { enabled: true, webhook_url: editUrl.trim(), events: editEvents }
      await supabase.from('admin_settings').upsert({ key, value }, { onConflict: 'key' })
      setIntegrations((prev) => ({ ...prev, [editTarget.id]: value }))
      showToast(`${editTarget.name} 연동이 저장됐어요.`, 'success')
      setEditTarget(null)
    } catch {
      showToast('저장 중 오류가 발생했어요.', 'error')
    } finally {
      setSaving(null)
    }
  }

  // 연동 해제
  const handleDisconnect = async () => {
    const id = disconnectTarget.id
    setSaving(id)
    try {
      const key = `${id}_integration`
      await supabase
        .from('admin_settings')
        .upsert({ key, value: { enabled: false, webhook_url: '', events: {} } }, { onConflict: 'key' })
      setIntegrations((prev) => ({ ...prev, [id]: { enabled: false, webhook_url: '', events: {} } }))
      showToast(`${disconnectTarget.name} 연동이 해제됐어요.`, 'success')
    } catch {
      showToast('해제 중 오류가 발생했어요.', 'error')
    } finally {
      setSaving(null)
      setDisconnectTarget(null)
    }
  }

  // 테스트 발송
  const handleTest = async (platform) => {
    const integ = getInteg(platform.id)
    if (!integ.webhook_url) return
    setTesting(platform.id)
    try {
      await fetch(integ.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(platform.testBody(integ.webhook_url)),
        mode: 'no-cors',
      })
      showToast(`${platform.name}으로 테스트 메시지를 발송했어요.`, 'success')
    } catch {
      showToast('발송 요청이 전달됐어요. 채널을 확인해 주세요.', 'success')
    } finally {
      setTesting(null)
    }
  }

  const connectedCount = PLATFORMS.filter((p) => getInteg(p.id).enabled).length

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
          <span className="text-[#22282E] font-semibold">외부 메신저 연동</span>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Link2 size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#22282E]">외부 메신저 연동</h1>
              <p className="text-xs text-gray-500">Slack, Teams 등 업무용 채널에 어드민 알림을 전송합니다.</p>
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

        {/* 현황 배너 */}
        <div className={`rounded-xl px-5 py-4 mb-6 flex items-center gap-3 border ${
          connectedCount > 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          {connectedCount > 0
            ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            : <XCircle size={20} className="text-gray-400 shrink-0" />
          }
          <div>
            <p className={`text-sm font-bold ${connectedCount > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
              {connectedCount > 0
                ? `${connectedCount}개 메신저가 연결됐어요.`
                : '연결된 메신저가 없어요.'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              SLA 초과, 신규 문의, 이의 신청 등의 알림이 연결된 채널로 전송됩니다.
            </p>
          </div>
        </div>

        {/* 알림 이벤트 안내 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <p className="text-xs font-bold text-gray-500 mb-3">발송되는 알림 이벤트</p>
          <div className="grid grid-cols-2 gap-2">
            {NOTIFY_EVENTS.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <div>
                  <p className="font-bold text-gray-700">{ev.label}</p>
                  <p className="text-gray-400">{ev.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 플랫폼 카드 목록 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {PLATFORMS.map((platform) => {
              const integ = getInteg(platform.id)
              const isConnected = integ.enabled && !!integ.webhook_url
              const isBusy = saving === platform.id || testing === platform.id

              return (
                <div
                  key={platform.id}
                  className={`bg-white rounded-xl border ${isConnected ? platform.borderColor : 'border-gray-100'} overflow-hidden`}
                >
                  {/* 카드 헤더 */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${platform.lightColor} flex items-center justify-center`}>
                        {platform.logo}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-[#22282E]">{platform.name}</p>
                          {isConnected && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              연결됨
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{platform.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => handleTest(platform)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 disabled:opacity-50"
                          >
                            {testing === platform.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Send size={12} />
                            }
                            테스트
                          </button>
                          <button
                            onClick={() => openEdit(platform)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDisconnectTarget(platform)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Link2Off size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openEdit(platform)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#22282E] text-white text-xs font-bold hover:bg-[#363d46] disabled:opacity-50"
                        >
                          <Link2 size={13} />
                          연동하기
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 연결된 경우 웹훅 URL 표시 */}
                  {isConnected && (
                    <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/60">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-gray-400 font-medium shrink-0">웹훅 URL</p>
                        <p className="text-[11px] text-gray-600 font-mono truncate flex-1">
                          {showUrl[platform.id] ? integ.webhook_url : maskUrl(integ.webhook_url)}
                        </p>
                        <button
                          onClick={() => setShowUrl((p) => ({ ...p, [platform.id]: !p[platform.id] }))}
                          className="text-gray-400 hover:text-gray-600 shrink-0"
                        >
                          {showUrl[platform.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      {integ.events && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {NOTIFY_EVENTS.filter((ev) => integ.events?.[ev.id]).map((ev) => (
                            <span key={ev.id} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold border border-indigo-100">
                              {ev.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 연동 설정 / 수정 모달 */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `${editTarget.name} 연동 설정` : ''}
      >
        {editTarget && (
          <div className="space-y-4">
            {/* 가이드 */}
            <div className={`rounded-lg px-4 py-3 ${editTarget.lightColor} border ${editTarget.borderColor}`}>
              <p className="text-xs font-bold text-gray-700 mb-0.5">웹훅 URL 발급 방법</p>
              <p className="text-xs text-gray-600">{editTarget.guide}</p>
            </div>

            {/* URL 입력 */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                웹훅 URL <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder={editTarget.placeholder}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                autoFocus
              />
            </div>

            {/* 알림 이벤트 선택 */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2">
                수신할 알림 이벤트
              </label>
              <div className="space-y-2">
                {NOTIFY_EVENTS.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`event-${ev.id}`}
                      checked={editEvents[ev.id] ?? true}
                      onChange={(e) =>
                        setEditEvents((prev) => ({ ...prev, [ev.id]: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-700">{ev.label}</p>
                      <p className="text-xs text-gray-400">{ev.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving === editTarget?.id}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46] disabled:opacity-50"
              >
                {saving === editTarget?.id && <Loader2 size={14} className="animate-spin" />}
                저장하기
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 연동 해제 확인 모달 */}
      <Modal
        isOpen={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        title="연동 해제"
      >
        {disconnectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong className="text-[#22282E]">{disconnectTarget.name}</strong> 연동을 해제하시겠습니까?<br />
              해제 시 해당 채널로 알림 전송이 중단됩니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDisconnectTarget(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDisconnect}
                disabled={!!saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-400 disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                연동 해제
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
