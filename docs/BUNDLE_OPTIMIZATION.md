# 프론트 번들 점검·최적화 (Vite)

## 점검 결과 (의존성)

| 패키지 | 브라우저 번들 | 비고 |
|--------|---------------|------|
| `date-fns` | **미사용** | `package.json`에서 제거함. 코드베이스에 import 없음. |
| `firebase-admin` | **포함 안 됨** | `netlify/package.json` + `netlify/lib/fcmCore.cjs` **서버 전용**. 루트 `dependencies`에서 분리. Vite alias로 클라이언트 import 시 차단. |
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
   - **매치업 Drawer** (`CreateMatchupDrawer`, `ChallengeDrawer`) → `src/routes/lazyMatchupDrawers.js` (열릴 때만 로드 + 유휴 prefetch)  
   - **초기 번들에 유지**: `/`, `/feed/*`용 `MainPage`·`MainFeedPage`, 로그인 모달과 동일 파일인 `LoginPage`.  
   - **메인/피드 내부 지연 로드**: `MainPage` 하단(VIP·NEW·GOAT·랭킹 보드) → `MainPageLowerSections.jsx` + `React.lazy`; `MainFeedPage`의 `LegendFeedBanner` → `React.lazy`.  
   - `AdminLayout`의 `<Outlet />`을 `<Suspense>`로 감싸 관리자 화면 전환 시 로딩 처리.

2. **`build.rollupOptions.output.manualChunks`** (`vite.config.js`)  
   - `react-core`, `react-router`, `supabase`, `lucide`, `capacitor`, `export-image` 등으로 vendor 분리.

3. **`build.chunkSizeWarningLimit`**  
   - 메인 앱 청크가 여전히 큼(페이지 수·Tailwind CSS). 경고 기준 **1200kB**. 추가로 줄이려면 **스포트라이트·캐러셀 카드** 단위 분리, **데이터 단계 로딩·스켈레톤 LCP** 등을 검토.

## CSS 용량

`dist/assets/index-*.css` 가 **~600kB** 수준인 것은 Tailwind 유틸 클래스가 많이 쓰인 결과일 수 있음. JS와 별개로, Purge/content 설정은 Tailwind v4 방식(`@tailwindcss/postcss`)에 맞춰 유지.

## 페이지 진입 Supabase 요청 최소화

1. **`fetchProfile` TTL 캐시** (`src/store/authStore.js`)  
   - 45초 이내 동일 유저 재조회는 스킵 (스토어에 profile 있을 때).  
   - 로그인·세션 초기화·프로필 수정·포인트 차감 직후는 `{ force: true }`.  
   - 동시 호출은 in-flight Promise로 dedupe.

2. **알림 fetch TTL** (`src/store/notificationStore.js`)  
   - 30초 TTL + in-flight dedupe. 로그인·푸시 갱신·탭 복귀는 `force`.

3. **FandomMilestoneGate**  
   - 라우트(`pathname`) 변경마다 clap stats·마일스톤 DB 조회하던 것을 90초 TTL + profile fingerprint로 제한.

4. **리워드 페이지 마운트 `fetchProfile` 제거**  
   - `NeonProfileThemePage`, `ProfilePublicRewardPage`, `FandomDashboardPage` — auth 초기화에서 이미 profile 로드.

## 빌드 확인

```bash
npm run build
```

`dist/assets/` 청크 목록과 gzip 크기가 터미널에 출력됨.
