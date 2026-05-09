import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, PartyPopper, Unlock } from 'lucide-react'
import { Avatar } from './Avatar'
import { markWelcomeBackShown } from '../../lib/restrictionLiftStorage'
import { cn } from '../../lib/utils'

export function WelcomeBackModal({ isOpen, onClose, nickname, avatarUrl, userId, endsAt }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleCommit = async () => {
    if (userId && endsAt) {
      await markWelcomeBackShown(userId, endsAt)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-5">
      <div
        className="absolute inset-0 bg-gradient-to-br from-fuchsia-950/45 via-violet-950/35 to-rose-950/40 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative z-20 flex max-h-[min(92dvh,calc(100vh-2rem))] w-full max-w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.35rem]',
          'border-2 border-pink-200/85 bg-gradient-to-br from-rose-50/98 via-fuchsia-50/95 to-cyan-50/88',
          'shadow-[0_24px_56px_-16px_rgba(236,72,153,0.38),0_10px_32px_-10px_rgba(34,211,238,0.18)]',
          'ring-2 ring-white/90',
        )}
      >
        {/* 닫기: 스크롤 영역과 겹치지 않도록 상단 고정 줄에 배치 */}
        <div className="flex shrink-0 items-center justify-end border-b border-pink-100/40 bg-gradient-to-r from-fuchsia-50/80 to-pink-50/50 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-fuchsia-300/90 bg-white text-fuchsia-800 shadow-md transition hover:bg-fuchsia-50 hover:text-fuchsia-950"
            aria-label="닫기"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-8">
          {/* 히어로 — bg-clip-text는 상단 잘림 방지용 여백·line-height */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200/80 bg-gradient-to-r from-emerald-100/90 to-teal-100/80 px-3 py-1.5 text-[11px] font-black text-emerald-800 shadow-sm shadow-emerald-200/30">
              <Unlock size={12} strokeWidth={2.5} className="shrink-0 text-emerald-600" />
              <span className="text-left leading-snug">이용 제한이 해제되었습니다</span>
            </div>
            <h2 className="mb-1 block bg-gradient-to-r from-fuchsia-700 via-violet-600 to-cyan-600 bg-clip-text px-1 py-1.5 text-2xl font-black leading-[1.25] tracking-tight text-transparent">
              WELCOME BACK!
            </h2>
            <p className="text-base font-black text-fuchsia-950">다시 만나서 반가워요!</p>
            <div className="mt-3 flex justify-center gap-2 text-2xl" aria-hidden>
              <span>🔓</span>
              <span>✨</span>
              <span>🎁</span>
            </div>
          </div>

          {/* 프로필 */}
          <div className="mb-6 flex flex-col items-center">
            <div
              className={cn(
                'flex h-24 w-24 items-center justify-center rounded-full p-0.5',
                'bg-gradient-to-br from-fuchsia-400 via-pink-400 to-cyan-400 shadow-lg shadow-fuchsia-400/35 ring-4 ring-white/90',
              )}
            >
              <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-white">
                <Avatar src={avatarUrl} alt={nickname} size="xl" className="h-full w-full" />
              </div>
            </div>
            <p className="mt-3 text-base font-black text-fuchsia-950">{nickname}</p>
          </div>

          {/* 기능 재활성화 */}
          <div className="mb-4 rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-teal-50/60 to-cyan-50/40 px-4 py-4 shadow-inner shadow-emerald-100/50 ring-1 ring-white/70">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-400/30">
                <PartyPopper size={16} strokeWidth={2.25} />
              </div>
              <p className="text-sm font-black text-emerald-950">이제 모든 기능을 사용할 수 있어요!</p>
            </div>
            <p className="text-xs font-medium leading-relaxed text-emerald-900/75">
              투표, 매치업 생성, 댓글 작성이 다시
              <br />
              활성화되었습니다.
            </p>
          </div>

          {/* 클린 약속 */}
          <div className="mb-5 rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/40 px-4 py-3">
            <p className="mb-1 text-sm font-black text-violet-950">클린 활동 약속하기</p>
            <p className="text-xs font-medium leading-relaxed text-violet-900/70">
              깨끗한 커뮤니티를 위해 가이드라인을
              <br />
              준수하며 활동할 것을 약속해주실 거죠?
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleCommit}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 py-3.5 text-sm font-black text-[#0f1f0f] shadow-md shadow-emerald-300/45 ring-1 ring-white/50 transition hover:brightness-105 active:scale-[0.98]"
            >
              <span aria-hidden>👍</span>
              네, 약속할게요!
            </button>
            <div className="flex w-full justify-center pb-1 pt-1">
              <Link
                to="/community-policy"
                onClick={handleCommit}
                className="inline-block rounded-lg px-1 py-1.5 text-sm font-black whitespace-nowrap text-fuchsia-900 underline decoration-2 decoration-fuchsia-400/90 underline-offset-[6px] transition hover:bg-fuchsia-100/50 hover:text-fuchsia-950"
              >
                가이드라인 다시 확인하기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
