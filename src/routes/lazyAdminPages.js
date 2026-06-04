import { lazy } from 'react'

/** 관리자 화면 — 초기 로드에서 분리 (AdminLayout 내 `<Suspense><Outlet/></Suspense>` 필요) */
export const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
export const AdminSettingsPage = lazy(() =>
  import('../pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
)
export const AdminOperatorAccountPage = lazy(() =>
  import('../pages/admin/AdminOperatorAccountPage').then((m) => ({ default: m.AdminOperatorAccountPage })),
)
export const AdminOperatorSecurityLogPage = lazy(() =>
  import('../pages/admin/AdminOperatorSecurityLogPage').then((m) => ({ default: m.AdminOperatorSecurityLogPage })),
)
export const AdminOperatorNewPage = lazy(() =>
  import('../pages/admin/AdminOperatorNewPage').then((m) => ({ default: m.AdminOperatorNewPage })),
)
export const AdminOperatorEditPage = lazy(() =>
  import('../pages/admin/AdminOperatorEditPage').then((m) => ({ default: m.AdminOperatorEditPage })),
)
export const AdminOperatorDeletePage = lazy(() =>
  import('../pages/admin/AdminOperatorDeletePage').then((m) => ({ default: m.AdminOperatorDeletePage })),
)
export const AdminPermissionGroupPage = lazy(() =>
  import('../pages/admin/AdminPermissionGroupPage').then((m) => ({ default: m.AdminPermissionGroupPage })),
)
export const AdminTwoFactorPage = lazy(() =>
  import('../pages/admin/AdminTwoFactorPage').then((m) => ({ default: m.AdminTwoFactorPage })),
)
export const AdminAutoBotPage = lazy(() =>
  import('../pages/admin/AdminAutoBotPage').then((m) => ({ default: m.AdminAutoBotPage })),
)
export const AdminServerMaintenancePage = lazy(() =>
  import('../pages/admin/AdminServerMaintenancePage').then((m) => ({ default: m.AdminServerMaintenancePage })),
)
export const AdminBannedWordsPage = lazy(() =>
  import('../pages/admin/AdminBannedWordsPage').then((m) => ({ default: m.AdminBannedWordsPage })),
)
export const AdminMessengerPage = lazy(() =>
  import('../pages/admin/AdminMessengerPage').then((m) => ({ default: m.AdminMessengerPage })),
)
export const AdminSystemPushPage = lazy(() =>
  import('../pages/admin/AdminSystemPushPage').then((m) => ({ default: m.AdminSystemPushPage })),
)
export const AdminApiKeysPage = lazy(() =>
  import('../pages/admin/AdminApiKeysPage').then((m) => ({ default: m.AdminApiKeysPage })),
)
export const AdminMatchupsPage = lazy(() =>
  import('../pages/admin/AdminMatchupsPage').then((m) => ({ default: m.AdminMatchupsPage })),
)
export const AdminMatchupDetailPage = lazy(() =>
  import('../pages/admin/AdminMatchupDetailPage').then((m) => ({ default: m.AdminMatchupDetailPage })),
)
export const AdminUsersPage = lazy(() =>
  import('../pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
)
export const AdminUserDetailPage = lazy(() =>
  import('../pages/admin/AdminUserDetailPage').then((m) => ({ default: m.AdminUserDetailPage })),
)
export const AdminCategoriesPage = lazy(() =>
  import('../pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })),
)
export const InquiryAdminListPage = lazy(() =>
  import('../pages/admin/InquiryAdminListPage').then((m) => ({ default: m.InquiryAdminListPage })),
)
export const InquiryAdminDetailPage = lazy(() =>
  import('../pages/admin/InquiryAdminDetailPage').then((m) => ({ default: m.InquiryAdminDetailPage })),
)
export const InquiryAdminCompletePage = lazy(() =>
  import('../pages/admin/InquiryAdminCompletePage').then((m) => ({ default: m.InquiryAdminCompletePage })),
)
export const InquiryHotFaqAdminPage = lazy(() =>
  import('../pages/admin/InquiryHotFaqAdminPage').then((m) => ({ default: m.InquiryHotFaqAdminPage })),
)
export const InquiryCategoryFaqAdminPage = lazy(() =>
  import('../pages/admin/InquiryCategoryFaqAdminPage').then((m) => ({ default: m.InquiryCategoryFaqAdminPage })),
)
export const AdminAppealListPage = lazy(() =>
  import('../pages/admin/AdminAppealListPage').then((m) => ({ default: m.AdminAppealListPage })),
)
export const AdminAppealDetailPage = lazy(() =>
  import('../pages/admin/AdminAppealDetailPage').then((m) => ({ default: m.AdminAppealDetailPage })),
)
export const NoticeAdminPage = lazy(() =>
  import('../pages/NoticeAdminPage').then((m) => ({ default: m.NoticeAdminPage })),
)
export const NoticeAdminListPage = lazy(() =>
  import('../pages/NoticeAdminListPage').then((m) => ({ default: m.NoticeAdminListPage })),
)
export const NoticeEditPage = lazy(() =>
  import('../pages/NoticeEditPage').then((m) => ({ default: m.NoticeEditPage })),
)
export const PopupNoticeAdminPage = lazy(() =>
  import('../pages/PopupNoticeAdminPage').then((m) => ({ default: m.PopupNoticeAdminPage })),
)
export const PopupNoticeListPage = lazy(() =>
  import('../pages/PopupNoticeListPage').then((m) => ({ default: m.PopupNoticeListPage })),
)
export const PopupNoticeCompletePage = lazy(() =>
  import('../pages/PopupNoticeCompletePage').then((m) => ({ default: m.PopupNoticeCompletePage })),
)
export const PopupNoticeDetailPage = lazy(() =>
  import('../pages/PopupNoticeDetailPage').then((m) => ({ default: m.PopupNoticeDetailPage })),
)
export const PopupNoticeStatsPage = lazy(() =>
  import('../pages/PopupNoticeStatsPage').then((m) => ({ default: m.PopupNoticeStatsPage })),
)
export const NoticePublishCompletePage = lazy(() =>
  import('../pages/NoticePublishCompletePage').then((m) => ({ default: m.NoticePublishCompletePage })),
)
