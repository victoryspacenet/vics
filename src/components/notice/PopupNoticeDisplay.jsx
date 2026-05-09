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
  }, [user?.id, popupRefresh, location.pathname, refreshPopups])

  useEffect(() => {
    const onUpd = () => void refreshPopups()
    window.addEventListener('vics:popup-notices:updated', onUpd)
    return () => window.removeEventListener('vics:popup-notices:updated', onUpd)
  }, [refreshPopups])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPopups()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, refreshPopups])

  // 자정 경과 시 팝업 목록 갱신 (탭을 밤새 열어둔 경우 대응)
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

  const handleClose = (optIn = dontShow24h) => {
    const recordDayHide = optIn || popup.frequency === 'hide_for_day'
    void dismissPopup(popup.id, recordDayHide, user?.id)
    setDontShow24h(false)
    if (currentIndex < popups.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setPopups([])
    }
  }

  const handleClick = () => {
    void incrementPopupClick(popup.id, location.pathname)
    if (popup.linkType === 'notice' && popup.linkNoticeId) {
      navigate(`/notice/${popup.linkNoticeId}`)
      // 내부 링크 이동 후에는 location 변경으로 팝업이 자동 갱신됨 — 별도 close 불필요
    } else if (popup.linkType === 'matchup' && popup.linkMatchupId) {
      navigate(`/matchup/${popup.linkMatchupId}`)
    } else if (popup.linkType === 'external' && popup.linkUrl) {
      window.open(popup.linkUrl, '_blank')
      // 외부 링크는 새 탭 → 팝업 유지 (닫으려면 X 버튼 사용)
    }
  }

  const hasLink = (popup.linkType === 'notice' && popup.linkNoticeId) ||
    (popup.linkType === 'matchup' && popup.linkMatchupId) ||
    (popup.linkType === 'external' && popup.linkUrl)

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
    >
      <div
        className="relative max-w-[min(400px,90vw)] w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
      >
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          aria-label="닫기"
        >
          <X size={18} />
        </button>
        {/* 링크 있으면 클릭 가능, 없으면 단순 이미지 (클릭해도 닫히지 않음) */}
        {hasLink ? (
          <button
            type="button"
            onClick={handleClick}
            className="block w-full aspect-[3/4] max-h-[80vh] overflow-hidden cursor-pointer"
          >
            <img
              src={popup.imageUrl}
              alt={popup.name}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div className="block w-full aspect-[3/4] max-h-[80vh] overflow-hidden select-none">
            <img
              src={popup.imageUrl}
              alt={popup.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        )}
        {/* 매번 노출: 체크 시 당일 숨김 / 하루동안 보지않기: 닫기만으로 당일 숨김 */}
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          {popup.frequency === 'hide_for_day' ? (
            <p className="text-sm font-medium text-gray-600">닫으면 오늘 하루 이 팝업을 다시 보지 않아요.</p>
          ) : (
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={dontShow24h}
                onChange={(e) => setDontShow24h(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#22282E] focus:ring-[#22282E]"
              />
              <span className="text-sm font-medium text-gray-700">오늘 하루 보지 않기</span>
            </label>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
