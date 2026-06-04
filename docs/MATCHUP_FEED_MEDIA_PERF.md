# 매치업 목록·피드 미디어 체감 속도

## 병목이 되기 쉬운 부분

1. **`profiles_tier_rank_snapshot_for_ids` RPC**  
   목록 데이터를 받은 뒤 작성자마다 티어 스냅샷을 붙이는 동안 카드 전체가 늦게 뜨면, “이미지가 안 나온다”로 느껴질 수 있음.

2. **Supabase를 두 번 순차 호출**  
   메인 피드에서 완료 풀 + 신규 풀을 한 번에 기다리면 왕복이 두 배로 느껴짐.

3. **이미지 다건 동시 로드**  
   캐러셀·피드에서 `loading` 없이 많은 URL을 한꺼번에 당기면 대역·디코딩이 밀림.

## 코드에서 한 일

- **`src/lib/mainFeed.js`**  
  - 완료/신규 매치업 `select`를 **병렬** (`Promise.all`).  
  - 티어 RPC는 **`enrichMainFeedCreatorRanks` 한 번**으로 합침(이전에는 리스트당 3회).  
  - **`fetchMainMatchupsQuick`**: RPC 없이 목록만. **BEST**는 `total_votes`·`created_at` **DB 정렬 상위 20건**, **HOT**은 투표 0 초과 후보만 **DB에서 최대 80건** 가져온 뒤 백빙 비율만 클라이언트에서 상위 20건 선별(데모 폴백 유지).  
  - **`fetchMainMatchups`**: quick + enrich (기존 한 번에 await 용도).

- **`MainPage.jsx`**  
  - `MainFeedPage`와 동일하게 **`quickLoading` / `enriching`**, **`dataRef`**로 재조회 시 스켈레톤 생략.  
  - 캐러셀·NEW 행의 `MainCardSkeleton`은 첫 칸만 **`staticLcp`**.  
  - 하단 lazy 청크 Suspense fallback은 **pulse 없이** 자리만 예약.

- **`MainFeedPage.jsx` (피드 전용 UX)**  
  - `quickLoading` / `enriching` 상태 분리: 스켈레톤은 **퀵 응답 전**에만, 카드·페이지네이션은 퀵 직후 표시.  
  - enrich 중에는 상단에 짧은 문구(`aria-live`)만 표시(카드는 유지).  
  - **`MainFeedCardSkeleton`**: 실제 카드와 비슷한 그리드·여백으로 CLS 완화, 첫 블록은 **`staticLcp`**(전면 `pulse` 없음)로 LCP·모션 부담 감소.  
  - 이미 목록이 있을 때(배너 하이라이트 등으로) **재조회**하면 스켈레톤을 다시 씌우지 않고 기존 카드를 유지한 채 데이터만 갱신.

- **`HomePage.jsx` (`/matchups`)**  
  - 동일하게 DB 응답 직후 빈 `_creatorRankInfo`로 먼저 렌더 → RPC 후 병합.

- **이미지**  
  - `MainMatchupCard`, `FeedCard`, `MatchupCard`: `loading` / `decoding` / `fetchPriority`, 캐러셀·피드 상단 카드는 **`eagerMedia`**로 우선 로드.

- **`MatchupDetailPage` 댓글** (`src/lib/matchupComments.js`)  
  - 첫 진입 시 **최신 N건**만 `range`로 조회하고, `count: 'exact'`로 전체 건수만 별도 집계.  
  - **「이전 댓글 더보기」**로 오래된 구간을 추가 로드(오프셋 페이징).

## 추가로 검토할 수 있는 것

- 카드마다 로그인 시 `votes`·`likes` **N+1 조회**는 네트워크 혼잡을 키울 수 있음(별도 배치 API·부모에서 `in()` 조회 등).

---

## 게시·도전 업로드 체감 속도

이미지 **1:1 크롭·JPEG 인코딩**(`compressAndCropImage`)은 모바일에서 수백 ms~수 초까지 걸릴 수 있어, 예전에는 **「게시하기」 직후**에만 돌아가 “업로드가 느리다”로 느껴지기 쉬웠음.

### 코드에서 한 일

- **`CreateMatchupDrawer` → `ContentBox`**: 이미지 선택(또는 드롭) 직후 크롭·압축 → 미리보기는 처리된 파일 기준. 제출 시 `imagePrepared`이면 **크롭 생략**·스토리지 업로드만.
- **`ChallengeDrawer` → `UserBUploadBox`**: 이미지 동일(선택 시 준비, 제출 시 크롭 생략 가능).
- **`CreateMatchupDrawer` / `ChallengeDrawer` 업로드**: 영상은 `validateVideo`로 길이·해상도·**평균 비트레이트 추정**(`VIDEO_MAX_AVG_BITRATE_MBPS`) 검사 후, `captureVideoPosterJpegFile`로 포스터 업로드.

### 남는 병목

- **영상**: 원본 파일은 그대로 업로드(용량·네트워크). 대신 **JPEG 포스터**(`*-poster.jpg`)를 따로 올려 썸네일·유사도 검사에 사용.
- **도전 유사도 검사**: 외부 API 왕복. 클라이언트 `VITE_MATCHUP_SIMILARITY_TIMEOUT_MS`(기본 28s)·Netlify `MATCHUP_SIMILARITY_OPENAI_TIMEOUT_MS`(기본 20s)로 타임아웃. `FAIL_OPEN`이면 초과·502 등 시 검사 생략.
- OpenAI 프롬프트에는 **원본 미디어 URL을 넣지 않고**, **스틸컷(썸네일) URL만** `image_url`로 전달.
