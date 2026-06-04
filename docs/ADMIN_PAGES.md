# 관리자(Admin) 페이지 작업 현황

관리자 페이지 작업 내용을 별도로 정리한 문서입니다.

---

## 레이아웃 및 네비게이션

**파일:** `src/components/layout/AdminLayout.jsx`

- 좌측 사이드바(다크 테마)
- 상단 헤더: 검색, 유저페이지 이동, 알림, 프로필
- 모바일 대응 (햄버거 메뉴)
- 메뉴: 대시보드 | 매치업관리 | 유저관리 | 카테고리관리 | 공지사항 | 설정

---

## 1. 대시보드
**경로:** `/admin/dashboard`  
**파일:** `src/pages/admin/AdminDashboardPage.jsx`

| 구성 | 내용 |
|------|------|
| 실시간 현황 | 전체 회원, 탈퇴 회원, 신규 가입, 진행중 매치업, 오늘의 투표, 긴급신고 |
| 회원 집계 | RPC `get_admin_member_stats` (`supabase_admin_member_stats.sql`) — 탈퇴는 `account_withdrawal_cooldowns` 누적 |
| 긴급 모니터링 | Supabase `matchup_moderation_alerts` 큐 (신고+AI·저유사도 적재) |
| 액션 | 유지(목록 제거) / 차단(종료) / 삭제 — RPC `resolve_matchup_moderation_alert` |

---

## 2. 매치업 관리
**경로:** `/admin/matchups`  
**파일:** `src/pages/admin/AdminMatchupsPage.jsx`  
**스토리지:** `src/lib/matchupsAdminStorage.js`

| 구성 | 내용 |
|------|------|
| 상태별 퀵 스탯 | 진행중 / 종료 / 블라인드 건수 |
| 필터 | 상태, 카테고리, 신고수, 기간, 정렬 |
| 테이블 | ID, 타이틀, 카테고리, 상태, 신고수, 생성일, 관리 |
| 일괄 액션 | 일괄 종료 / 일괄 블라인드 (확인 모달 포함) |
| 링크 | ID·타이틀 클릭 → 매치업 상세 |

---

## 3. 매치업 상세
**경로:** `/admin/matchups/:id`  
**파일:** `src/pages/admin/AdminMatchupDetailPage.jsx`

| 구성 | 내용 |
|------|------|
| 대결 정보 | User A vs User B (프로필, 이미지) |
| AI 판정 | 유사도, 부적절 항목, 판정 내용 |
| 관리자 조치 | 유지 / 경고 / 블라인드 / 종료 버튼 |
| 레이아웃 | 모바일 대응 |

---

## 4. 유저 관리
**경로:** `/admin/users`  
**파일:** `src/pages/admin/AdminUsersPage.jsx`  
**스토리지:** `src/lib/userAdminStorage.js`

| 구성 | 내용 |
|------|------|
| 검색 | 닉네임 검색 |
| 필터 | 상태 (활성/주의/정지/탈퇴), 매너점수 정렬 |
| 테이블 | 닉네임, 매너점수, 매치업수(승/패), 신고수, 상태 |
| 링크 | 닉네임 클릭 → 유저 상세 |

---

## 5. 유저 상세
**경로:** `/admin/users/:id`  
**파일:** `src/pages/admin/AdminUserDetailPage.jsx`

| 구성 | 내용 |
|------|------|
| 프로필 | 닉네임, 가입일, 소셜 |
| 활동 통계 | 총 매치업 생성, 매치업결과 포인트, 총 투표 참여, 투표참여 포인트, 주요 카테고리 |
| 신고 사유별 분류 | 사유별 건수 표시 |
| 제재 및 신고 이력 | 목록 표시 |
| 관리자 메모 | 저장된 메모 목록, 새 메모 추가 |
| 액션 버튼 | 복구(정지 시), 경고 푸시, 7일 정지, 영구 차단, 강제 포인트 회수 |
| **확인 모달** | **7일 정지**, **영구 차단**, **강제 포인트 회수** 클릭 시 경고 팝업 → 취소/확인 |

---

## 6. 카테고리 관리
**경로:** `/admin/categories`  
**파일:** `src/pages/admin/AdminCategoriesPage.jsx`  
**스토리지:** `src/lib/categoryAdminStorage.js`

| 구성 | 내용 |
|------|------|
| 활성 카테고리 | 목록 표시 |
| 토글 | 상단 고정 ON/OFF |
| 편집 | 메인 배너 이미지 편집 |
| 연동 | 유저페이지 매치업 생성 카테고리와 동기화 |

---

## 7. 설정
**경로:** `/admin/settings`  
**파일:** `src/pages/admin/AdminSettingsPage.jsx`

| 구성 | 내용 |
|------|------|
| 메뉴 | 운영자 계정 관리, 권한 그룹 설정 등 |

---

## 8. 운영자 계정 관리
**경로:** `/admin/settings/operators`  
**파일:** `AdminOperatorAccountPage.jsx`, `AdminOperatorNewPage.jsx`, `AdminOperatorEditPage.jsx`, `AdminOperatorDeletePage.jsx`  
**스토리지:** `src/lib/operatorAdminStorage.js`

---

## 9. 고객문의
**경로:** `/admin/inquiry`  
**파일:** `InquiryAdminListPage.jsx`, `InquiryAdminDetailPage.jsx`, `InquiryAdminCompletePage.jsx`  
**스토리지:** `src/lib/inquiryAdminStorage.js`

---

## 10. 공지사항
**경로:** `/admin/notice/new`, `/admin/notice/popup` 등  
**파일:** `NoticeAdminPage.jsx`, `PopupNoticeAdminPage.jsx` 등

---

## 관련 라이브러리

| 파일 | 용도 |
|------|------|
| `src/lib/adminAuth.js` | 관리자 인증 |
| `src/lib/matchupsAdminStorage.js` | 매치업 관리 mock 데이터 |
| `src/lib/userAdminStorage.js` | 유저 관리 mock 데이터 |
| `src/lib/categoryAdminStorage.js` | 카테고리 관리 mock 데이터 |
| `src/lib/operatorAdminStorage.js` | 운영자 계정 mock 데이터 |
| `src/lib/inquiryAdminStorage.js` | 고객문의 mock 데이터 |

---

## 접속 방법

```bash
npm run dev
```

실행 후 브라우저에서 `http://localhost:5173/admin` 접속
