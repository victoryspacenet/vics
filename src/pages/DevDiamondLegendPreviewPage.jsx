import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FandomDiamondLegendModal } from '../components/fandom/FandomDiamondLegendModal'
import { cn } from '../lib/utils'

/**
 * 다이아몬드 전설 모달만 재생 (RPC·피드 INSERT 없음)
 */
export function DevDiamondLegendPreviewPage() {
  const [open, setOpen] = useState(false)

  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 p-6">
      <h1 className="text-lg font-black text-slate-900">다이아몬드 전설 강림 (개발 미리보기)</h1>
      <p className="text-sm font-medium text-slate-600">
        실제 마일스톤 Gate는 5000 Clap 달성 시 자동으로 이 모달이 뜹니다. 여기서는 연출·UI만 확인합니다.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-cyan-300 bg-gradient-to-r from-slate-900 to-indigo-950 px-5 py-3 text-sm font-black text-cyan-100 shadow-lg"
      >
        💎 전설 연출 재생
      </button>

      <p className="text-xs text-slate-600">
        <strong className="text-slate-800">Legendary Theme</strong>는 다이아 계정에서만 켜지며,{' '}
        <Link to="/rewards" className="font-bold text-cyan-700 underline-offset-2 hover:underline">
          포인트 리워드
        </Link>
        의 프로필·스타일 섹션에서 on/off 할 수 있어요.
      </p>

      <section className="space-y-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Nickname Effect (매치업 리스트)</h2>
        <p className="text-xs text-slate-600">
          <code className="rounded bg-slate-100 px-1 py-0.5">profiles.fandom_tier === &apos;diamond&apos;</code>일 때
          메인·피드 카드와 동일한 닉네임 오라입니다.
        </p>
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
          <p className="mb-2 text-[10px] font-bold text-gray-400">메인 카드 스타일 (작성자 줄)</p>
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="size-6 shrink-0 rounded-full bg-slate-200" aria-hidden />
            <span className="min-w-0 truncate text-xs font-semibold text-gray-600">일반유저</span>
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <div className="size-6 shrink-0 rounded-full bg-gradient-to-br from-cyan-200 to-fuchsia-200" aria-hidden />
            <span
              className={cn(
                'min-w-0 truncate text-xs font-semibold text-slate-800',
                'vics-fandom-diamond-nickname-aura',
              )}
            >
              다이아레전드닉네임
            </span>
          </div>
        </div>
      </section>

      <FandomDiamondLegendModal
        open={open}
        nickname="OOTD장인"
        onClose={() => setOpen(false)}
        onClaimed={() => setOpen(false)}
        claimBehavior="demo"
      />
    </div>
  )
}
