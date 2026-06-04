# 관리자 페이지 쿼리 효율 (점검 요약)

## 적용한 개선

1. **이의 신청 목록** (`AdminAppealListPage` + `appealAdminStorage`)  
   - 기존: `getAdminAppeals()`로 **전체 행**을 읽은 뒤 클라이언트에서 필터·페이지 분할.  
   - 변경: **`getAdminAppealsPaged`** — Supabase `range` + `count: 'exact'`, 제재 유형·접수일·검색어(`receipt_id` / `nickname` `ilike`)는 **쿼리에서 필터**.  
   - 상단 **미처리/답변 완료 건수**는 목록과 별도로 **`getAdminAppealTotals`** 두 번의 `head: true` count만 조회.  
   - 갱신 시 `vics:adminAppeals:updated` 이벤트로 목록·건수 동기화 (`updateAdminAppeal` 성공 시·이의 제출 성공 시 dispatch).  
   - `select('*')` 대신 목록용 컬럼만 (`APPEAL_LIST_FIELDS`).

2. **문의 관리 목록** (`InquiryAdminListPage`)  
   - 기존: `reply_type = 'auto'`인 **`inquiry_replies` 전 행**을 가져온 뒤 Set으로 필터. 데이터가 많으면 불필요하게 큼.  
   - 변경: 현재 조회한 `inquiries` 행의 `id`만 대상으로 `.in('inquiry_id', inquiryIds)` 로 **관련 행만** 조회.

3. **유저 상세** (`userAdminStorage.getUserDetail`)  
   - 기존: `readUsers()` → **`profiles` 전체**를 읽은 뒤 `find`로 한 명만 사용.  
   - 변경: `id`가 UUID이면 **`profiles` 단건 `select`** + 오버레이 병합. 데모용 비 UUID(`u1` 등)만 기존처럼 `readUsers()` 폴백.

## 남아 있는 비용·추후 과제

| 영역 | 현재 동작 | 규모가 커질 때 |
|------|-----------|----------------|
| **유저 관리 센터** | `fetchProfilesForAdmin`: `profiles` **전 행** + 컬럼 다수, 메모리 캐시 1회 | 수만 명이면 **서버 페이지네이션**(range / RPC) 또는 관리 전용 뷰·검색 API 검토. |
| **문의 목록** | `inquiries` **전 행** 후 클라이언트 필터·페이지네이션 | `.range()` 또는 `limit`+커서, 상태별 인덱스. |
| **이의 목록** | 서버 페이징·필터 (`getAdminAppealsPaged`) | 접수 급증 시 인덱스·검색 컬럼 튜닝. |
| **관리 설정 JSON** | `admin_ui_config` 등 **키 단위** 조회 | 일반적으로 행 수가 적어 문제 적음. |
| **캐시** | `userAdminStorage` `_usersMemCache`는 **탭 내 세션** 수준 | 갱신 시 `invalidateUserListCache()` 호출로 무효화됨. |

## 인덱스 (DB)

자주 쓰는 정렬·필터에 맞춰 Supabase에서 인덱스가 있는지 확인하면 좋습니다.

- `profiles(created_at DESC)` — 유저 목록 정렬  
- `inquiries(created_at DESC)` — 문의 목록  
- `inquiry_replies(inquiry_id, reply_type)` — 자동응답 조회  
- `appeals(created_at DESC)` — 이의 목록  

## 단일 Supabase 클라이언트

관리자 UI는 모두 `src/lib/supabase.js` 한 클라이언트를 사용합니다. 효율과 별개로 **환경 변수가 로컬·배포에서 동일 프로젝트를 가리키는지**는 `docs/DEPLOYMENT_ENV.md`를 따릅니다.
