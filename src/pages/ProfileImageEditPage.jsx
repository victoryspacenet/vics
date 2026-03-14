import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, X, Loader2, Sparkles, ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'

// ── 이미지 압축 (최대 512px, JPEG 0.85) ────────────────────────────
async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 512
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height)
          width  = Math.round(width  * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
          'image/jpeg', 0.85
        )
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

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

export function ProfileImageEditPage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile, updateProfile } = useAuthStore()
  const { showToast } = useUIStore()

  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile,    setAvatarFile]    = useState(null)
  const [bgEffect,      setBgEffect]      = useState('none')
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [saving,        setSaving]        = useState(false)

  const fileInputRef   = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    if (!user) { navigate('/'); return }
  }, [user])

  // 이미지 파일 처리
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있어요', 'error'); return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('이미지는 5MB 이하만 가능해요', 'error'); return
    }
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarFile(file)
    setSheetOpen(false)
    // input 초기화 (같은 파일 재선택 가능하도록)
    e.target.value = ''
  }

  const resetAvatar = () => {
    setAvatarPreview(null)
    setAvatarFile(null)
    setSheetOpen(false)
  }

  const hasChanges = !!avatarFile

  const handleSave = async () => {
    if (!hasChanges || saving) return
    setSaving(true)
    try {
      showToast('이미지 압축 중…', 'info')
      const compressed = await compressImage(avatarFile)
      const path = `avatars/${user.id}/profile.jpg`

      showToast('이미지 업로드 중…', 'info')
      const { error: uploadErr } = await supabase.storage
        .from('matchup-media')
        .upload(path, compressed, { upsert: true, cacheControl: '3600' })

      if (uploadErr) {
        showToast('이미지 업로드에 실패했어요', 'error')
        setSaving(false); return
      }

      const { data: urlData } = supabase.storage.from('matchup-media').getPublicUrl(path)
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error } = await updateProfile({ avatar_url: avatarUrl })
      if (error) { showToast('저장에 실패했어요', 'error'); return }

      await fetchProfile(user.id)
      showToast('프로필 사진이 업데이트됐어요 ✓', 'success')
      navigate('/mypage/edit')
    } catch {
      showToast('저장 중 오류가 발생했어요', 'error')
    } finally {
      setSaving(false)
    }
  }

  const effectObj    = BG_EFFECTS.find((e) => e.id === bgEffect) || BG_EFFECTS[0]
  const currentImage = avatarPreview || profile?.avatar_url

  return (
    <div className="max-w-screen-sm mx-auto min-h-screen bg-gray-50">

      {/* ── 상단 바 ── */}
      <div className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <button
          onClick={() => navigate('/mypage/edit')}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-[#22282E]" />
        </button>
        <h1 className="text-base font-black text-[#22282E]">프로필 사진 수정</h1>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-4 py-1.5 text-sm font-black rounded-full transition-all ${
            hasChanges && !saving
              ? 'bg-[#22282E] text-white hover:bg-[#363d46] active:scale-95 shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '저장'}
        </button>
      </div>

      <div className="px-4 py-6 space-y-4">

        {/* ══ 메인 이미지 편집 영역 ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">

          {/* 대형 아바타 프리뷰 (중앙) */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {/* 배경 효과 래퍼 */}
              {effectObj.isGradient
                ? <div className={`rounded-full ${effectObj.wrapCls}`}>
                    <div
                      onClick={() => setSheetOpen(true)}
                      className="relative w-36 h-36 rounded-full overflow-hidden cursor-pointer group bg-white p-0.5"
                    >
                      <AvatarInner currentImage={currentImage} profile={profile} />
                    </div>
                  </div>
                : <div
                    onClick={() => setSheetOpen(true)}
                    className={`relative w-36 h-36 rounded-full overflow-hidden cursor-pointer group ${effectObj.ringCls}`}
                  >
                    <AvatarInner currentImage={currentImage} profile={profile} />
                  </div>
              }

              {/* 편집 뱃지 */}
              <button
                onClick={() => setSheetOpen(true)}
                className="absolute bottom-1 right-1 w-10 h-10 bg-[#22282E] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#363d46] active:scale-95 transition-all"
              >
                <Camera size={18} />
              </button>
            </div>

            {/* 버튼 */}
            <button
              onClick={() => setSheetOpen(true)}
              className="text-sm font-black text-[#22282E] underline underline-offset-2 hover:text-violet-600 transition-colors"
            >
              사진 변경하기
            </button>
            {avatarPreview && (
              <button
                onClick={resetAvatar}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={11} /> 변경 취소
              </button>
            )}
          </div>

          {/* 구분선 */}
          <div className="h-px bg-gray-100 my-6" />

          {/* ── 배경 효과 선택 ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-violet-500" />
              <span className="text-sm font-black text-[#22282E]">배경 효과 선택</span>
              <span className="text-xs text-gray-400 hidden sm:inline">(티어 컬러 반영)</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {BG_EFFECTS.map((ef) => (
                <button
                  key={ef.id}
                  onClick={() => setBgEffect(ef.id)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all ${
                    bgEffect === ef.id
                      ? 'border-[#22282E] bg-gray-50 shadow-sm scale-[1.03]'
                      : 'border-transparent bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${ef.previewCls}`} />
                  <span className="text-[11px] font-bold text-gray-600">{ef.label}</span>
                  {bgEffect === ef.id && (
                    <div className="w-4 h-1 bg-[#22282E] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* 안내 */}
            <div className="mt-4 px-4 py-3 bg-gray-50 rounded-xl">
              <p className="text-[11px] text-gray-500 leading-relaxed text-center">
                ✨ 프로필 사진은 매치업 결과 카드와 랭킹 리스트에<br />
                그대로 노출됩니다!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 하단 저장 버튼 (고정) ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white/95 backdrop-blur-sm border-t border-gray-100 max-w-screen-sm mx-auto z-20">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all ${
            hasChanges && !saving
              ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving
            ? <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> 저장 중…
              </span>
            : '저장하기'}
        </button>
      </div>

      {/* ── 숨긴 파일 입력 ── */}
      <input ref={fileInputRef}   type="file" accept="image/*"          className="hidden" onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />

      {/* ══ 하단 시트 ══ */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 max-w-screen-sm mx-auto"
            style={{ animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            <div className="bg-white rounded-t-3xl px-4 pt-3 pb-8 shadow-2xl">
              {/* 핸들 */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <p className="text-sm font-black text-[#22282E] text-center mb-4">사진 선택</p>

              <div className="space-y-2">
                {/* 앨범에서 선택 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={18} className="text-blue-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#22282E]">앨범에서 선택</p>
                    <p className="text-xs text-gray-400">갤러리에서 사진을 선택해요</p>
                  </div>
                </button>

                {/* 카메라로 촬영 */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Camera size={18} className="text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#22282E]">카메라로 촬영</p>
                    <p className="text-xs text-gray-400">지금 바로 찍어서 적용해요</p>
                  </div>
                </button>

                {/* 기본 이미지로 변경 */}
                {currentImage && (
                  <button
                    onClick={resetAvatar}
                    className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50 rounded-2xl hover:bg-red-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <X size={18} className="text-red-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-red-500">기본 이미지로 변경</p>
                      <p className="text-xs text-gray-400">프로필 사진을 초기화해요</p>
                    </div>
                  </button>
                )}

                {/* 취소 */}
                <button
                  onClick={() => setSheetOpen(false)}
                  className="w-full py-4 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  취소
                </button>
              </div>
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
        ? <img src={currentImage} alt="프로필" className="w-full h-full object-cover rounded-full" />
        : <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <span className="text-5xl font-black text-gray-500">
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
