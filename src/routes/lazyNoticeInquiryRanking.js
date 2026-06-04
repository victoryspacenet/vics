import { lazy } from 'react'

/** 공지(유저) */
export const NoticePage = lazy(() => import('../pages/NoticePage').then((m) => ({ default: m.NoticePage })))
export const NoticeDetailPage = lazy(() =>
  import('../pages/NoticeDetailPage').then((m) => ({ default: m.NoticeDetailPage })),
)
export const ContentDeletionNoticePage = lazy(() =>
  import('../pages/ContentDeletionNoticePage').then((m) => ({ default: m.ContentDeletionNoticePage })),
)

/** 1:1 문의·이의 등 */
export const InquiryMainPage = lazy(() =>
  import('../pages/InquiryMainPage').then((m) => ({ default: m.InquiryMainPage })),
)
export const InquirySearchPage = lazy(() =>
  import('../pages/InquirySearchPage').then((m) => ({ default: m.InquirySearchPage })),
)
export const InquiryCategoryPage = lazy(() =>
  import('../pages/InquiryCategoryPage').then((m) => ({ default: m.InquiryCategoryPage })),
)
export const InquiryCategoryHelpDetailPage = lazy(() =>
  import('../pages/InquiryCategoryHelpDetailPage').then((m) => ({ default: m.InquiryCategoryHelpDetailPage })),
)
export const InquiryFormPage = lazy(() =>
  import('../pages/InquiryFormPage').then((m) => ({ default: m.InquiryFormPage })),
)
export const AppealFormPage = lazy(() =>
  import('../pages/AppealFormPage').then((m) => ({ default: m.AppealFormPage })),
)
export const AppealCompletePage = lazy(() =>
  import('../pages/AppealCompletePage').then((m) => ({ default: m.AppealCompletePage })),
)
export const AppealDetailPage = lazy(() =>
  import('../pages/AppealDetailPage').then((m) => ({ default: m.AppealDetailPage })),
)
export const AppealResultPage = lazy(() =>
  import('../pages/AppealResultPage').then((m) => ({ default: m.AppealResultPage })),
)
export const InquiryFaqDetailPage = lazy(() =>
  import('../pages/InquiryFaqDetailPage').then((m) => ({ default: m.InquiryFaqDetailPage })),
)
export const InquiryCompletePage = lazy(() =>
  import('../pages/InquiryCompletePage').then((m) => ({ default: m.InquiryCompletePage })),
)
export const InquiryHistoryPage = lazy(() =>
  import('../pages/InquiryHistoryPage').then((m) => ({ default: m.InquiryHistoryPage })),
)
export const InquiryHistoryDetailPage = lazy(() =>
  import('../pages/InquiryHistoryDetailPage').then((m) => ({ default: m.InquiryHistoryDetailPage })),
)

/** 마이페이지 — 랭킹 카드 갤러리(html-to-image 등 무거운 편) */
export const RankingGalleryPage = lazy(() =>
  import('../pages/RankingGalleryPage').then((m) => ({ default: m.RankingGalleryPage })),
)
