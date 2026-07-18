import { Link2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { copyMatchupShareLink } from '../../lib/socialShare'

/** 도전 완료 후 공유 안내 — ChallengeDrawer 언마운트 후에도 표시 */
export function ChallengeCompleteShareModal() {
  const navigate = useNavigate()
  const challengeCompleteShare = useUIStore((s) => s.challengeCompleteShare)
  const closeChallengeCompleteShare = useUIStore((s) => s.closeChallengeCompleteShare)
  const showToast = useUIStore((s) => s.showToast)

  if (!challengeCompleteShare) return null

  const { matchupId, matchupTitle } = challengeCompleteShare

  const goToMatchup = () => {
    closeChallengeCompleteShare()
    navigate(`/matchup/${matchupId}`, { replace: true })
  }

  const handleShareAndGo = async () => {
    await copyMatchupShareLink({
      matchupId,
      title: matchupTitle ? `⚔️ ${matchupTitle}` : undefined,
      showToast,
    })
    goToMatchup()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={goToMatchup} />
      <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center space-y-4 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400 rounded-t-3xl" />
        <div className="text-5xl mt-2">🎉</div>
        <div>
          <h3 className="text-lg font-black bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-600 bg-clip-text text-transparent">
            경쟁이 시작됐어요!
          </h3>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            당신의 도전이 성공적으로 등록됐어요!
            <br />
            친구들에게 투표를 부탁해보세요.
          </p>
        </div>
        <div className="px-3 py-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-100/70 rounded-xl">
          <p className="text-sm font-bold text-emerald-800 line-clamp-1">⚔️ &quot;{matchupTitle}&quot;</p>
        </div>
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => { void handleShareAndGo() }}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-2xl text-sm font-bold shadow-[0_4px_18px_-4px_rgba(20,184,166,0.55)] hover:shadow-[0_6px_24px_-4px_rgba(20,184,166,0.7)] hover:-translate-y-0.5 transition-all"
          >
            <Link2 size={16} />
            링크 복사하고 경쟁 보기
          </button>
          <button
            type="button"
            onClick={goToMatchup}
            className="w-full py-3 text-sm text-teal-500/70 hover:text-teal-700 transition-colors font-semibold"
          >
            공유 없이 경쟁 보기
          </button>
        </div>
      </div>
    </div>
  )
}
