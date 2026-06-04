# 프론트 번들 점검·최적화 (Vite)

## 점검 결과 (의존성)

| 패키지 | 브라우저 번들 | 비고 |
|--------|---------------|------|
| `date-fns` | **미사용** | `package.json`에서 제거함. 코드베이스에 import 없음. |
| `firebase-admin` | **포함 안 됨** | `netlify/lib/fcmCore.cjs` 등 **서버(Netlify)** 전용. 클라이언트 빌드에 들어가지 않음. `dependencies`에 두는 이유는 배포 시 Functions가 동일 `node_modules`를 쓰기 때문. |
| `html-to-image`, `qrcode` | **지연 로드** | `VictoryReportPage` 전용 → lazy chunk `export-image-*` / 페이지 청크로 분리. |
| `lucide-react` | 사용 중 | named import만 사용 → 트리 쉐이킹 + `manualChunks`로 `lucide-*` 분리. |
| `@supabase/supabase-js` | 사용 중 | `manualChunks`로 `supabase-*` 분리(캐시 분리). |

## 적용한 최적화

1. **라우트 코드 스플리팅**  
   - `/admin/*` 하위 페이지 → `src/routes/lazyAdminPages.js`  
   - `/dev/*`, `/rewards/v-card`(V리포트) → `src/routes/lazyDevAndHeavyPages.js`  
   - **공지(`/notice`)·문의(`/inquiry` 등)·랭킹 갤러리** → `src/routes/lazyNoticeInquiryRanking.js` (`App.jsx`의 `<RouteSuspense>`)  
   - **리워드(`/rewards/*`)·매치업 상세(`/matchup/:id`)·마이페이지·프로필·탈퇴** → `src/routes/lazyRewardsMatchupMypage.js`  
   - **랭킹·검색·팬덤·랜딩·이벤트/명예의전당·가입·웰컴·약관·정책·제한** → `src/routes/lazySecondaryPublicPages.js` (`/matchups`는 `refreshRef` 때문에 `<Suspense>` 직접 사용)  
   - **초기 번들에 유지**: `/`, `/feed/*`용 `MainPage`·`MainFeedPage`, 로그인 모달과 동일 파일인 `LoginPage`.  
   - **메인/피드 내부 지연 로드**: `MainPage` 하단(VIP·NEW·GOAT·랭킹 보드) → `MainPageLowerSections.jsx` + `React.lazy`; `MainFeedPage`의 `LegendFeedBanner` → `React.lazy`.  
   - `AdminLayout`의 `<Outlet />`을 `<Suspense>`로 감싸 관리자 화면 전환 시 로딩 처리.

2. **`build.rollupOptions.output.manualChunks`** (`vite.config.js`)  
   - `react-core`, `react-router`, `supabase`, `lucide`, `capacitor`, `export-image` 등으로 vendor 분리.

3. **`build.chunkSizeWarningLimit`**  
   - 메인 앱 청크가 여전히 큼(페이지 수·Tailwind CSS). 경고 기준 **1200kB**. 추가로 줄이려면 **스포트라이트·캐러셀 카드** 단위 분리, **데이터 단계 로딩·스켈레톤 LCP** 등을 검토.

## CSS 용량

`dist/assets/index-*.css` 가 **~600kB** 수준인 것은 Tailwind 유틸 클래스가 많이 쓰인 결과일 수 있음. JS와 별개로, Purge/content 설정은 Tailwind v4 방식(`@tailwindcss/postcss`)에 맞춰 유지.

## 빌드 확인

```bash
npm run build
```

`dist/assets/` 청크 목록과 gzip 크기가 터미널에 출력됨.
