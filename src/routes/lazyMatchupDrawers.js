import { lazy } from 'react'

/** 매치업 생성·도전 Drawer — 무거운 미디어/카메라 의존성 분리 */
export const CreateMatchupDrawer = lazy(() =>
  import('../components/matchup/CreateMatchupDrawer').then((m) => ({ default: m.CreateMatchupDrawer })),
)

export const ChallengeDrawer = lazy(() =>
  import('../components/matchup/ChallengeDrawer').then((m) => ({ default: m.ChallengeDrawer })),
)

/** 유휴 시 청크 워밍 — 첫 Drawer 오픈 지연 완화 */
export function prefetchMatchupDrawers() {
  void import('../components/matchup/CreateMatchupDrawer')
  void import('../components/matchup/ChallengeDrawer')
}
