import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, Image, Video, Type, AlertCircle, AlertTriangle, CheckCircle, Hash, Zap, Share2, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Drawer } from '../ui/Drawer'
import { Modal } from '../ui/Modal'
import { VsBadge } from '../ui/VsBadge'
import { Avatar } from '../ui/Avatar'
import { cn, copyToClipboard } from '../../lib/utils'
import { safeMediaUrl } from '../../lib/sanitize'
import { compressAndCropImage } from '../../lib/mediaCrop'
import { getClipboardMediaFiles } from '../../lib/clipboardPasteFiles'
import {
  saveChallengeDraft,
  loadChallengeDraft,
  clearChallengeDraft,
  hasChallengeDraft,
} from '../../lib/draftStorage'
import {
  MAX_IMAGE_MB,
  MAX_VIDEO_MB,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  validateVideo,
} from '../../lib/mediaSpec'
import {
  MATCHUP_IMAGE_INPUT_ACCEPT,
  MATCHUP_VIDEO_INPUT_ACCEPT,
  validateSelectableRasterImageUpload,
  validatePipelineJpegOutput,
  validateMatchupVideoUpload,
} from '../../lib/uploadMediaValidation'
import { captureVideoPosterJpegFile } from '../../lib/videoPoster'
import { uploadMatchupMediaValidated } from '../../lib/matchupMediaBucketUpload'
import { checkMatchupChallengeSimilarity } from '../../lib/matchupChallengeSimilarityApi'
import {
  assertMatchupSideTypeEquals,
  isMatchupSideType,
  matchupSideTypeLabel,
  mediaFileMatchesMatchupSideType,
} from '../../lib/matchupSideType'

const DESC_MAX = 200

const MZ_IN =
  'border rounded-xl outline-none transition-all text-violet-950/90 disabled:opacity-60'
const MZ_DESC =
  `${MZ_IN} w-full px-3 py-2.5 text-sm bg-gradient-to-br from-violet-50/95 via-white to-cyan-50/40 border-violet-200/50 focus:border-violet-500 focus:ring-2 focus:ring-violet-400/25 resize-none placeholder:text-violet-400/80`
const MZ_READONLY =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/90 text-[#22282E]'

/** B측 콘텐츠 ↔ DB 스냅샷 */
function challengerRightEquals(cur, snap) {
  if (cur == null && snap == null) return true
  if (cur == null || snap == null) return false
  if (cur.type !== snap.type) return false
  if (cur.type === 'text') {
    return (cur.text || '').trim() === (snap.text || '').trim()
  }
  if (cur.file) return false
  if (!cur.fromExisting) return false
  return (
    (cur.persistUrl || '') === (snap.persistUrl || '') &&
    String(cur.persistThumb ?? cur.persistUrl ?? '') === String(snap.persistThumb ?? snap.persistUrl ?? '')
  )
}

function getChallengerEditRightSnapshot(m) {
  if (!m?.right_type) return null
  if (m.right_type === 'text') {
    return { type: 'text', text: m.right_text || '' }
  }
  if (m.right_type === 'image' || m.right_type === 'video') {
    return {
      type: m.right_type,
      preview: m.right_thumbnail_url || m.right_url,
      fromExisting: true,
      persistUrl: m.right_url,
      persistThumb: m.right_thumbnail_url || m.right_url,
    }
  }
  return null
}

function getChallengerFormSnapshot(m) {
  return {
    rightDescription: (m?.right_description || '').trim(),
    rightContent: getChallengerEditRightSnapshot(m),
  }
}

function challengerFormEquals(rightDescription, rightContent, snap) {
  if ((rightDescription || '').trim() !== snap.rightDescription) return false
  return challengerRightEquals(rightContent, snap.rightContent)
}

export function ChallengeDrawer() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { challengeMatchup, challengeMatchupEdit, closeChallengeDrawer, showToast, openLoginModal } =
    useUIStore()

  const [rightDescription, setRightDescription] = useState('')
  const [rightContent, setRightContent] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [shareModal, setShareModal] = useState(null) // { matchupId, title }
  const [boxKey, setBoxKey] = useState(0)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [showEditSubmitWarning, setShowEditSubmitWarning] = useState(false)
  const saveTimeoutRef = useRef(null)

  const isOpen = !!challengeMatchup
  const requiredSideType = challengeMatchup?.left_type

  const isValid = useMemo(() => {
    if (!rightContent) return false
    if (!isMatchupSideType(requiredSideType)) return true
    return rightContent.type === requiredSideType
  }, [rightContent, requiredSideType])

  const hasChallengerEditChanges = useMemo(() => {
    if (!challengeMatchupEdit || !challengeMatchup) return true
    const snap = getChallengerFormSnapshot(challengeMatchup)
    return !challengerFormEquals(rightDescription, rightContent, snap)
  }, [challengeMatchupEdit, challengeMatchup, rightDescription, rightContent])

  const canSubmitChallenge = challengeMatchupEdit ? isValid && hasChallengerEditChanges : isValid

  useEffect(() => {
    if (!isOpen) {
      setRightDescription('')
      setRightContent(null)
      setUploadStep('')
      setBoxKey((k) => k + 1)
      setShowRestorePrompt(false)
      setShowEditSubmitWarning(false)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [isOpen])

  // 도전자(B) 수정: 기존 오른쪽 콘텐츠로 폼 채우기
  useEffect(() => {
    if (!isOpen || !challengeMatchup || !challengeMatchupEdit) return
    const m = challengeMatchup
    setRightDescription(m.right_description || '')
    if (m.right_type === 'text') {
      setRightContent({ type: 'text', text: m.right_text || '' })
    } else if (m.right_type === 'image' || m.right_type === 'video') {
      const preview = m.right_thumbnail_url || m.right_url
      setRightContent({
        type: m.right_type,
        preview,
        fromExisting: true,
        persistUrl: m.right_url,
        persistThumb: m.right_thumbnail_url || m.right_url,
      })
    }
    setBoxKey((k) => k + 1)
    setShowRestorePrompt(false)
  }, [isOpen, challengeMatchup, challengeMatchupEdit])

  const handleClose = () => {
    if (uploading) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    closeChallengeDrawer()
  }

  const isMatchupAuthor = Boolean(user?.id && challengeMatchup?.user_id === user.id)

  const handleRestoreDraft = useCallback(async () => {
    if (!challengeMatchup?.id || !user?.id) return
    const draft = await loadChallengeDraft(challengeMatchup.id, user.id)
    if (!draft?.rightContent) return
    const required = challengeMatchup.left_type
    if (isMatchupSideType(required) && draft.rightContent.type !== required) {
      showToast(
        `임시 저장 내용은 A측(${matchupSideTypeLabel(required)})과 형식이 달라 복원하지 않았어요.`,
        'info',
      )
      return
    }
    setRightDescription(draft.rightDescription || '')
    setRightContent(draft.rightContent)
    setBoxKey((k) => k + 1)
    setShowRestorePrompt(false)
    showToast(draft.hasRestoredFile ? '임시 저장된 내용을 복원했어요' : '임시 저장된 내용을 복원했어요 (이미지/영상은 다시 선택해주세요)', 'success')
  }, [challengeMatchup?.id, challengeMatchup?.left_type, user?.id, showToast])

  const handleDiscardDraft = useCallback(() => {
    if (challengeMatchup?.id && user?.id) clearChallengeDraft(challengeMatchup.id, user.id)
    setShowRestorePrompt(false)
  }, [challengeMatchup?.id, user?.id])

  // 임시 저장 복원 (드로어 열릴 때)
  useEffect(() => {
    if (!isOpen || !challengeMatchup?.id || !user?.id) return
    if (hasChallengeDraft(challengeMatchup.id, user.id)) setShowRestorePrompt(true)
  }, [isOpen, challengeMatchup?.id, user?.id])

  // 임시 저장 (디바운스 800ms)
  useEffect(() => {
    if (!isOpen || !challengeMatchup?.id || !user?.id || uploading) return
    const hasDraft = rightDescription.trim() || rightContent
    if (!hasDraft) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveChallengeDraft(challengeMatchup.id, { rightDescription, rightContent }, user.id)
      saveTimeoutRef.current = null
    }, 800)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [isOpen, challengeMatchup?.id, user?.id, uploading, rightDescription, rightContent])

  // beforeunload + offline 시 즉시 저장
  useEffect(() => {
    if (!isOpen || !user?.id || !challengeMatchup?.id) return
    const hasContent = rightDescription.trim() || rightContent
    const handler = (e) => { if (hasContent && !uploading) e.preventDefault() }
    const onOffline = () => {
      if (hasContent && !uploading) {
        saveChallengeDraft(challengeMatchup.id, { rightDescription, rightContent }, user.id)
      }
    }
    if (hasContent && !uploading) {
      window.addEventListener('beforeunload', handler)
      window.addEventListener('offline', onOffline)
      return () => {
        window.removeEventListener('beforeunload', handler)
        window.removeEventListener('offline', onOffline)
      }
    }
    return () => {}
  }, [isOpen, user?.id, challengeMatchup?.id, rightDescription, rightContent, uploading])

  const uploadFile = async (file, { imageAlreadyCropped = false } = {}) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) throw new Error('이미지 또는 영상 파일만 업로드 가능해요')
    if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error(`이미지는 ${MAX_IMAGE_MB}MB 이하로 올려주세요`)
    if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error(`영상은 ${MAX_VIDEO_MB}MB 이하로 올려주세요`)

    let toUpload = file
    if (isVideo) {
      const sniff = await validateMatchupVideoUpload(file)
      if (!sniff.ok) throw new Error(sniff.message)
      const v = await validateVideo(file)
      if (!v.valid) throw new Error(v.error)
    }

    if (isImage) {
      if (!imageAlreadyCropped) {
        const sniffSel = await validateSelectableRasterImageUpload(file)
        if (!sniffSel.ok) throw new Error(sniffSel.message)
        setUploadStep('이미지 1:1 크롭 중...')
        toUpload = await compressAndCropImage(file)
      }
      const outChk = await validatePipelineJpegOutput(toUpload)
      if (!outChk.ok) throw new Error(outChk.message)
    }

    const ts = Date.now()
    const ext = isImage ? 'jpg' : file.name.split('.').pop()?.toLowerCase() || 'mp4'
    const basePath = `matchups/${user.id}/${ts}-right`

    if (isVideo) {
      setUploadStep('영상 썸네일 만드는 중...')
      const posterFile = await captureVideoPosterJpegFile(file)
      setUploadStep('영상 업로드 중...')
      const videoPath = `${basePath}.${ext}`
      const { error: vErr, publicUrl: videoUrl } = await uploadMatchupMediaValidated(supabase, {
        objectPath: videoPath,
        body: toUpload,
        fileKind: 'video',
        cacheControl: '3600',
        contentType: toUpload.type || undefined,
      })
      if (vErr) {
        const m = vErr.message || ''
        if (m.toLowerCase().includes('policy') || String(vErr.statusCode) === '403')
          throw new Error('Storage 권한이 없어요. 로그인 상태를 확인해주세요.')
        throw new Error(m || '파일 업로드에 실패했어요')
      }
      const posterPath = `${basePath}-poster.jpg`
      const { error: pErr, publicUrl: thumbUrl } = await uploadMatchupMediaValidated(supabase, {
        objectPath: posterPath,
        body: posterFile,
        fileKind: 'image',
        upsert: true,
        cacheControl: '3600',
        contentType: posterFile.type || 'image/jpeg',
      })
      if (pErr) {
        console.warn('[ChallengeDrawer] poster upload failed', pErr)
        return { url: videoUrl, thumbnail: null }
      }
      return { url: videoUrl, thumbnail: thumbUrl }
    }

    setUploadStep('파일 업로드 중...')
    const path = `${basePath}.${ext}`
    const { error, publicUrl } = await uploadMatchupMediaValidated(supabase, {
      objectPath: path,
      body: toUpload,
      fileKind: 'image',
      cacheControl: '3600',
      contentType: toUpload.type || 'image/jpeg',
    })
    if (error) {
      const m = error.message || ''
      if (m.toLowerCase().includes('policy') || String(error.statusCode) === '403')
        throw new Error('Storage 권한이 없어요. 로그인 상태를 확인해주세요.')
      throw new Error(m || '파일 업로드에 실패했어요')
    }
    return { url: publicUrl, thumbnail: publicUrl }
  }

  const handleSubmitClick = () => {
    if (!canSubmitChallenge || uploading || !challengeMatchup) return
    if (!user) {
      openLoginModal()
      return
    }
    if (challengeMatchupEdit) {
      setShowEditSubmitWarning(true)
      return
    }
    void handleSubmit()
  }

  const handleConfirmEditSubmit = () => {
    setShowEditSubmitWarning(false)
    void handleSubmit()
  }

  const handleSubmit = async () => {
    if (!canSubmitChallenge || uploading || !challengeMatchup) return
    if (!user) { openLoginModal(); return }

    const typeCheck = assertMatchupSideTypeEquals(challengeMatchup.left_type, rightContent?.type)
    if (!typeCheck.ok) {
      showToast(typeCheck.message, 'error')
      return
    }

    const isEditRun = challengeMatchupEdit
    if (
      isEditRun &&
      (challengeMatchup.right_type != null || (challengeMatchup.total_votes || 0) > 0)
    ) {
      showToast('매치업이 완료된 뒤에는 수정할 수 없어요.', 'info')
      return
    }

    setUploading(true)
    try {
      let rightUrl = null
      let rightThumbnail = null
      if (rightContent?.file) {
        const r = await uploadFile(rightContent.file, {
          imageAlreadyCropped: rightContent.type === 'image' && rightContent.imagePrepared === true,
        })
        rightUrl = r.url
        rightThumbnail = r.thumbnail
      } else if (rightContent?.fromExisting && (rightContent.type === 'image' || rightContent.type === 'video')) {
        rightUrl = rightContent.persistUrl
        rightThumbnail = rightContent.persistThumb ?? rightContent.persistUrl
      }

      if (rightContent?.type !== 'text' && !rightUrl) {
        throw new Error('B 측(도전자) 이미지·영상을 선택해주세요')
      }

      setUploadStep('콘텐츠 유사도 검사 중...')
      await checkMatchupChallengeSimilarity({
        matchupId: challengeMatchup.id,
        mode: isEditRun ? 'edit' : 'create',
        right:
          rightContent.type === 'text'
            ? { type: 'text', text: (rightContent.text || '').trim() }
            : {
                type: rightContent.type,
                url: rightUrl,
                thumb: rightThumbnail ?? rightUrl,
              },
      })

      setUploadStep(isEditRun ? '수정 저장 중...' : '매치업 완성 중...')

      const basePayload = {
        right_description: rightDescription.trim() || null,
        right_type: rightContent.type,
        right_url: rightContent.type === 'text' ? null : rightUrl,
        right_text: rightContent.type === 'text' ? (rightContent.text || '').trim() || null : null,
        right_thumbnail_url: rightContent.type === 'text' ? null : rightThumbnail,
        updated_at: new Date().toISOString(),
      }

      const insertChallengerFields = isEditRun
        ? {}
        : {
            right_label: profile?.nickname || 'B',
            right_user_id: user.id,
            is_complete: true,
          }

      const { error } = await supabase
        .from('matchups')
        .update({ ...basePayload, ...insertChallengerFields })
        .eq('id', challengeMatchup.id)

      if (error) {
        if (error.code === '42501') throw new Error('권한이 없어요. 작성자 본인이나 도전자만 참여 가능해요.')
        throw new Error(error.message)
      }

      clearChallengeDraft(challengeMatchup.id, user.id)
      const matchupId = challengeMatchup.id
      const matchupTitle = challengeMatchup.title
      closeChallengeDrawer()

      if (isEditRun) {
        showToast('도전자(B) 쪽 수정이 저장됐어요. 상세 페이지에서 바로 확인할 수 있어요.', 'success')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vics:matchup:updated', { detail: { matchupId } }))
        }
        navigate(`/matchup/${matchupId}`)
        return
      }

      showToast('매치업이 성공적으로 완성됐어요! 🎉', 'success')
      setShareModal({ matchupId, matchupTitle })
    } catch (err) {
      console.error('[ChallengeDrawer]', err)
      showToast(err.message || '도전 중 오류가 발생했어요. 다시 시도해주세요.', 'error')
    } finally {
      setUploading(false)
      setUploadStep('')
    }
  }

  const handleShareAndGo = async () => {
    if (!shareModal) return
    const url = `${window.location.origin}/matchup/${shareModal.matchupId}`
    await copyToClipboard(url)
    showToast('링크가 복사됐어요! 친구들에게 공유해보세요 🔗', 'success')
    setShareModal(null)
    navigate(`/matchup/${shareModal.matchupId}`)
  }

  const handleGoWithoutShare = () => {
    if (!shareModal) return
    const id = shareModal.matchupId
    setShareModal(null)
    navigate(`/matchup/${id}`)
  }

  const matchup = challengeMatchup

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={handleClose}
        title={challengeMatchupEdit ? '✏️ 도전자(B) 쪽 수정' : '⚡ 도전장 보내기'}
      >
        {matchup && (
          <div className="p-5 space-y-6 pb-8">

            {/* ── SECTION 1: 경쟁 제목(중앙·A 고정) + 설명(A | B) ── */}
            <section className="space-y-4">
              <SectionLabel emoji="📌" text="경쟁 제목 · 도전 설명" hint="제목은 A 고정 · B는 설명만" />

              <div className="flex flex-col items-center gap-2 px-2 text-center">
                <p className="text-base sm:text-lg font-black text-[#22282E] leading-snug">
                  {matchup.title || '—'}
                </p>
                <p className="text-[10px] font-semibold text-gray-400">
                  User A · {matchup.profiles?.nickname || '작성자'}가 정한 경쟁 제목
                </p>
                <VsBadge size="md" variant="inline" />
              </div>

              <div className="grid grid-cols-[1fr_44px_1fr] gap-2 items-stretch">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md shrink-0">
                      User A
                    </span>
                    <Avatar src={matchup.profiles?.avatar_url} alt={matchup.profiles?.nickname} size="xs" />
                  </div>
                  <p className="text-[10px] font-semibold text-gray-500">경쟁 설명</p>
                  <div
                    className={cn(
                      MZ_READONLY,
                      'min-h-[5.5rem] text-gray-600',
                      !matchup.description && 'text-gray-400 italic',
                    )}
                  >
                    {matchup.description || '설명 없음'}
                  </div>
                </div>

                <div className="flex items-center justify-center py-2">
                  <div className="w-px h-full min-h-[5.5rem] bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                </div>

                <div className="space-y-2 min-w-0">
                  <span className="text-[11px] font-black bg-[#22282E] text-white px-2 py-0.5 rounded-md inline-block">
                    MY SHOT (B)
                  </span>
                  <p className="text-[10px] font-semibold text-gray-500">도전 설명 (선택)</p>
                  <textarea
                    value={rightDescription}
                    onChange={(e) => setRightDescription(e.target.value)}
                    placeholder="도전자 입장에서 설명해 주세요"
                    rows={4}
                    maxLength={DESC_MAX}
                    disabled={uploading}
                    className={MZ_DESC}
                  />
                </div>
              </div>
            </section>

            {/* 임시 저장 복원 안내 */}
            {showRestorePrompt && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-semibold text-amber-800">임시 저장된 내용이 있어요</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    버리기
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    복원하기
                  </button>
                </div>
              </div>
            )}

            {/* ── SECTION 2: 경쟁 구도 ── */}
            <section className="space-y-3">
              <SectionLabel emoji="🥊" text="경쟁 구도" hint="Ready to Fight!" />

              <div className="grid grid-cols-[1fr_44px_1fr] gap-2 items-stretch">
                {/* User A 콘텐츠 (읽기 전용) */}
                <div className="space-y-1.5">
                  <div className="flex items-center">
                    <span className="text-[11px] font-black bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md">
                      User A (고정)
                    </span>
                  </div>
                  <UserAPreview matchup={matchup} />
                </div>

                {/* VS */}
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center justify-center gap-1 min-h-[140px] py-1">
                    <div className="w-px flex-1 min-h-[8px] bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                    <VsBadge size="md" variant="inline" />
                    <div className="w-px flex-1 min-h-[8px] bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                  </div>
                </div>

                {/* User B 업로드 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black bg-[#22282E] text-white px-2 py-0.5 rounded-md">
                      MY SHOT
                    </span>
                  </div>
                  <UserBUploadBox
                    key={`b-${boxKey}`}
                    content={rightContent}
                    onChange={setRightContent}
                    disabled={uploading}
                    requiredSideType={requiredSideType}
                    initialText={
                      challengeMatchupEdit && challengeMatchup?.right_type === 'text'
                        ? challengeMatchup.right_text || ''
                        : undefined
                    }
                  />
                </div>
              </div>

              {isMatchupSideType(requiredSideType) && (
                <p className="text-[11px] text-center text-violet-700 font-semibold">
                  A측과 동일하게{' '}
                  <span className="text-[#22282E]">{matchupSideTypeLabel(requiredSideType)}</span>
                  형식으로만 도전할 수 있어요
                </p>
              )}

              {/* 경고 안내 */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-sm shrink-0 mt-0.5">📢</span>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  {challengeMatchupEdit ? (
                    <>
                      <span className="font-bold">저장</span>하면 B 측 도전 설명·콘텐츠만 갱신돼요. (경쟁 제목·A 쪽은 수정할 수
                      없어요.)
                    </>
                  ) : (
                    <>
                      <span className="font-bold">'최종 매치업 만들기'</span>를 누르면 즉시 투표가 시작되며 수정이
                      불가능해요.
                    </>
                  )}
                </p>
              </div>
            </section>

            {/* ── SECTION 3: 태그 (읽기 전용) ── */}
            {matchup.tags && matchup.tags.length > 0 && (
              <section className="space-y-2">
                <SectionLabel emoji="🏷️" text="태그" hint="User A가 설정함" />
                <div className="flex flex-wrap gap-2">
                  {matchup.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full"
                    >
                      <Hash size={10} />
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ── 업로드 진행 상태 ── */}
            {uploading && uploadStep && (
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-[#22282E] rounded-full animate-spin shrink-0" />
                <span className="text-sm text-gray-600">{uploadStep}</span>
              </div>
            )}

            {/* ── 제출(도전자) / 닫기(작성자) ── */}
            {isMatchupAuthor ? (
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="w-full py-4 rounded-2xl text-sm font-bold text-violet-800 bg-violet-100/60 hover:bg-violet-200/50 transition-colors disabled:opacity-50"
              >
                닫기
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={!canSubmitChallenge || uploading}
                className={cn(
                  'w-full py-4 rounded-2xl text-sm font-black tracking-wide transition-all duration-300',
                  canSubmitChallenge && !uploading
                    ? 'bg-[#22282E] text-white shadow-[0_0_24px_rgba(34,40,46,0.45)] hover:shadow-[0_0_40px_rgba(34,40,46,0.65)] hover:scale-[1.01] active:scale-[0.99]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                )}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    처리 중...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {canSubmitChallenge && <Zap size={16} className="fill-current" />}
                    {challengeMatchupEdit ? '변경 사항 저장' : '최종 매치업 만들기'}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </Drawer>

      {/* ── 공유 유도 모달 ── */}
      <Modal
        isOpen={showEditSubmitWarning}
        onClose={() => !uploading && setShowEditSubmitWarning(false)}
        title="도전자(B) 쪽 수정을 저장할까요?"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-orange-50/60 px-3.5 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" strokeWidth={2.25} />
            <p className="text-sm leading-relaxed text-amber-950/90">
              저장하면 <strong className="font-bold">B측 도전 설명·이미지·영상·텍스트</strong>만 갱신돼요. 경쟁 제목·작성자(A)
              쪽은 바꿀 수 없어요. 부적절한 콘텐츠는 운영 정책에 따라 삭제될 수 있습니다.
            </p>
          </div>
          <ul className="text-xs text-gray-600 space-y-2 pl-0 list-none">
            <li className="flex gap-2">
              <span className="text-violet-500 font-bold">·</span>
              저작권·초상권을 침해하지 않은 콘텐츠만 올려주세요.
            </li>
            <li className="flex gap-2">
              <span className="text-fuchsia-500 font-bold">·</span>
              폭력·선정·혐오·비방 등은 금지됩니다.
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600 font-bold">·</span>
              위 내용을 확인했으며, 수정 저장에 동의합니다.
            </li>
          </ul>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowEditSubmitWarning(false)}
              disabled={uploading}
              className={cn(
                'flex-1 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 border-2 border-transparent',
                'bg-gradient-to-br from-violet-100/90 via-fuchsia-50/80 to-teal-50/70 text-violet-800',
                'hover:from-violet-200/95 hover:via-fuchsia-100/85 hover:to-teal-100/75',
                'shadow-[0_2px_12px_rgba(139,92,246,0.12)]',
                'disabled:opacity-40',
              )}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmEditSubmit}
              disabled={uploading}
              className="flex-1 py-3 rounded-2xl text-sm font-black tracking-wide bg-[#22282E] text-white shadow-[0_0_20px_rgba(34,40,46,0.35)] hover:shadow-[0_0_28px_rgba(34,40,46,0.5)] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:scale-100"
            >
              저장하기
            </button>
          </div>
        </div>
      </Modal>

      {shareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleGoWithoutShare} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center space-y-4">
            {/* 이모지 */}
            <div className="text-5xl">🎉</div>
            <div>
              <h3 className="text-lg font-black text-[#22282E]">경쟁이 시작됐어요!</h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                당신의 경쟁이 시작되었습니다!<br />
                친구들에게 투표를 부탁해보세요.
              </p>
            </div>

            {/* 매치업 제목 미리보기 */}
            <div className="px-3 py-2 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-[#22282E] line-clamp-1">"{shareModal.matchupTitle}"</p>
            </div>

            <div className="space-y-2 pt-1">
              {/* 링크 복사 + 이동 */}
              <button
                onClick={handleShareAndGo}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#22282E] text-white rounded-2xl text-sm font-bold hover:bg-[#363d46] transition-colors"
              >
                <Link2 size={16} />
                링크 복사하고 경쟁 보기
              </button>

              {/* 바로 이동 */}
              <button
                onClick={handleGoWithoutShare}
                className="w-full py-3 text-sm text-gray-400 hover:text-[#22282E] transition-colors font-medium"
              >
                공유 없이 경쟁 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────
function SectionLabel({ emoji, text, hint }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{emoji}</span>
      <span className="text-sm font-bold text-[#22282E]">{text}</span>
      {hint && <span className="text-xs text-gray-400 ml-auto">{hint}</span>}
    </div>
  )
}

// ── User A 고정 미리보기 ──────────────────────────────────────────
function UserAPreview({ matchup }) {
  const src = matchup.left_thumbnail_url || matchup.left_url

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
      <span className="absolute top-2 left-2 z-10 text-[11px] font-black bg-[#22282E]/80 text-white px-1.5 py-0.5 rounded-md">
        {matchup.left_label || 'A'}
      </span>
      {matchup.left_type === 'image' && src && (
        <img src={safeMediaUrl(src)} alt="A" className="w-full h-full object-cover" />
      )}
      {matchup.left_type === 'video' && src && (
        <img src={safeMediaUrl(src)} alt="A" className="w-full h-full object-cover" />
      )}
      {matchup.left_type === 'text' && (
        <div className="w-full h-full flex items-center justify-center p-3 bg-gray-50">
          <p className="text-xs font-medium text-center text-[#22282E] line-clamp-4">{matchup.left_text}</p>
        </div>
      )}
      {/* 잠금 오버레이 */}
      <div className="absolute inset-0 bg-transparent" />
      <div className="absolute bottom-2 right-2 z-10 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md font-semibold">
        🔒 고정
      </div>
    </div>
  )
}

// ── User B 업로드 박스 ────────────────────────────────────────────
function UserBUploadBox({ content, onChange, disabled, requiredSideType = null, initialText }) {
  const fileRef = useRef(null)
  const [contentType, setContentType] = useState(() =>
    isMatchupSideType(requiredSideType) ? requiredSideType : 'image',
  )
  const effectiveType = isMatchupSideType(requiredSideType) ? requiredSideType : contentType
  const [dragging, setDragging] = useState(false)
  const [textInput, setTextInput] = useState(() => (typeof initialText === 'string' ? initialText : ''))
  const [sizeError, setSizeError] = useState('')
  const [processingLabel, setProcessingLabel] = useState('')
  const mediaBusy = Boolean(processingLabel)

  useEffect(() => {
    if (isMatchupSideType(requiredSideType)) {
      setContentType(requiredSideType)
    }
  }, [requiredSideType])

  useEffect(() => {
    if (!content) return
    if (content.type === 'text') {
      setTextInput(typeof content.text === 'string' ? content.text : '')
      if (!isMatchupSideType(requiredSideType)) setContentType('text')
      return
    }
    if ((content.type === 'image' || content.type === 'video') && !isMatchupSideType(requiredSideType)) {
      setContentType(content.type)
    }
  }, [content, requiredSideType])

  useEffect(() => {
    if (typeof initialText === 'string') setTextInput(initialText)
  }, [initialText])

  useEffect(() => {
    if (!content || !isMatchupSideType(requiredSideType)) return
    if (content.type === requiredSideType) return
    if (content.preview?.startsWith?.('blob:')) URL.revokeObjectURL(content.preview)
    onChange(null)
    setTextInput('')
    const check = assertMatchupSideTypeEquals(requiredSideType, content.type)
    if (!check.ok) setSizeError(check.message)
  }, [requiredSideType, content, onChange])

  const validateAndSet = async (file) => {
    if (!file) return
    setSizeError('')
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) { setSizeError('이미지 또는 영상만 가능해요'); return }
    const typeFileCheck = mediaFileMatchesMatchupSideType(effectiveType, file)
    if (!typeFileCheck.ok) {
      setSizeError(typeFileCheck.message)
      return
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) { setSizeError(`최대 ${MAX_IMAGE_MB}MB`); return }
    if (isVideo && file.size > MAX_VIDEO_BYTES) { setSizeError(`최대 ${MAX_VIDEO_MB}MB`); return }
    if (isVideo) {
      setProcessingLabel('영상 검사 중...')
      const sniff = await validateMatchupVideoUpload(file)
      if (!sniff.ok) {
        setProcessingLabel('')
        setSizeError(sniff.message)
        return
      }
      const v = await validateVideo(file)
      setProcessingLabel('')
      if (!v.valid) { setSizeError(v.error); return }
      if (content?.preview?.startsWith?.('blob:')) URL.revokeObjectURL(content.preview)
      const preview = URL.createObjectURL(file)
      onChange({ type: 'video', file, preview })
      return
    }
    if (isImage) {
      setProcessingLabel('이미지 1:1 준비 중...')
      try {
        const sniff = await validateSelectableRasterImageUpload(file)
        if (!sniff.ok) {
          setSizeError(sniff.message)
          return
        }
        const compressed = await compressAndCropImage(file)
        const pj = await validatePipelineJpegOutput(compressed)
        if (!pj.ok) {
          setSizeError(pj.message)
          return
        }
        if (content?.preview?.startsWith?.('blob:')) URL.revokeObjectURL(content.preview)
        const preview = URL.createObjectURL(compressed)
        onChange({ type: 'image', file: compressed, preview, imagePrepared: true })
      } catch {
        setSizeError('이미지를 처리하지 못했어요. 다른 파일로 시도해 주세요.')
      } finally {
        setProcessingLabel('')
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    if (disabled || mediaBusy) return
    validateAndSet(e.dataTransfer.files?.[0])
  }

  const handleRemove = (e) => {
    e?.stopPropagation()
    if (content?.preview?.startsWith?.('blob:')) URL.revokeObjectURL(content.preview)
    onChange(null); setSizeError(''); setProcessingLabel('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const TYPES = [
    { id: 'image', icon: Image },
    { id: 'video', icon: Video },
    { id: 'text',  icon: Type  },
  ]

  const switchType = (t) => {
    if (isMatchupSideType(requiredSideType)) return
    setContentType(t)
    setSizeError('')
    onChange(null)
    setTextInput('')
  }

  return (
    <div className="space-y-1.5">
      {/* 타입 선택 (A측 형식 고정 시 숨김) */}
      {!isMatchupSideType(requiredSideType) ? (
        <div className="flex gap-1 mb-0.5">
          {TYPES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => switchType(id)}
              disabled={disabled}
              className={cn(
                'p-1 rounded transition-colors',
                contentType === id ? 'bg-[#22282E] text-white' : 'text-gray-300 hover:text-gray-500',
                disabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              <Icon size={11} />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] font-semibold text-gray-500 mb-0.5">
          {matchupSideTypeLabel(effectiveType)}로 올려주세요
        </p>
      )}

      {/* 텍스트 입력 */}
      {effectiveType === 'text' ? (
        <textarea
          value={textInput}
          onChange={(e) => {
            setTextInput(e.target.value)
            onChange(e.target.value.trim() ? { type: 'text', text: e.target.value.trim() } : null)
          }}
          placeholder="내 의견을 입력하세요"
          rows={6}
          maxLength={200}
          disabled={disabled}
          className="w-full px-3 py-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] resize-none text-center disabled:opacity-60"
        />
      ) : (
        /* 파일 드롭 박스 */
        <div
          tabIndex={effectiveType === 'text' ? undefined : 0}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={(e) => {
            if (content || disabled || mediaBusy) return
            if (e.target.closest('[data-file-pick]')) return
            e.currentTarget.focus()
          }}
          onPaste={async (e) => {
            if (disabled || mediaBusy || effectiveType === 'text' || content) return
            const acceptImage = effectiveType === 'image'
            const acceptVideo = effectiveType === 'video'
            const files = getClipboardMediaFiles(e, { images: acceptImage, videos: acceptVideo })
            const file = files[0]
            if (!file) return
            e.preventDefault()
            e.stopPropagation()
            await validateAndSet(file)
          }}
          className={cn(
            'relative aspect-square rounded-xl border-2 border-dashed transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#22282E]/25',
            disabled || mediaBusy ? 'opacity-60 cursor-not-allowed' :
            dragging ? 'border-[#22282E] bg-gray-100 scale-[1.02]' :
            content ? 'border-[#22282E] cursor-default' :
            'border-gray-200 bg-gray-50 hover:border-[#22282E]/50 hover:bg-gray-100 cursor-default active:scale-[0.98]'
          )}
        >
          {content ? (
            <>
              {content.type === 'image' && <img src={safeMediaUrl(content.preview)} alt="" className="w-full h-full object-cover" />}
              {content.type === 'video' && <video src={safeMediaUrl(content.preview)} className="w-full h-full object-cover" muted />}
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
                >
                  <X size={11} />
                </button>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                <div className="flex items-center gap-1">
                  <CheckCircle size={11} className="text-green-400" />
                  <span className="text-white text-[10px] font-semibold">준비 완료!</span>
                </div>
              </div>
            </>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 pb-10 text-gray-400">
              {mediaBusy ? (
                <>
                  <span className="w-5 h-5 border-2 border-gray-300 border-t-[#22282E] rounded-full animate-spin" />
                  <p className="text-[10px] font-medium text-gray-500">{processingLabel}</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload size={18} className="text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-500">드롭 또는 붙여넣기</p>
                    <p className="text-[10px] mt-0.5 text-gray-400 leading-snug">
                      {effectiveType === 'video'
                        ? '영상을 복사한 뒤 박스를 눌러 포커스 후 '
                        : '이미지를 복사한 뒤 박스를 눌러 포커스 후 '}
                      <span className="font-bold text-gray-500">Ctrl+V</span>
                    </p>
                    <p className="text-[10px] mt-0.5 text-gray-300">
                      {effectiveType === 'image' ? `JPG, PNG (${MAX_IMAGE_MB}MB)` : `MP4, MOV (${MAX_VIDEO_MB}MB, 15초)`}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          {!content && !mediaBusy && !disabled && (
            <button
              type="button"
              data-file-pick
              onClick={(e) => {
                e.stopPropagation()
                fileRef.current?.click()
              }}
              className="pointer-events-auto absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              파일에서 선택
            </button>
          )}
        </div>
      )}

      {sizeError && (
        <div className="flex items-center gap-1 text-[11px] text-red-500">
          <AlertCircle size={11} />{sizeError}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={effectiveType === 'image' ? MATCHUP_IMAGE_INPUT_ACCEPT : MATCHUP_VIDEO_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => { if (!mediaBusy) validateAndSet(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
