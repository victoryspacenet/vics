import { lazy } from 'react'

/** 로컬/QA용 개발 미리보기 — 일반 사용자 경로에서 분리 */
export const DevFandomMilestonePreviewPage = lazy(() =>
  import('../pages/DevFandomMilestonePreviewPage').then((m) => ({ default: m.DevFandomMilestonePreviewPage })),
)
export const DevFandomBronzeBadgePreviewPage = lazy(() =>
  import('../pages/DevFandomBronzeBadgePreviewPage').then((m) => ({ default: m.DevFandomBronzeBadgePreviewPage })),
)
export const DevDiamondLegendPreviewPage = lazy(() =>
  import('../pages/DevDiamondLegendPreviewPage').then((m) => ({ default: m.DevDiamondLegendPreviewPage })),
)
export const DevLegendFeedBannerPage = lazy(() =>
  import('../pages/DevLegendFeedBannerPage').then((m) => ({ default: m.DevLegendFeedBannerPage })),
)
export const DevTendencyReportPreviewPage = lazy(() =>
  import('../pages/DevTendencyReportPreviewPage').then((m) => ({ default: m.DevTendencyReportPreviewPage })),
)

/** html-to-image, qrcode 등 무거운 의존성 */
export const VictoryReportPage = lazy(() =>
  import('../pages/VictoryReportPage').then((m) => ({ default: m.VictoryReportPage })),
)
