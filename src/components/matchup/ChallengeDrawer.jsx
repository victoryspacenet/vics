import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, Image, Video, Type, AlertCircle, AlertTriangle, CheckCircle, Hash, Zap, Share2, Link2, Camera } from 'lucide-react'
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
import { cameraPhotoToFile } from '../../lib/cameraPhotoToFile'
import { uploadMatchupMediaValidated, warmupMatchupMediaUploadSession } from '../../lib/matchupMediaBucketUpload'
import { SmartphoneCameraCapture } from '../mobile/SmartphoneCameraCapture'
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
      setUploadStep('로그인 확인 중...')
      await warmupMatchupMediaUploadSession(supabase)

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

      // 업로드 후 세션 재확인 (영상 등 긴 업로드 후 토큰 만료 대비)
      await warmupMatchupMediaUploadSession(supabase)

      if (!isEditRun) {
        // 업로드 중 다른 사용자가 먼저 도전했는지 확인
        const { data: freshRow } = await supabase
          .from('matchups')
          .select('right_type, user_id')
          .eq('id', challengeMatchup.id)
          .maybeSingle()

        if (freshRow?.user_id === user.id) {
          throw new Error('본인이 만든 매치업에는 도전할 수 없어요.')
        }
        if (freshRow?.right_type != null) {
          throw new Error('이미 다른 도전자가 참여한 매치업이에요. 다른 매치업에 도전해보세요!')
        }
      }

      const basePayload = {
        right_description: rightDescription.trim() || null,
        right_type: rightContent.type,
        right_url: rightContent.type === 'text' ? null : rightUrl,
        right_text: rightContent.type === 'text' ? (rightContent.text || '').trim() || null : null,
        right_thumbnail_url: rightContent.type === 'text' ? null : rightThumbnail,
        updated_at: new Date().toISOString(),
      }

      // 도전 완료 시 투표 기간을 현재 시각 기준으로 리셋
      // (A가 매치업을 오래전에 만들었을 경우 expires_at이 과거일 수 있음)
      let freshExpiresAt = null
      if (!isEditRun) {
        const origCreated = challengeMatchup?.created_at
        const origExpires = challengeMatchup?.expires_at
        if (origCreated && origExpires) {
          const durationMs = new Date(origExpires) - new Date(origCreated)
          // 최소 24h, 최대 48h 범위로 클램프
          const clampedMs = Math.max(24 * 3600000, Math.min(48 * 3600000, durationMs))
          freshExpiresAt = new Date(Date.now() + clampedMs).toISOString()
        } else {
          freshExpiresAt = new Date(Date.now() + 24 * 3600000).toISOString()
        }
      }

      const insertChallengerFields = isEditRun
        ? {}
        : {
            right_label: profile?.nickname || 'B',
            right_user_id: user.id,
            is_complete: true,
            ...(freshExpiresAt ? { expires_at: freshExpiresAt } : {}),
          }

      let updateResult = await supabase
        .from('matchups')
        .update({ ...basePayload, ...insertChallengerFields })
        .eq('id', challengeMatchup.id)
        .select('id')

      // right_description 컬럼이 없는 DB(마이그레이션 미적용)를 위한 폴백
      if (updateResult.error && /column.*right_description/i.test(updateResult.error.message)) {
        const { right_description: _rd, ...payloadWithoutDesc } = basePayload
        updateResult = await supabase
          .from('matchups')
          .update({ ...payloadWithoutDesc, ...insertChallengerFields })
          .eq('id', challengeMatchup.id)
          .select('id')
      }

      const { data: updatedRows, error } = updateResult

      if (error) {
        if (error.code === '42501') {
          throw new Error('권한이 없어요. 로그인 상태를 확인하거나 페이지를 새로고침해 주세요.')
        }
        throw new Error(error.message || '저장 중 오류가 발생했어요.')
      }

      // RLS가 조용히 차단(0행 업데이트)되는 경우 감지
      if (!updatedRows || updatedRows.length === 0) {
        if (isEditRun) {
          throw new Error('수정 권한이 없거나 이미 변경된 매치업이에요.')
        }
        throw new Error('도전 등록에 실패했어요. 이미 다른 사람이 먼저 도전했을 수 있어요. 페이지를 새로고침해 주세요.')
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
                <p className="text-base sm:text-lg font-black bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-600 bg-clip-text text-transparent leading-snug">
                  {matchup.title || '—'}
                </p>
                <p className="text-[10px] font-semibold text-teal-500/70">
                  User A · {matchup.profiles?.nickname || '작성자'}가 정한 경쟁 제목
                </p>
                <VsBadge size="md" variant="inline" />
              </div>

              <div className="grid grid-cols-[1fr_44px_1fr] gap-2 items-stretch">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200/70 px-2 py-0.5 rounded-md shrink-0">
                      User A
                    </span>
                    <Avatar src={matchup.profiles?.avatar_url} alt={matchup.profiles?.nickname} size="xs" />
                  </div>
                  <p className="text-[10px] font-semibold text-amber-600/70">경쟁 설명</p>
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
                  <span className="text-[11px] font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-0.5 rounded-md inline-block shadow-[0_2px_8px_-2px_rgba(20,184,166,0.5)]">
                    MY SHOT ⚔️
                  </span>
                  <p className="text-[10px] font-semibold text-emerald-600/70">도전 설명 (선택)</p>
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
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50/70 border border-amber-200/80 rounded-xl shadow-sm">
                <p className="text-sm font-bold text-amber-800">💾 임시 저장된 내용이 있어요</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200/70"
                  >
                    버리기
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    className="px-3 py-1.5 text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all"
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
                    <span className="text-[11px] font-black bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200/70 px-2 py-0.5 rounded-md">
                      🔒 A (고정)
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
                    <span className="text-[11px] font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-0.5 rounded-md shadow-[0_2px_8px_-2px_rgba(20,184,166,0.5)]">
                      ⚔️ MY SHOT
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
                <p className="text-[11px] text-center text-teal-700 font-bold bg-teal-50/60 border border-teal-200/50 rounded-lg px-3 py-1.5">
                  A측과 동일하게{' '}
                  <span className="text-emerald-700 font-black">{matchupSideTypeLabel(requiredSideType)}</span>
                  형식으로만 도전할 수 있어요
                </p>
              )}

              {/* 경고 안내 */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-gradient-to-r from-rose-50/80 to-orange-50/60 border border-rose-200/60 rounded-xl shadow-sm">
                <span className="text-sm shrink-0 mt-0.5">📢</span>
                <p className="text-[11px] text-rose-700 leading-relaxed">
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
                      className="flex items-center gap-1 text-xs font-bold bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 border border-teal-200/60 px-2.5 py-1 rounded-full"
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
              <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-cyan-50/60 border border-emerald-200/60 rounded-xl shadow-sm">
                <span className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin shrink-0" />
                <span className="text-sm font-bold text-emerald-700/90">{uploadStep}</span>
              </div>
            )}

            {/* ── 제출(도전자) / 닫기(작성자) ── */}
            {isMatchupAuthor ? (
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="w-full py-4 rounded-2xl text-sm font-bold text-teal-800 bg-gradient-to-r from-teal-100/70 to-emerald-100/60 border border-teal-200/50 hover:from-teal-200/80 hover:to-emerald-200/70 transition-colors disabled:opacity-50"
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
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_4px_22px_-4px_rgba(20,184,166,0.6)] hover:shadow-[0_6px_32px_-4px_rgba(20,184,166,0.75)] hover:scale-[1.02] active:scale-[0.99] hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400'
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
              className="flex-1 py-3 rounded-2xl text-sm font-black tracking-wide bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_4px_18px_-4px_rgba(20,184,166,0.5)] hover:shadow-[0_6px_24px_-4px_rgba(20,184,166,0.65)] hover:scale-[1.01] active:scale-[0.99] hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 transition-all disabled:opacity-40 disabled:hover:scale-100"
            >
              저장하기
            </button>
          </div>
        </div>
      </Modal>

      {shareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={handleGoWithoutShare} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center space-y-4 overflow-hidden">
            {/* 상단 그라디언트 바 */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400 rounded-t-3xl" />
            {/* 이모지 */}
            <div className="text-5xl mt-2">🎉</div>
            <div>
              <h3 className="text-lg font-black bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-600 bg-clip-text text-transparent">경쟁이 시작됐어요!</h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                당신의 도전이 성공적으로 등록됐어요!<br />
                친구들에게 투표를 부탁해보세요.
              </p>
            </div>

            {/* 매치업 제목 미리보기 */}
            <div className="px-3 py-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-100/70 rounded-xl">
              <p className="text-sm font-bold text-emerald-800 line-clamp-1">⚔️ "{shareModal.matchupTitle}"</p>
            </div>

            <div className="space-y-2 pt-1">
              {/* 링크 복사 + 이동 */}
              <button
                onClick={handleShareAndGo}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl text-sm font-bold shadow-[0_4px_18px_-4px_rgba(20,184,166,0.55)] hover:shadow-[0_6px_24px_-4px_rgba(20,184,166,0.7)] hover:-translate-y-0.5 transition-all"
              >
                <Link2 size={16} />
                링크 복사하고 경쟁 보기
              </button>

              {/* 바로 이동 */}
              <button
                onClick={handleGoWithoutShare}
                className="w-full py-3 text-sm text-teal-500/70 hover:text-teal-700 transition-colors font-semibold"
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
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-[0_3px_12px_-2px_rgba(20,184,166,0.5)] text-sm">{emoji}</span>
      <span className="text-sm font-black bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 bg-clip-text text-transparent">{text}</span>
      {hint && <span className="text-xs text-teal-500/70 ml-auto font-semibold">{hint}</span>}
    </div>
  )
}

// ── User A 고정 미리보기 ──────────────────────────────────────────
function UserAPreview({ matchup }) {
  const src = matchup.left_thumbnail_url || matchup.left_url

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-amber-50/50 border border-amber-200/50">
      <span className="absolute top-2 left-2 z-10 text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-md shadow-sm">
        {matchup.left_label || 'A'}
      </span>
      {matchup.left_type === 'image' && src && (
        <img src={safeMediaUrl(src)} alt="A" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {matchup.left_type === 'video' && src && (
        <img src={safeMediaUrl(src)} alt="A" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {matchup.left_type === 'text' && (
        <div className="absolute inset-0 flex items-center justify-center p-3 bg-gradient-to-br from-amber-950/90 via-orange-900/80 to-rose-950/85">
          <p className="text-xs font-bold text-center text-white/90 line-clamp-4">{matchup.left_text}</p>
        </div>
      )}
      <div className="absolute bottom-2 right-2 z-10 bg-amber-500/80 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">
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
  const [showCamera, setShowCamera] = useState(false)
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

  const handleCameraCapture = async (photo) => {
    setSizeError('')
    try {
      const file = await cameraPhotoToFile(photo, 'matchup-b.jpg')
      await validateAndSet(file)
      setShowCamera(false)
    } catch (err) {
      setSizeError(err?.message ? String(err.message) : '카메라 사진을 불러오지 못했어요')
    }
  }

  const switchType = (t) => {
    if (isMatchupSideType(requiredSideType)) return
    setContentType(t)
    setSizeError('')
    setShowCamera(false)
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
                'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all',
                contentType === id
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_2px_8px_-2px_rgba(20,184,166,0.5)]'
                  : 'text-emerald-500/70 hover:text-emerald-800 hover:bg-emerald-50/60 border border-emerald-100/60',
                disabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              <Icon size={10} />
              {id === 'image' ? '이미지' : id === 'video' ? '영상' : '텍스트'}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] font-bold text-emerald-600/80 mb-0.5">
          {effectiveType === 'image' ? '🖼️ ' : effectiveType === 'video' ? '🎬 ' : '✏️ '}{matchupSideTypeLabel(effectiveType)}로 올려주세요
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
          className="w-full px-3 py-3 text-xs bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-cyan-50/40 border border-emerald-200/60 rounded-xl outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/30 resize-none text-center text-emerald-900/80 placeholder:text-emerald-500/60 disabled:opacity-60"
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
            'relative aspect-square rounded-xl border-2 border-dashed transition-all overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30',
            disabled || mediaBusy ? 'opacity-60 cursor-not-allowed' :
            dragging ? 'border-emerald-500 bg-emerald-50/80 scale-[1.02]' :
            content ? 'border-emerald-400 cursor-default' :
            'border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-cyan-50/40 hover:border-emerald-300 hover:from-emerald-50/80 hover:via-teal-50/60 cursor-default active:scale-[0.98]'
          )}
        >
          {content ? (
            <>
              {content.type === 'image' && (
                <img
                  src={safeMediaUrl(content.preview)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {content.type === 'video' && (
                <video
                  src={safeMediaUrl(content.preview)}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
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
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 pb-10">
              {mediaBusy ? (
                <>
                  <span className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                  <p className="text-[10px] font-bold text-emerald-600">{processingLabel}</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_4px_14px_-3px_rgba(20,184,166,0.5)]">
                    <Upload size={18} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-emerald-700/80">드롭 또는 붙여넣기</p>
                    <p className="text-[10px] mt-0.5 text-emerald-600/55 leading-snug">
                      {effectiveType === 'video' ? '영상 복사 후 박스 클릭 → ' : '이미지 복사 후 박스 클릭 → '}
                      <span className="font-black text-emerald-700/80">Ctrl+V</span>
                    </p>
                    <p className="text-[10px] mt-0.5 text-emerald-500/45">
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
              className="pointer-events-auto absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-emerald-300/70 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm transition hover:from-emerald-100 hover:to-teal-100 hover:shadow-[0_2px_10px_-3px_rgba(20,184,166,0.4)]"
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

      {/* 카메라 촬영 — 이미지 타입이고 콘텐츠 없을 때만 표시 */}
      {effectiveType === 'image' && !content && (
        <div className="space-y-2">
          {!showCamera ? (
            <button
              type="button"
              disabled={disabled || mediaBusy}
              onClick={() => setShowCamera(true)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/95 to-teal-50/80 py-2.5 text-[11px] font-bold text-emerald-900 transition-colors',
                'hover:border-emerald-300 hover:from-emerald-50 hover:to-teal-50',
                (disabled || mediaBusy) && 'cursor-not-allowed opacity-45'
              )}
            >
              <Camera size={14} className="shrink-0" aria-hidden />
              카메라로 촬영
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-emerald-100 bg-white/95 p-2 shadow-sm">
              <button
                type="button"
                disabled={disabled}
                onClick={() => { setShowCamera(false); setSizeError('') }}
                className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950"
              >
                ← 파일 선택으로 돌아가기
              </button>
              <SmartphoneCameraCapture
                quality={88}
                className="border-0 p-2 shadow-none"
                onCapture={handleCameraCapture}
                onError={(m) => setSizeError(m)}
              />
            </div>
          )}
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
