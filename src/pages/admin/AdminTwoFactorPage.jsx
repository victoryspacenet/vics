import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Smartphone, Mail, KeyRound, ToggleLeft, ToggleRight, Info } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'

const SETTINGS_KEY = '2fa'

async function load2FASettings() {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()
  if (error || !data) return { enabled: false, method: 'totp' }
  return data.value
}

async function save2FASettings(value) {
  const { error } = await supabase
    .from('admin_settings')
    .upsert({ key: SETTINGS_KEY, value }, { onConflict: 'key' })
  if (error) console.error('2FA settings save error:', error)
}

const METHODS = [
  {
    id: 'totp',
    icon: <Smartphone size={20} className="text-emerald-600" />,
    label: 'OTP 앱 인증 (TOTP)',
    desc: 'Google Authenticator, Authy 등 앱을 통한 6자리 코드 인증',
    recommended: true,
  },
  {
    id: 'email',
    icon: <Mail size={20} className="text-blue-500" />,
    label: '이메일 인증',
    desc: '로그인 시 등록된 이메일로 인증 코드 발송',
    recommended: false,
  },
  {
    id: 'backup',
    icon: <KeyRound size={20} className="text-amber-500" />,
    label: '백업 코드',
    desc: '기기 분실 등 긴급 상황 시 사용하는 1회용 코드 (10개)',
    recommended: false,
  },
]

export function AdminTwoFactorPage() {
  const { showToast } = useUIStore()

  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [activeMethod, setActiveMethod] = useState('totp')

  useEffect(() => {
    load2FASettings().then((s) => {
      setEnabled(s.enabled ?? false)
      setActiveMethod(s.method ?? 'totp')
      setLoading(false)
    })
  }, [])
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false)
  const [backupCodes] = useState([
    'A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2', 'M3N4-O5P6',
    'Q7R8-S9T0', 'U1V2-W3X4', 'Y5Z6-A7B8', 'C9D0-E1F2',
    'G3H4-I5J6', 'K7L8-M9N0',
  ])
  const [showBackup, setShowBackup] = useState(false)

  const handleToggleClick = () => setToggleConfirmOpen(true)

  const handleToggleConfirm = async () => {
    setToggleConfirmOpen(false)
    const next = !enabled
    setEnabled(next)
    await save2FASettings({ enabled: next, method: activeMethod })
    showToast(next ? '2단계 인증이 활성화됐어요.' : '2단계 인증이 비활성화됐어요.', next ? 'success' : 'error')
  }

  const handleCopyBackup = () => {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      showToast('백업 코드가 클립보드에 복사됐어요.', 'success')
    })
  }

  if (loading) {
    return (
      <div className="max-w-2xl flex items-center justify-center py-20 text-sm text-gray-400">
        설정을 불러오는 중...
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* 브레드크럼 */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
        <Link to="/admin/settings" className="hover:text-emerald-600">설정 센터</Link>
        <ChevronRight size={14} />
        <span className="text-[#22282E] font-bold">2단계 인증(2FA)</span>
      </nav>

      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <ShieldCheck size={22} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#22282E]">2단계 인증(2FA) 설정</h1>
          <p className="text-sm text-gray-500">어드민 계정 로그인 보안을 강화합니다</p>
        </div>
      </div>

      {/* 활성화 토글 카드 */}
      <div className={`rounded-xl border-2 p-5 mb-5 flex items-center justify-between gap-4 ${
        enabled ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 bg-white'
      }`}>
        <div>
          <p className="font-bold text-[#22282E] flex items-center gap-2">
            2단계 인증
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {enabled ? '활성화됨' : '비활성화됨'}
            </span>
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {enabled
              ? '로그인 시 추가 인증이 요구됩니다.'
              : '현재 아이디·비밀번호만으로 로그인됩니다.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleClick}
          className="shrink-0 text-gray-400 hover:text-emerald-600 transition-colors"
          aria-label="2단계 인증 토글"
        >
          {enabled
            ? <ToggleRight size={44} className="text-emerald-500" />
            : <ToggleLeft size={44} />}
        </button>
      </div>

      {/* 인증 수단 선택 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <h2 className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
          인증 수단 선택
        </h2>
        <ul className="divide-y divide-gray-100">
          {METHODS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => { if (enabled) { setActiveMethod(m.id); save2FASettings({ enabled, method: m.id }) } }}
                disabled={!enabled}
                className={`w-full px-5 py-4 flex items-center gap-4 text-left transition-colors ${
                  !enabled ? 'opacity-40 cursor-not-allowed' :
                  activeMethod === m.id ? 'bg-emerald-50/60' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  activeMethod === m.id && enabled ? 'bg-emerald-100' : 'bg-gray-100'
                }`}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#22282E] flex items-center gap-2">
                    {m.label}
                    {m.recommended && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">권장</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{m.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  activeMethod === m.id && enabled
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-gray-300'
                }`}>
                  {activeMethod === m.id && enabled && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* 백업 코드 */}
      <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden mb-5 ${!enabled ? 'opacity-40' : ''}`}>
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#22282E]">백업 코드</h2>
          <button
            type="button"
            onClick={() => { if (enabled) setShowBackup((v) => !v) }}
            disabled={!enabled}
            className="text-xs text-emerald-600 font-bold hover:underline disabled:cursor-not-allowed"
          >
            {showBackup ? '숨기기' : '코드 보기'}
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-500 mb-3 flex items-start gap-1.5">
            <Info size={14} className="mt-0.5 shrink-0 text-amber-500" />
            기기 분실 등 긴급 상황 시 사용하는 1회용 코드입니다. 안전한 곳에 보관하세요.
          </p>
          {showBackup && enabled && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {backupCodes.map((code, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-mono text-center text-[#22282E]">
                    {code}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleCopyBackup}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                전체 복사
              </button>
            </>
          )}
        </div>
      </div>

      {/* 안내 */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
        <p className="font-bold mb-1">⚠️ 주의사항</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>2단계 인증 비활성화 시 보안 수준이 낮아집니다.</li>
          <li>백업 코드는 1회 사용 후 자동 만료됩니다.</li>
          <li>인증 앱을 분실한 경우 백업 코드로 복구하세요.</li>
        </ul>
      </div>

      {/* 활성화/비활성화 확인 모달 */}
      <Modal
        isOpen={toggleConfirmOpen}
        onClose={() => setToggleConfirmOpen(false)}
        title={enabled ? '2단계 인증 비활성화' : '2단계 인증 활성화'}
      >
        <div className="space-y-4">
          {enabled ? (
            <p className="text-sm text-gray-600">
              2단계 인증을 <strong className="text-red-600">비활성화</strong>하면 아이디·비밀번호만으로 로그인됩니다.
              <br />
              <span className="text-red-600 font-medium">계정 보안이 낮아질 수 있습니다. 계속하시겠습니까?</span>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              2단계 인증을 <strong className="text-emerald-600">활성화</strong>하면 로그인 시 추가 인증이 요구됩니다.
              <br />
              계속 진행하시겠습니까?
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setToggleConfirmOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleToggleConfirm}
              className={`px-4 py-2 rounded-xl text-white text-sm font-bold ${
                enabled ? 'bg-red-500 hover:bg-red-400' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {enabled ? '비활성화' : '활성화'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
