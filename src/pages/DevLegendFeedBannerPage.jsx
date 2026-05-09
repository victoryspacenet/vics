import { Navigate } from 'react-router-dom'
import { MainTabBar } from '../components/main'
import { LegendFeedBanner } from '../components/fandom/LegendFeedBanner'

const MOCK_ROWS = [
  { id: 'preview-1', nickname: 'OOTD장인' },
  { id: 'preview-2', nickname: '민트초코덕후' },
  { id: 'preview-3', nickname: 'VictoryKing' },
  { id: 'preview-4', nickname: '스니커헤드' },
  { id: 'preview-5', nickname: '주말러너' },
]

/**
 * 레전드 피드 띠 배너(최대 5명) UI만 확인 — Supabase 없이 고정 데이터
 */
export function DevLegendFeedBannerPage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto max-w-lg -mx-4 px-4 py-6 pb-24 text-[#22282E]">
      <p className="mb-4 text-sm font-bold text-slate-600">
        아래는 <code className="rounded bg-slate-100 px-1 text-xs">MainFeedPage</code>와 동일한 탭 + 배너 조합입니다.
        (데이터는 개발용 목업 5건, 최신이 위로 쌓인 상태를 가정했습니다.)
      </p>
      <MainTabBar currentVariant="best" />
      <LegendFeedBanner staticPreviewRows={MOCK_ROWS} />
      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-xs font-semibold text-slate-500">
        여기 아래는 매치업 카드 영역이라고 가정…
      </div>
    </div>
  )
}
