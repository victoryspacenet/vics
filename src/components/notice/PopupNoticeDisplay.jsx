import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { getActivePopups, dismissPopup, incrementPopupView, incrementPopupClick } from '../../lib/popupNoticeStorage'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'

export function PopupNoticeDisplay() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const popupRefresh = useUIStore((s) => s.popupRefresh)
  const [popups, setPopups] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dontShow24h, setDontShow24h] = useState(false)

  const refreshPopups = useCallback(async () => {
    const list = await getActivePopups(user, profile)
    setPopups(list)
    setCurrentIndex(0)
  }, [user, profile])

  useEffect(() => {
    void refreshPopups()
  }, [user?.id, profile?.points, popupRefresh, refreshPopups])

  useEffect(() => {
    const onUpd = () => void refreshPopups()
    window.addEventListener('vics:popup-notices:updated', onUpd)
    return () => window.removeEventListener('vics:popup-notices:updated', onUpd)
  }, [refreshPopups])

  // 자정 경과 시만 재조회 (라우트·탭 복귀마다 DB 호출하지 않음 — storage 5분 캐시)
  useEffect(() => {
    let lastDate = new Date().toDateString()
    const id = setInterval(() => {
      const today = new Date().toDateString()
      if (today !== lastDate) {
        lastDate = today
        void refreshPopups()
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [refreshPopups])

  const popup = popups[currentIndex]

  useEffect(() => {
    if (popup) void incrementPopupView(popup.id, location.pathname)
    // popup id가 바뀔 때만 1회 집계 (경로 변경으로 중복 집계 방지)
  }, [popup?.id])

  useEffect(() => {
    setDontShow24h(false)
  }, [popup?.id])

  if (!popup) return null

  /** @param {{ snoozeToday?: boolean }} opts — snoozeToday: 체크박스로만 true */
  const handleClose = ({ snoozeToday = false } = {}) => {
    const recordDayHide = snoozeToday || popup.frequency === 'hide_for_day'
    void dismissPopup(popup.id, recordDayHide, user?.id)
    setDontShow24h(false)
    if (currentIndex < popups.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setPopups([])
    }
  }

  const handleImageClick = () => {
    void incrementPopupClick(popup.id, location.pathname)
    if (popup.linkType === 'notice' && popup.linkNoticeId) {
      navigate(`/notice/${popup.linkNoticeId}`)
    } else if (popup.linkType === 'matchup' && popup.linkMatchupId) {
      navigate(`/matchup/${popup.linkMatchupId}`)
    } else if (popup.linkType === 'external' && popup.linkUrl) {
      window.open(popup.linkUrl, '_blank')
    }
    handleClose()
  }

  const hasLink = (popup.linkType === 'notice' && popup.linkNoticeId) ||
    (popup.linkType === 'matchup' && popup.linkMatchupId) ||
    (popup.linkType === 'external' && popup.linkUrl)

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
    >
      <div
        className="relative w-full max-w-[min(280px,63vw)] bg-white rounded-2xl overflow-hidden shadow-2xl"
      >
        <button
          type="button"
          onClick={() => handleClose()}
          className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
        {/* 링크 있으면 클릭 가능, 없으면 단순 이미지 (클릭해도 닫히지 않음) */}
        {hasLink ? (
          <button
            type="button"
            onClick={handleImageClick}
            className="block w-full aspect-[3/4] max-h-[56vh] overflow-hidden cursor-pointer"
          >
            <img
              src={popup.imageUrl}
              alt={popup.name}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div className="block w-full aspect-[3/4] max-h-[56vh] overflow-hidden select-none">
            <img
              src={popup.imageUrl}
              alt={popup.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        )}
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={dontShow24h}
              onChange={(e) => {
                const checked = e.target.checked
                setDontShow24h(checked)
                if (checked) handleClose({ snoozeToday: true })
              }}
              className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-[#22282E] focus:ring-[#22282E]"
            />
            <span className="text-xs font-medium text-gray-700">오늘 하루 다시 보지 않기</span>
          </label>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
