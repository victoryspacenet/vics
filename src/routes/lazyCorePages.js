import { lazy } from 'react'

/** 홈·피드 — 첫 방문 JS 분리 (App 초기 번들 경량화) */
export const MainPage = lazy(() => import('../pages/MainPage').then((m) => ({ default: m.MainPage })))
export const MainFeedPage = lazy(() =>
  import('../pages/MainFeedPage').then((m) => ({ default: m.MainFeedPage })),
)

export const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })))
export const LoginModal = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginModal })))
