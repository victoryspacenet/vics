# 클라이언트 필터·정렬 vs DB 쿼리 (점검 요약)

## 이번에 DB로 옮긴 것

| 영역 | 이전 | 이후 |
|------|------|------|
| **메인 퀵 피드 BEST** (`mainFeed.js` → `fetchMainMatchupsQuick`) | `limit(20)`만 두고 **클라이언트에서** `total_votes` 정렬 | `order(total_votes desc, created_at desc).limit(20)` |
| **메인 퀵 피드 HOT** | 위와 **동일 20건** 풀에서 정렬·필터 | 투표 0 초과 후보 **`limit(80)`** 후, 백빙 비율만 클라에서 상위 20건(완전 SQL 표현식은 미도입) |
| **내 문의 내역** (`InquiryHistoryPage`) | 전체 `inquiries` 로드 후 **`slice` 페이징** | `fetchUserInquiriesPaged` — `count: 'exact'` + `range` |

## 이미 DB에서 필터·정렬 중인 것 (유지)

- **홈 `/matchups`** (`HomePage`): 상태·카테고리·정렬·`range` + count.
- **검색** (`SearchPage`): `or` + ilike + 정렬 + `range` + count.
- **공지·이의 관리자 목록**: 페이징·필터를 Supabase에 위임한 구간.

## 의도적으로 클라이언트에 남긴 것

- **공지 노출** `canViewNotice` — 티어·프로필 기준은 RLS에 없고 제품 정책상 브라우저 필터.
- **팝업 공지 노출** `getActivePopups` — `doc` JSON + 스누즈·티어·기간 조합; 행 수가 적을 때는 전량 로드 후 필터가 단순함.
- **투표 통계 열람권** (`VoteStatsUnlockPage`) — 후보는 이미 `limit(50)` + DB 정렬; “미구매만” 선택은 집합이 작아 클라이언트 유지 가능.
- **금칙어 관리** 등 소량 행 UI — 전체 로드 후 검색창 필터.

## DB에서 더 빼고 싶을 때

- HOT을 **완전히** SQL 한 방에 넣으려면 `ORDER BY abs(left_votes - right_votes)::numeric / nullif(total_votes,0)` 같은 **뷰·RPC·생성 컬럼** 검토.
- `popup_notices`가 많아지면 `doc` JSONB에 맞춘 **부분 인덱스·쿼리 필터**로 목록 API 분리.
