import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FandomMilestoneModal } from '../components/fandom/FandomMilestoneModal'
import { FandomDiamondLegendModal } from '../components/fandom/FandomDiamondLegendModal'

const MILESTONES = [100, 500, 1000, 5000]

const TIER_LABELS = {
  100: '브론즈 (라이징 스타)',
  500: '실버 (크라우드 페이버릿)',
  1000: '골드 (빅토리 아이콘)',
  5000: '다이아몬드 (언터처블 레전드)',
}

/**
 * 마일스톤 축하 모달 UI만 확인 (RPC 미호출). `npm run dev` + 로그인 불필요.
 */
export function DevFandomMilestonePreviewPage() {
  const [milestone, setMilestone] = useState(null)

  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-lg font-black text-slate-900">팬덤 마일스톤 모달 (개발 미리보기)</h1>
      <p className="text-sm font-medium text-slate-600">
        실제 Gate는{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">VITE_FANDOM_UI_DEMO=true</code> 일 때 와이어 Clap
        수로 마일스톤을 띄웁니다. 여기서는 RPC 없이 UI만 재생합니다.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MILESTONES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMilestone(m)}
            className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2.5 text-sm font-black text-fuchsia-900 hover:bg-fuchsia-100 text-left"
          >
            <div className="text-base">{m.toLocaleString('ko-KR')} Clap</div>
            <div className="text-[10px] font-semibold text-fuchsia-600/80 mt-0.5">{TIER_LABELS[m]}</div>
          </button>
        ))}
      </div>

      {/* 5000 = 다이아몬드 전용 모달 */}
      {milestone === 5000 ? (
        <FandomDiamondLegendModal
          open
          nickname="미리보기_닉네임"
          onClose={() => setMilestone(null)}
          onClaimed={() => setMilestone(null)}
          claimBehavior="demo"
        />
      ) : (
        <FandomMilestoneModal
          open={Boolean(milestone)}
          milestone={milestone}
          onClose={() => setMilestone(null)}
          onClaimed={() => setMilestone(null)}
          claimBehavior="demo"
        />
      )}
    </div>
  )
}
