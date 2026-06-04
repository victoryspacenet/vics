# 매치업 상세·투표 체감 속도

## 원인으로 자주 지목되는 부분

1. **매치업 로드**  
   - `matchups` 1건 + 작성자 `profiles` embed 후, **`profiles_tier_rank_snapshot_for_ids` RPC**를 기다린 뒤에야 화면을 채우면 첫 페인트가 늦어짐.  
   - **대응(코드 반영):** RPC 전에 매치업·미디어를 먼저 `setState`하고, 티어 정보는 이어서 병합(2단계 로드).

2. **투표**  
   - `voteViaApi` → Netlify `/api/vote` 왕복 + 서버에서 **FCM 멀티캐스트**가 응답 전에 붙으면 수백 ms~수 초까지 늘어날 수 있음.  
   - **대응(코드 반영):**  
     - 클라: 첫 투표 제출 중 **「처리 중…」** + 스피너(상세 `MatchupDetailPage`, 피드 `MatchupCard`).  
     - 서버: `vote.js`에서 DB insert 성공 직후 **즉시 200**을 반환하고, FCM은 **`context.waitUntil`**(Netlify 최신 Functions)으로 응답 전송 후 이어서 실행. `waitUntil`이 없는 로컬/구형 런타임은 fire-and-forget(완료 보장은 약함).

3. **도전 제출** (`ChallengeDrawer`)  
   - `checkMatchupChallengeSimilarity` → OpenAI 연동 Netlify 함수는 **의도적으로 동기** 대기(유사도 검사). 네트워크·콜드 스타트에 민감.

4. **댓글**  
   - `comments` + `profiles` embed를 **전량** 로드 후 클라이언트 트리 구성. 댓글이 매우 많으면 무거움(추후 `limit`·페이지네이션 검토).

5. **이미지**  
   - 상세 옵션 카드 이미지에 **`loading="lazy"`**, **`decoding="async"`** 적용으로 메인 스레드 부담 일부 완화.

## 운영에서 할 수 있는 것

- Netlify **Functions 콜드 스타트** 완화(유료 플랜·스케줄 핑 등)는 인프라 선택.
