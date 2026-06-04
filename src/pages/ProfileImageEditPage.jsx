import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, X, Loader2, Sparkles, ImageIcon, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadMatchupMediaValidated } from '../lib/matchupMediaBucketUpload'
import { safeMediaUrl } from '../lib/sanitize'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { compressImageContain } from '../lib/imageCompression'
import { cameraPhotoToFile } from '../lib/cameraPhotoToFile'
import { SmartphoneCameraCapture } from '../components/mobile/SmartphoneCameraCapture'
import {
  MATCHUP_IMAGE_INPUT_ACCEPT,
  validateSelectableRasterImageUpload,
  validatePipelineJpegOutput,
} from '../lib/uploadMediaValidation'

/** MZ 파스텔 — 프로필 편집·마이페이지와 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/50 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

// ── 배경 효과 프리셋 ────────────────────────────────────────────────
const BG_EFFECTS = [
  {
    id: 'none',
    label: '무지',
    desc: '기본',
    previewCls: 'bg-gray-200',
    ringCls: 'ring-4 ring-gray-200',
    isGradient: false,
  },
  {
    id: 'neon',
    label: '네온',
    desc: '네온 그린',
    previewCls: 'bg-gradient-to-br from-lime-400 to-emerald-400',
    ringCls: 'ring-4 ring-lime-400 shadow-[0_0_24px_rgba(163,230,53,0.6)]',
    isGradient: false,
  },
  {
    id: 'candy',
    label: '캔디',
    desc: '핑크 캔디',
    previewCls: 'bg-gradient-to-br from-pink-400 via-fuchsia-400 to-violet-500',
    wrapCls: 'p-[3px] bg-gradient-to-br from-pink-400 via-fuchsia-400 to-violet-500',
    isGradient: true,
  },
  {
    id: 'dark',
    label: '다크',
    desc: '다크 모드',
    previewCls: 'bg-gradient-to-br from-gray-700 to-gray-900',
    wrapCls: 'p-[3px] bg-gradient-to-br from-gray-800 via-gray-600 to-gray-900',
    isGradient: true,
  },
]

/** DB/스토어 값과 로컬 선택을 동일 규칙으로 맞춰 저장 버튼·동기화가 어긋나지 않게 함 */
function normalizeAvatarRingEffect(raw) {
  if (raw == null || raw === '') return 'none'
  const id = String(raw).trim()
  return BG_EFFECTS.some((e) => e.id === id) ? id : 'none'
}

export function ProfileImageEditPage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile, updateProfile } = useAuthStore()
  const { showToast } = useUIStore()

  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile,    setAvatarFile]    = useState(null)
  const [bgEffect,      setBgEffect]      = useState('none')
  const [sheetOpen,     setSheetOpen]     = useState(false)
  /** 'menu' | 'camera' — 하단 시트에서 앨범 vs 카메라 UI 전환 */
  const [sheetView,     setSheetView]     = useState('menu')
  const [saving,        setSaving]        = useState(false)

  const fileInputRef = useRef(null)
  /** 배경을 직접 탭한 뒤에는 서버 프로필 동기화로 로컬 선택을 덮어쓰지 않음 */
  const userPickedBgRef = useRef(false)

  useEffect(() => {
    if (!user) { navigate('/'); return }
  }, [user])

  useEffect(() => {
    if (!profile || userPickedBgRef.current) return
    setBgEffect(normalizeAvatarRingEffect(profile.avatar_ring_effect))
  }, [profile?.id, profile?.avatar_ring_effect])

  useEffect(() => {
    if (!sheetOpen) setSheetView('menu')
  }, [sheetOpen])

  const openSheet = () => {
    setSheetView('menu')
    setSheetOpen(true)
  }

  const applyAvatarFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있어요', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('이미지는 5MB 이하만 가능해요', 'error')
      return
    }
    const sniff = await validateSelectableRasterImageUpload(file)
    if (!sniff.ok) {
      showToast(sniff.message, 'error')
      return
    }
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarFile(file)
    setSheetOpen(false)
    setSheetView('menu')
  }

  // 이미지 파일 처리
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void applyAvatarFile(file)
  }

  const handleCameraCapture = async (photo) => {
    try {
      const file = await cameraPhotoToFile(photo, 'profile-camera.jpg')
      await applyAvatarFile(file)
    } catch (err) {
      showToast(err?.message ? String(err.message) : '카메라 사진을 불러오지 못했어요', 'error')
    }
  }

  const resetAvatar = () => {
    setAvatarPreview(null)
    setAvatarFile(null)
    setSheetOpen(false)
    setSheetView('menu')
  }

  const serverRing = normalizeAvatarRingEffect(profile?.avatar_ring_effect)
  const localRing = normalizeAvatarRingEffect(bgEffect)
  /** 새 사진만 / 배경 효과만 바꿔도 저장 가능 */
  const hasChanges = Boolean(avatarFile) || localRing !== serverRing

  const handleSave = async () => {
    if (!hasChanges || saving) return
    setSaving(true)
    try {
      let avatarUrl = profile?.avatar_url || null

      if (avatarFile) {
        showToast('이미지 압축 중…', 'info')
        const compressed = await compressImageContain(avatarFile, {
          maxEdge: 512,
          quality: 0.85,
          maxBytes: 380 * 1024,
        })
        const outChk = await validatePipelineJpegOutput(compressed)
        if (!outChk.ok) {
          showToast(outChk.message, 'error')
          setSaving(false)
          return
        }

        const path = `avatars/${user.id}/profile.jpg`

        showToast('이미지 업로드 중…', 'info')
        const { error: uploadErr, publicUrl: uploadedUrl } = await uploadMatchupMediaValidated(supabase, {
          objectPath: path,
          body: compressed,
          fileKind: 'image',
          upsert: true,
          cacheControl: '3600',
          contentType: compressed.type || 'image/jpeg',
        })

        if (uploadErr || !uploadedUrl) {
          showToast(uploadErr?.message || '이미지 업로드에 실패했어요', 'error')
          setSaving(false); return
        }

        avatarUrl = `${uploadedUrl}?t=${Date.now()}`
      }

      const payload = { avatar_ring_effect: localRing }
      if (avatarFile) payload.avatar_url = avatarUrl

      const { error } = await updateProfile(payload)
      if (error) { showToast('저장에 실패했어요', 'error'); return }

      showToast(avatarFile ? '프로필 사진이 업데이트됐어요 ✓' : '배경 효과가 저장됐어요 ✓', 'success')
      navigate('/mypage/edit')
      void fetchProfile(user.id)
    } catch {
      showToast('저장 중 오류가 발생했어요', 'error')
    } finally {
      setSaving(false)
    }
  }

  const effectObj    = BG_EFFECTS.find((e) => e.id === localRing) || BG_EFFECTS[0]
  const currentImage = avatarPreview || profile?.avatar_url

  return (
    <div className={cn('max-w-screen-sm mx-auto min-h-screen', PAGE_BG)}>

      {/* ── 상단 바 ── */}
      <div className={cn('sticky top-0 z-30 flex items-center justify-between h-14 px-4', HEADER_GLASS)}>
        <button
          onClick={() => navigate('/mypage/edit')}
          className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
        >
          <ArrowLeft size={20} className="text-fuchsia-900" />
        </button>
        <h1 className="text-base font-black text-fuchsia-950">프로필 사진 수정</h1>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-4 py-1.5 text-sm font-black rounded-full transition-all ${
            hasChanges && !saving
              ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white hover:brightness-105 active:scale-95 shadow-md shadow-fuchsia-300/35'
              : 'bg-fuchsia-100/60 text-fuchsia-400/80 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '저장'}
        </button>
      </div>

      <div className="px-4 py-6 space-y-4">

        {/* ══ 메인 이미지 편집 영역 ══ */}
        <div className={`${SECTION_CARD} p-8`}>

          {/* 대형 아바타 프리뷰 (중앙) */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {/* 배경 효과 래퍼 */}
              {effectObj.isGradient
                ? <div className={`rounded-full ${effectObj.wrapCls}`}>
                    <div
                      onClick={openSheet}
                      className="relative w-36 h-36 rounded-full overflow-hidden cursor-pointer group bg-white p-0.5"
                    >
                      <AvatarInner currentImage={currentImage} profile={profile} />
                    </div>
                  </div>
                : <div
                    onClick={openSheet}
                    className={`relative w-36 h-36 rounded-full overflow-hidden cursor-pointer group ${effectObj.ringCls}`}
                  >
                    <AvatarInner currentImage={currentImage} profile={profile} />
                  </div>
              }

              {/* 편집 뱃지 */}
              <button
                onClick={openSheet}
                className="absolute bottom-1 right-1 w-10 h-10 bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-fuchsia-300/45 hover:brightness-105 active:scale-95 transition-all"
              >
                <Camera size={18} />
              </button>
            </div>

            {/* 버튼 */}
            <button
              onClick={openSheet}
              className="text-sm font-black text-fuchsia-800 underline underline-offset-2 hover:text-fuchsia-600 transition-colors"
            >
              사진 변경하기
            </button>
            {avatarPreview && (
              <button
                onClick={resetAvatar}
                className="flex items-center gap-1 text-xs text-fuchsia-600/70 hover:text-red-500 transition-colors"
              >
                <X size={11} /> 변경 취소
              </button>
            )}
          </div>

          {/* 구분선 */}
          <div className="h-px bg-gradient-to-r from-transparent via-pink-200/70 to-transparent my-6" />

          {/* ── 배경 효과 선택 ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-fuchsia-500" />
              <span className="text-sm font-black text-fuchsia-950">배경 효과 선택</span>
              <span className="text-xs text-fuchsia-700/50 hidden sm:inline">(티어 컬러 반영)</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {BG_EFFECTS.map((ef) => (
                <button
                  key={ef.id}
                  type="button"
                  onClick={() => {
                    userPickedBgRef.current = true
                    setBgEffect(ef.id)
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all ${
                    localRing === ef.id
                      ? 'border-fuchsia-500 bg-gradient-to-br from-pink-50 to-fuchsia-50 shadow-md shadow-pink-200/40 scale-[1.03]'
                      : 'border-transparent bg-white/60 hover:border-pink-200/80 hover:bg-rose-50/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${ef.previewCls}`} />
                  <span className="text-[11px] font-bold text-fuchsia-900/80">{ef.label}</span>
                  {localRing === ef.id && (
                    <div className="w-4 h-1 bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* 안내 */}
            <div className="mt-4 px-4 py-3 bg-gradient-to-r from-violet-50/70 to-fuchsia-50/50 rounded-xl border border-violet-100/40">
              <p className="text-[11px] text-fuchsia-800/70 leading-relaxed text-center">
                ✨ 프로필 사진은 매치업 결과 카드와 랭킹 리스트에<br />
                그대로 노출됩니다!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 숨긴 파일 입력 ── */}
      <input ref={fileInputRef} type="file" accept={MATCHUP_IMAGE_INPUT_ACCEPT} className="hidden" onChange={handleFileChange} />

      {/* ══ 하단 시트 ══ */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-fuchsia-950/20 backdrop-blur-sm"
            aria-hidden
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 max-w-screen-sm mx-auto"
            style={{ animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            <div
              className="rounded-t-3xl px-4 pt-3 pb-8 shadow-2xl shadow-pink-200/35 border-t border-pink-100/60
                bg-gradient-to-b from-white/98 via-rose-50/55 to-fuchsia-50/45"
            >
              {/* 핸들 */}
              <div className="w-10 h-1 bg-pink-200/80 rounded-full mx-auto mb-5" />
              <p className="text-sm font-black text-fuchsia-950 text-center mb-4">
                {sheetView === 'camera' ? '카메라로 촬영' : '사진 선택'}
              </p>

              {sheetView === 'camera' ? (
                <div className="max-h-[min(72vh,560px)] space-y-3 overflow-y-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSheetView('menu')}
                    className="flex items-center gap-1 text-xs font-bold text-fuchsia-700 hover:text-fuchsia-900"
                  >
                    <ChevronLeft size={16} aria-hidden />
                    다른 방법으로 선택
                  </button>
                  <SmartphoneCameraCapture
                    quality={90}
                    className="border-fuchsia-100/80 bg-white/80 shadow-none"
                    onCapture={handleCameraCapture}
                    onError={(msg) => showToast(msg, 'error')}
                  />
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="w-full py-3.5 rounded-2xl text-sm font-black border-2 border-fuchsia-400/90 bg-white text-fuchsia-900 hover:bg-fuchsia-50 active:scale-[0.99] transition-all"
                  >
                    닫기
                  </button>
                </div>
              ) : (
              <div className="space-y-2">
                {/* 앨범에서 선택 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-white/70 rounded-2xl border border-sky-100/60 hover:bg-sky-50/90 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center flex-shrink-0 border border-sky-200/50">
                    <ImageIcon size={18} className="text-sky-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-fuchsia-950">앨범에서 선택</p>
                    <p className="text-xs text-fuchsia-700/55">갤러리에서 사진을 선택해요</p>
                  </div>
                </button>

                {/* 카메라로 촬영 */}
                <button
                  type="button"
                  onClick={() => setSheetView('camera')}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-white/70 rounded-2xl border border-emerald-100/70 hover:bg-emerald-50/90 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0 border border-emerald-200/50">
                    <Camera size={18} className="text-emerald-700" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-fuchsia-950">카메라로 촬영</p>
                    <p className="text-xs text-fuchsia-700/55">촬영 후 미리보기에서 확인해요</p>
                  </div>
                </button>

                {/* 기본 이미지로 변경 */}
                {currentImage && (
                  <button
                    onClick={resetAvatar}
                    className="w-full flex items-center gap-4 px-5 py-4 bg-white/70 rounded-2xl border border-red-100/60 hover:bg-red-50/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 border border-red-200/50">
                      <X size={18} className="text-red-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-red-500">기본 이미지로 변경</p>
                      <p className="text-xs text-fuchsia-700/50">프로필 사진을 초기화해요</p>
                    </div>
                  </button>
                )}

                {/* 취소 — 시트 닫기 (강조) */}
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="w-full mt-1 py-3.5 rounded-2xl text-sm font-black border-2 border-fuchsia-400/90 bg-white text-fuchsia-900 shadow-[0_2px_12px_-2px_rgba(192,38,211,0.25)] hover:bg-fuchsia-50 hover:border-fuchsia-500 active:scale-[0.99] transition-all"
                >
                  취소
                </button>
              </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 아바타 이미지 내부 ───────────────────────────────────────────────
function AvatarInner({ currentImage, profile }) {
  return (
    <>
      {currentImage
        ? <img src={safeMediaUrl(currentImage)} alt="프로필" className="w-full h-full object-cover rounded-full" />
        : <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-100 to-fuchsia-200 flex items-center justify-center">
            <span className="text-5xl font-black text-fuchsia-700">
              {profile?.nickname?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
      }
      {/* 카메라 오버레이 */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
        <Camera size={32} className="text-white" />
      </div>
    </>
  )
}
