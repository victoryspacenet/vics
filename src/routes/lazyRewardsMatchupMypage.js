import { lazy } from 'react'

/** 매치업 상세 */
export const MatchupDetailPage = lazy(() =>
  import('../pages/MatchupDetailPage').then((m) => ({ default: m.MatchupDetailPage })),
)

/** 리워드 스토어·구매 플로우 */
export const PointRewardsPage = lazy(() =>
  import('../pages/PointRewardsPage').then((m) => ({ default: m.PointRewardsPage })),
)
export const MainSpotlight1hPage = lazy(() =>
  import('../pages/MainSpotlight1hPage').then((m) => ({ default: m.MainSpotlight1hPage })),
)
export const BannerHighlightBoostPage = lazy(() =>
  import('../pages/BannerHighlightBoostPage').then((m) => ({ default: m.BannerHighlightBoostPage })),
)
export const VoteStatsUnlockPage = lazy(() =>
  import('../pages/VoteStatsUnlockPage').then((m) => ({ default: m.VoteStatsUnlockPage })),
)
export const VictoryReportCheerPage = lazy(() =>
  import('../pages/VictoryReportCheerPage').then((m) => ({ default: m.VictoryReportCheerPage })),
)
export const ProfilePublicRewardPage = lazy(() =>
  import('../pages/ProfilePublicRewardPage').then((m) => ({ default: m.ProfilePublicRewardPage })),
)
export const NeonProfileThemePage = lazy(() =>
  import('../pages/NeonProfileThemePage').then((m) => ({ default: m.NeonProfileThemePage })),
)

/** 마이페이지·프로필·탈퇴 */
export const MyPage = lazy(() => import('../pages/MyPage').then((m) => ({ default: m.MyPage })))
export const PublicProfilePage = lazy(() =>
  import('../pages/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage })),
)
export const ProfileEditPage = lazy(() =>
  import('../pages/ProfileEditPage').then((m) => ({ default: m.ProfileEditPage })),
)
export const ProfileImageEditPage = lazy(() =>
  import('../pages/ProfileImageEditPage').then((m) => ({ default: m.ProfileImageEditPage })),
)
export const DeleteAccountPage = lazy(() =>
  import('../pages/DeleteAccountPage').then((m) => ({ default: m.DeleteAccountPage })),
)
export const DeletedPage = lazy(() =>
  import('../pages/DeletedPage').then((m) => ({ default: m.DeletedPage })),
)
