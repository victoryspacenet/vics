import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown, ImagePlus, List, Loader2, Pencil, Rocket } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { savePopupNotice, getImmediateStartAt, resolveImmediateEndAt } from '../lib/popupNoticeStorage'
import { getNoticeOptionsForPopup } from '../lib/noticeStorage'
import { compressImageFileToDataUrl } from '../lib/imageCompression'
import { MATCHUP_IMAGE_INPUT_ACCEPT, validateSelectableRasterImageUpload } from '../lib/uploadMediaValidation'
import { TIERS } from '../lib/tiers'
import { Modal } from '../components/ui/Modal'

const TARGET_OPTIONS = [
  { id: 'all', label: '전체 유저' },
  { id: 'new_user', label: '신규 유저(가입 7일 이내)' },
  { id: 'tier', label: '특정 티어' },
]

const LINK_OPTIONS = [
  { id: 'notice', label: '상세 공지로 이동' },
  { id: 'matchup', label: '특정 매치업으로 이동' },
  { id: 'external', label: '외부 링크' },
]

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#22282E] focus:outline-none focus:ring-2 focus:ring-[#22282E]/20 focus:border-[#22282E]'

/** datetime-local 값: YYYY-MM-DDTHH:mm (로컬) */
function toDateTimeLocalValue(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function padIsoSeconds(localVal) {
  if (!localVal || typeof localVal !== 'string') return ''
  return localVal.length === 16 ? `${localVal}:00` : localVal
}

function formatPopupTargetSummary(target, targetTierId, targetTierExact) {
  if (target === 'all') return '전체 유저 (신규/기존 포함)'
  if (target === 'new_user') return '신규 유저(가입 7일 이내)'
  if (target === 'tier') {
    const t = TIERS.find((x) => x.id === targetTierId) || TIERS[0]
    const base = `${t.emoji} ${t.name}`
    return targetTierExact ? `${base} (해당 티어만)` : `${base} 이상 열람`
  }
  return target
}

function formatFrequencyLabel(freq) {
  if (freq === 'hide_for_day') return '하루동안 보지않기 (닫은 뒤 당일 재노출 없음)'
  return '매번 노출 (「오늘 하루 보지 않기」체크 시 당일 숨김)'
}

export function PopupNoticeAdminPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast, incrementPopupRefresh } = useUIStore()
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [targetOpen, setTargetOpen] = useState(false)
  const [tierOpen, setTierOpen] = useState(false)
  const targetRef = useRef(null)
  const tierRef = useRef(null)

  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [immediate, setImmediate] = useState(true)
  const startDefault = new Date(today)
  startDefault.setHours(0, 0, 0, 0)
  const endDefault = new Date(nextWeek)
  endDefault.setHours(23, 59, 0, 0)
  const [startLocal, setStartLocal] = useState(() => toDateTimeLocalValue(startDefault))
  const [endLocal, setEndLocal] = useState(() => toDateTimeLocalValue(endDefault))
  const [target, setTarget] = useState('all')
  const [targetTierId, setTargetTierId] = useState(TIERS[0]?.id || 'player')
  const [targetTierExact, setTargetTierExact] = useState(false)
  const [frequency, setFrequency] = useState('every_time')
  const [imageUrl, setImageUrl] = useState('')
  const [linkType, setLinkType] = useState('notice')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNoticeId, setLinkNoticeId] = useState('')
  const [linkMatchupId, setLinkMatchupId] = useState('')
  const [editId, setEditId] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)

  const [noticeOptions, setNoticeOptions] = useState([])
  useEffect(() => {
    getNoticeOptionsForPopup().then(setNoticeOptions)
  }, [])

  useEffect(() => {
    const edit = location.state?.editPopup
    if (edit) {
      setEditId(edit.id)
      setName(edit.name || '')
      setIsActive(edit.isActive !== false)
      setImmediate(false)
      if (edit.startAt) {
        setStartLocal(toDateTimeLocalValue(new Date(edit.startAt)))
      }
      if (edit.endAt) {
        setEndLocal(toDateTimeLocalValue(new Date(edit.endAt)))
      }
      setTarget(edit.target || 'all')
      setTargetTierId(edit.targetTierId || TIERS[0]?.id || 'player')
      setTargetTierExact(edit.targetTierExact === true)
      setFrequency(edit.frequency || 'every_time')
      setImageUrl(edit.imageUrl || '')
      setLinkType(edit.linkType || 'notice')
      setLinkUrl(edit.linkUrl || '')
      setLinkNoticeId(edit.linkNoticeId || '')
      setLinkMatchupId(edit.linkMatchupId || '')
      window.history.replaceState({}, '', location.pathname)
    }
  }, [location.state])

  useEffect(() => {
    const handler = (e) => {
      if (targetRef.current && !targetRef.current.contains(e.target)) setTargetOpen(false)
      if (tierRef.current && !tierRef.current.contains(e.target)) setTierOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드 가능해요.', 'error')
      return
    }
    const sniff = await validateSelectableRasterImageUpload(file)
    if (!sniff.ok) {
      showToast(sniff.message, 'error')
      return
    }
    setImageBusy(true)
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxEdge: 900,
        quality: 0.78,
        maxBytes: 600 * 1024,
      })
      setImageUrl(dataUrl)
    } catch {
      showToast('이미지를 불러오지 못했어요.', 'error')
    } finally {
      setImageBusy(false)
    }
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      const startAt = padIsoSeconds(startLocal)
      const endAt = padIsoSeconds(endLocal)
      await savePopupNotice({
        id: editId || undefined,
        name: name || '팝업 공지 (임시)',
        isActive: false,
        startAt,
        endAt,
        target,
        targetTierId,
        targetTierExact,
        frequency,
        imageUrl,
        linkType,
        linkUrl,
        linkNoticeId,
        linkMatchupId,
      })
      incrementPopupRefresh()
      showToast('임시 저장됐어요.', 'success')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveClick = () => {
    if (!name.trim()) {
      showToast('팝업 명칭을 입력해 주세요.', 'error')
      return
    }
    if (!imageUrl) {
      showToast('팝업 이미지를 등록해 주세요.', 'error')
      return
    }
    if (!immediate) {
      const startAt = padIsoSeconds(startLocal)
      const endAt = padIsoSeconds(endLocal)
      if (new Date(endAt) <= new Date(startAt)) {
        showToast('종료 일시는 시작 일시보다 이후여야 해요.', 'error')
        return
      }
    }
    if (linkType === 'external' && !linkUrl.trim()) {
      showToast('연결 URL을 입력해 주세요.', 'error')
      return
    }
    if (linkType === 'matchup' && !linkMatchupId) {
      showToast('연결할 매치업 ID를 입력해 주세요.', 'error')
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirmDeploy = async () => {
    setSaving(true)
    try {
      const startAt = padIsoSeconds(startLocal)
      const endAt = padIsoSeconds(endLocal)
      await savePopupNotice({
        id: editId || undefined,
        name: name.trim(),
        isActive,
        immediate,
        startAt,
        endAt,
        target,
        targetTierId,
        targetTierExact,
        frequency,
        imageUrl,
        linkType,
        linkUrl: linkType === 'external' ? linkUrl.trim() : '',
        linkNoticeId: linkType === 'notice' ? linkNoticeId : '',
        linkMatchupId: linkType === 'matchup' ? linkMatchupId : '',
      })
      incrementPopupRefresh()
      setConfirmOpen(false)
      const finalStartAt = immediate ? getImmediateStartAt() : startAt
      let finalEndAt = endAt
      if (immediate) {
        finalEndAt = resolveImmediateEndAt(finalStartAt, endAt)
      }
      navigate('/admin/notice/popup/complete', {
        state: {
          name: name.trim(),
          startAt: finalStartAt,
          endAt: finalEndAt,
          targetLabel: formatPopupTargetSummary(target, targetTierId, targetTierExact),
        },
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedTier = TIERS.find((t) => t.id === targetTierId) || TIERS[0]

  return (
    <div className="min-h-screen bg-gray-50 w-full min-w-0">
      <div className="mx-auto w-full max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">[ 운영 도구 ] &gt; 팝업 공지 등록</p>
          <Link
            to="/admin/notice/popup/list"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <List size={16} />
            팝업 목록
          </Link>
        </div>

        <div className="space-y-6 px-4 py-6">
          <h1 className="text-lg font-black text-[#22282E]">팝업 공지 등록</h1>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-800">팝업 기본 정보</h2>
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">팝업 명칭</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="운영 관리용 제목"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">활성 상태</label>
              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="active"
                    checked={isActive}
                    onChange={() => setIsActive(true)}
                    className="h-4 w-4 border-gray-300 text-[#22282E] focus:ring-[#22282E]"
                  />
                  <span className="text-sm text-gray-800">활성화</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="active"
                    checked={!isActive}
                    onChange={() => setIsActive(false)}
                    className="h-4 w-4 border-gray-300 text-[#22282E] focus:ring-[#22282E]"
                  />
                  <span className="text-sm text-gray-800">비활성화</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-800">노출 기간 및 타겟</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">시작 일시</label>
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  disabled={immediate}
                  className={`${inputClass} max-w-full sm:max-w-md`}
                />
                <p className="mt-1 text-[11px] font-medium text-gray-400">
                  {immediate
                    ? '즉시 노출 시 시작 시각은 등록 시각 기준으로 자동 설정돼요.'
                    : '날짜와 시각을 한 번에 선택해요.'}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">종료 일시</label>
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className={`${inputClass} max-w-full sm:max-w-md`}
                />
                <p className="mt-1 text-[11px] font-medium text-gray-400">
                  즉시 노출을 켜도 종료만 여기서 지정할 수 있어요. 종료가 시작보다 앞이면 자동으로 1개월 후까지로 잡혀요.
                </p>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={immediate}
                onChange={(e) => setImmediate(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#22282E] focus:ring-[#22282E]"
              />
              <span className="text-sm text-gray-800">
                즉시 노출 <span className="text-gray-500">(시작은 자동, 종료는 아래 「종료 일시」로 지정)</span>
              </span>
            </label>
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">노출 대상</label>
              <div ref={targetRef} className="relative">
                <button
                  type="button"
                  onClick={() => setTargetOpen((o) => !o)}
                  className={`${inputClass} flex w-full items-center justify-between text-left`}
                >
                  {TARGET_OPTIONS.find((t) => t.id === target)?.label || '선택'}
                  <ChevronDown size={18} className={`shrink-0 text-gray-400 ${targetOpen ? 'rotate-180' : ''}`} />
                </button>
                {targetOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {TARGET_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTarget(t.id)
                          setTargetOpen(false)
                          setTierOpen(false)
                        }}
                        className={`w-full px-3 py-2 text-left text-sm ${
                          target === t.id ? 'bg-[#22282E] text-white' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {target === 'tier' && (
              <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">대상 티어</label>
                  <div ref={tierRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setTierOpen((o) => !o)}
                      className={`${inputClass} flex w-full items-center justify-between text-left`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-lg leading-none">{selectedTier.emoji}</span>
                        <span className="truncate font-semibold">{selectedTier.name}</span>
                      </span>
                      <ChevronDown size={18} className={`shrink-0 text-gray-400 ${tierOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {tierOpen && (
                      <ul
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      >
                        {TIERS.map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetTierId(t.id)
                                setTierOpen(false)
                              }}
                              className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm ${
                                targetTierId === t.id ? 'bg-[#22282E] text-white' : 'text-gray-800 hover:bg-gray-50'
                              }`}
                            >
                              <span className="text-lg leading-none">{t.emoji}</span>
                              <span className="min-w-0 flex-1">
                                <span className="font-bold">{t.name}</span>
                                <span
                                  className={`mt-0.5 block text-[11px] font-medium ${
                                    targetTierId === t.id ? 'text-white/80' : 'text-gray-500'
                                  }`}
                                >
                                  {t.benefit}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-gray-400">
                    Player · Star · Master · Vip · Goat 중 하나를 선택하세요.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-600">열람 범위</p>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <input
                      type="radio"
                      name="popupTierExposure"
                      checked={!targetTierExact}
                      onChange={() => setTargetTierExact(false)}
                      className="mt-1 h-4 w-4 border-gray-300 text-[#22282E] focus:ring-[#22282E]"
                    />
                    <span className="text-sm text-gray-800">
                      대상 티어 이상
                      <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                        선택한 티어와 그보다 높은 등급에게 노출
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <input
                      type="radio"
                      name="popupTierExposure"
                      checked={targetTierExact}
                      onChange={() => setTargetTierExact(true)}
                      className="mt-1 h-4 w-4 border-gray-300 text-[#22282E] focus:ring-[#22282E]"
                    />
                    <span className="text-sm text-gray-800">
                      해당 티어만
                      <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                        선택한 티어와 정확히 일치할 때만 노출
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">노출 빈도</label>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-1 py-1 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="freq"
                    checked={frequency === 'every_time'}
                    onChange={() => setFrequency('every_time')}
                    className="mt-0.5 h-4 w-4 border-gray-300 text-[#22282E] focus:ring-[#22282E]"
                  />
                  <span className="text-sm text-gray-800">
                    매번 노출
                    <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                      닫아도 다음 진입 시 다시 노출. 「오늘 하루 보지 않기」를 체크한 날만 당일 숨김.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-1 py-1 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="freq"
                    checked={frequency === 'hide_for_day'}
                    onChange={() => setFrequency('hide_for_day')}
                    className="mt-0.5 h-4 w-4 border-gray-300 text-[#22282E] focus:ring-[#22282E]"
                  />
                  <span className="text-sm text-gray-800">
                    하루동안 보지않기
                    <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                      닫기·배경 탭·링크 이동 시 그날은 다시 보이지 않음 (자정 이후 재노출 가능).
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-800">콘텐츠 및 링크</h2>
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">팝업 이미지</label>
              <p className="mb-2 text-xs text-gray-500">권장 사이즈: 600×800px</p>
              <div className="flex flex-wrap items-start gap-4">
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 ${imageBusy ? 'pointer-events-none opacity-60' : ''}`}>
                  <ImagePlus size={18} />
                  {imageBusy ? '압축 중…' : '파일 선택'}
                  <input type="file" accept={MATCHUP_IMAGE_INPUT_ACCEPT} onChange={handleImageChange} className="hidden" disabled={imageBusy} />
                </label>
                {imageUrl && (
                  <div className="h-36 w-28 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                    <img src={imageUrl} alt="미리보기" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-700">클릭 시 이동</label>
              <div className="mb-3 space-y-2">
                {LINK_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="linkType"
                      checked={linkType === opt.id}
                      onChange={() => setLinkType(opt.id)}
                      className="h-4 w-4 border-gray-300 text-[#22282E] focus:ring-[#22282E]"
                    />
                    <span className="text-sm text-gray-800">{opt.label}</span>
                  </label>
                ))}
              </div>
              {linkType === 'notice' && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-bold text-gray-500">연결할 공지</label>
                  <select value={linkNoticeId} onChange={(e) => setLinkNoticeId(e.target.value)} className={inputClass}>
                    <option value="">선택</option>
                    {noticeOptions.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {linkType === 'matchup' && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-bold text-gray-500">매치업 ID</label>
                  <input
                    type="text"
                    value={linkMatchupId}
                    onChange={(e) => setLinkMatchupId(e.target.value)}
                    placeholder="매치업 UUID"
                    className={inputClass}
                  />
                </div>
              )}
              {linkType === 'external' && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-bold text-gray-500">연결 URL</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="mx-auto animate-spin" /> : '임시 저장'}
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="mx-auto animate-spin" /> : '팝업 저장'}
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        title=""
        className="max-w-[min(36rem,calc(100vw-2rem))]"
      >
        <div className="-mt-2 flex min-h-0 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto pb-4">
            <h2 className="flex items-center justify-center gap-2 text-center text-lg font-black text-[#22282E]">
              <Rocket size={24} className="text-emerald-500" />
              팝업 등록을 완료하시겠습니까?
            </h2>

            <div>
              <p className="mb-3 text-sm font-bold text-[#22282E]">📱 기기별 미리보기</p>
              <div className="flex justify-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="mb-1.5 text-xs font-medium text-gray-500">(iOS)</span>
                  <div className="aspect-[9/19.5] w-24 overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50 shadow-inner">
                    {imageUrl ? (
                      <img src={imageUrl} alt="iOS 미리보기" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">이미지</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="mb-1.5 text-xs font-medium text-gray-500">(Android)</span>
                  <div className="aspect-[9/16] w-24 overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50 shadow-inner">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Android 미리보기" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">이미지</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-gray-50 p-4">
              <p className="mb-2 text-sm font-bold text-[#22282E]">최종 설정 요약</p>
              <p className="text-sm text-gray-700">
                <strong>공지명:</strong> {name || '-'}
              </p>
              <p className="text-sm text-gray-700">
                <strong>노출 기간:</strong>{' '}
                {immediate ? (
                  <>
                    {(() => {
                      const s = getImmediateStartAt()
                      const e = resolveImmediateEndAt(s, padIsoSeconds(endLocal))
                      return (
                        <>
                          즉시 노출 — 시작 <strong>{s.replace('T', ' ')}</strong>부터, 종료{' '}
                          <strong>{e.replace('T', ' ')}</strong>까지
                          <span className="mt-1 block text-xs font-normal text-gray-500">
                            종료는 「종료 일시」가 시작보다 뒤일 때 그대로 적용되고, 그렇지 않으면 1개월 후 자정 직전까지로
                            설정돼요.
                          </span>
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    {startLocal.replace('T', ' ')} ~ {endLocal.replace('T', ' ')}
                    {(() => {
                      const s = new Date(padIsoSeconds(startLocal))
                      const e = new Date(padIsoSeconds(endLocal))
                      const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24))
                      return Number.isFinite(days) && days > 0 ? ` (${days}일간)` : ''
                    })()}
                  </>
                )}
              </p>
              <p className="text-sm text-gray-700">
                <strong>타겟 유저:</strong> {formatPopupTargetSummary(target, targetTierId, targetTierExact)}
              </p>
              <p className="text-sm text-gray-700">
                <strong>노출 빈도:</strong> {formatFrequencyLabel(frequency)}
              </p>
              <p className="text-sm text-gray-700">
                <strong>노출 위치:</strong> 앱 진입 시 홈 화면 메인
              </p>
            </div>

            <p className="text-center text-sm text-gray-500">위 설정대로 즉시 예약/배포됩니다. 등록하시겠습니까?</p>
          </div>

          <div className="flex shrink-0 gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              <Pencil size={16} />
              다시 수정
            </button>
            <button
              type="button"
              onClick={handleConfirmDeploy}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-black text-white transition-all hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={16} />}
              확인 및 배포하기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
