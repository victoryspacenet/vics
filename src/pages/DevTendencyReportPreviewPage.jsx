import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { TendencyReportUnlockModal } from '../components/tendency/TendencyReportUnlockModal'
import { TendencyReportMyPageCardView } from '../components/tendency/TendencyReportMyPageCardView'
import {
  demoReportHref,
  demoTypeFromCardPreset,
  DEMO_TENDENCY_LABELS,
} from '../lib/tendencyReportDemo'

const CARD_PRESETS = [
  {
    id: 'unlocked',
    label: '10표 달성 (처음 열림)',
    status: { voteCount: 10, eligible: true, acknowledged: false, tendencyType: null },
  },
  {
    id: 'progress',
    label: '7~9표 (진행 중)',
    status: { voteCount: 8, eligible: false, acknowledged: false, tendencyType: null },
  },
  {
    id: 'trendsetter',
    label: '확인 후 · 트렌드세터',
    status: { voteCount: 12, eligible: true, acknowledged: true, tendencyType: 'trendsetter' },
  },
  {
    id: 'mainstream',
    label: '확인 후 · 대중적인 입맛',
    status: { voteCount: 15, eligible: true, acknowledged: true, tendencyType: 'mainstream' },
  },
  {
    id: 'unique',
    label: '확인 후 · 독특한 개성파',
    status: { voteCount: 11, eligible: true, acknowledged: true, tendencyType: 'unique' },
  },
]

/**
 * 10표 달성 팝업 + 마이페이지 카드 UI 미리보기 (RPC·투표 수 불필요)
 * `npm run dev` 후 `/dev/tendency-report`
 */
export function DevTendencyReportPreviewPage() {
  const navigate = useNavigate()
  const [showPopup, setShowPopup] = useState(false)
  const [cardPreset, setCardPreset] = useState(CARD_PRESETS[0])

  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />
  }

  const demoType = demoTypeFromCardPreset(cardPreset.id)
  const demoLabel = DEMO_TENDENCY_LABELS[demoType] || '미리보기'

  const openDemoReport = () => {
    if (demoType === 'progress') {
      navigate('/report/tendency?demo=1&type=progress')
      return
    }
    navigate(demoReportHref(demoType, '미리보기_닉네임'))
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 p-6 pb-24">
      <div>
        <h1 className="text-lg font-black text-slate-900">성향 리포트 UI (개발 미리보기)</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          실제 10표 없이 팝업·마이페이지 카드를 확인할 수 있어요.
          URL: <code className="rounded bg-violet-50 px-1 text-xs">/dev/tendency-report</code>
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-violet-200/70 bg-violet-50/40 p-4">
        <h2 className="text-sm font-black text-violet-950">① 10표 달성 팝업</h2>
        <p className="text-xs font-medium text-violet-800/70">
          투표 10회째 직후 Gate에서 뜨는 모달과 동일해요.
        </p>
        <button
          type="button"
          onClick={() => setShowPopup(true)}
          className="w-full rounded-xl border border-violet-300 bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-black text-white shadow-md hover:brightness-110"
        >
          팝업 열기
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-fuchsia-200/70 bg-fuchsia-50/30 p-4">
        <h2 className="text-sm font-black text-fuchsia-950">② 마이페이지 카드</h2>
        <p className="text-xs font-medium text-fuchsia-800/70">
          아래 버튼으로 상태를 바꿔 보세요. 카드는 미리보기 전용(클릭해도 이동하지 않음)이에요.
        </p>
        <div className="flex flex-wrap gap-2">
          {CARD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setCardPreset(p)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                cardPreset.id === p.id
                  ? 'border-fuchsia-400 bg-fuchsia-100 text-fuchsia-900'
                  : 'border-fuchsia-200/80 bg-white text-fuchsia-700 hover:bg-fuchsia-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-dashed border-fuchsia-200/80 bg-white/80 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            MyPage 미리보기
          </p>
          <TendencyReportMyPageCardView status={cardPreset.status} previewOnly />
        </div>
        <button
          type="button"
          onClick={openDemoReport}
          className="w-full rounded-xl border border-fuchsia-300/80 bg-white py-2.5 text-xs font-black text-fuchsia-800 hover:bg-fuchsia-50"
        >
          {demoType === 'progress'
            ? '8/10 — 아직 잠금 화면 보기'
            : `샘플 리포트 열기 · ${demoLabel}`}
        </button>
      </section>

      <TendencyReportUnlockModal
        open={showPopup}
        nickname="미리보기_닉네임"
        onClose={() => setShowPopup(false)}
        onOpenReport={() => {
          setShowPopup(false)
          navigate(demoReportHref('trendsetter', '미리보기_닉네임'))
        }}
      />
    </div>
  )
}
