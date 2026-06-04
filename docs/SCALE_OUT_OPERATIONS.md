# 접속 급증·운영 체크리스트 (스케일 아웃 / P1)

트래픽 이벤트·배포 전·인시던트 대응 시 확인용입니다.  
환경 변수 상세는 [`DEPLOYMENT_ENV.md`](DEPLOYMENT_ENV.md), 성능 코드 이력은 [`MATCHUP_VOTE_PERF.md`](MATCHUP_VOTE_PERF.md) · [`CLIENT_QUERY_AUDIT.md`](CLIENT_QUERY_AUDIT.md)를 참고하세요.

---

## 1. Supabase SQL (배포 전 1회)

Supabase Dashboard → **SQL Editor**에서 아래를 **아직 안 했다면** 순서대로 실행합니다.

| 파일 | 용도 |
|------|------|
| `supabase_server_maintenance_settings.sql` | 점검·긴급 점검 설정 (`admin_settings.server_maintenance`) |
| `supabase_api_rate_limits.sql` | **투표 API 분산 rate limit** (`consume_api_rate_limit` RPC) |
| `supabase_vote_ip_limit.sql` | 매치업·IP당 투표 상한 (DB) |
| `supabase_admin_member_stats.sql` | 관리자 대시보드 회원 통계 RPC |

기존 스키마·RLS는 저장소 루트의 `supabase_*.sql` 목록을 프로젝트 기준으로 점검하세요.

### Pooler URL 안내

VICS 앱·Netlify Functions는 **`@supabase/supabase-js`** 만 사용합니다.  
환경 변수는 **`https://<project-ref>.supabase.co`** (Project URL)이 맞고,  
Database 탭의 **`postgresql://…pooler…` URI는 직접 SQL 클라이언트용**이며 `VITE_SUPABASE_URL` 자리에 넣지 않습니다.

---

## 2. Netlify 환경 변수

[Project configuration → Environment variables](https://app.netlify.com)

| 변수 | 필수 | 용도 |
|------|------|------|
| `VITE_SUPABASE_URL` | ✅ | API URL (`https://….supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | 클라이언트·일부 Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (투표 분산 한도) | `vote`, 가입 보강, **분산 rate limit RPC** |
| `VITE_SITE_ORIGIN` | 권장 | OAuth·`/api/*`·Capacitor |

변수 변경 후 **Trigger deploy**로 재빌드합니다.

---

## 3. 코드에 반영된 P1 (요약)

### 3.1 피드 vote/like 배치화

- **경로:** `src/lib/matchupUserEngagement.js`, `MatchupEngagementProvider`, `/matchups` (`HomePage`)
- **효과:** 로그인 피드에서 카드마다 `votes`/`likes` 조회하지 않고, 페이지당 **최대 2×청크 쿼리**
- **확인:** DevTools Network → `/matchups` 로그인 후 `votes`·`likes`가 `in.(matchup_id)` 형태로 **소수 요청**인지

### 3.2 투표 분산 rate limit

- **경로:** `netlify/functions/vote.js`, `netlify/lib/rateLimitDistributed.cjs`
- **한도:** 인스턴스 메모리 **120/분/IP** + Supabase RPC **90/분/IP** (`scope: vote`)
- **전제:** `supabase_api_rate_limits.sql` + `SUPABASE_SERVICE_ROLE_KEY`
- **확인:** RPC 미적용 시 메모리 한도만 동작(인스턴스마다 따로 카운트될 수 있음)

### 3.3 점검·헬스 probe 완화

- **경로:** `src/lib/serverMaintenance.js`, `serverMaintenanceStore.js`
- **평상시:** 120초마다 `server_maintenance` 설정만 조회, **헬스 프로브 생략**
- **프로브 실행:** 앱 첫 로드 1회, 점검 ON, 이전 다운 감지, 긴급 점검(12초 폴링)
- **light 프로브:** 점검 OFF일 때 정적 사이트 GET만 ( `admin_settings` 반복 조회 감소)

### 3.4 OG rate limit

- **경로:** `netlify/functions/matchup-og.js`
- **한도:** IP당 **40/분** (`scope: matchup-og`)

### 3.5 긴급 점검·운영자 UI

- 관리자: `/admin` · 헤더 **긴급 점검** · 점검 화면 하단 **관리자 콘솔 / 점검 해제**
- 문서: 설정 → 서버 점검·다운 안내

---

## 4. 모니터링 (대시보드 위치)

### Supabase

| 보는 것 | 위치 |
|---------|------|
| CPU, Disk IOPS, 연결 수 | 프로젝트 → **Observability → Reports → Database** |
| Disk IO 예산 | **Observability → Database Health** (버스트 인스턴스) |
| 느린 쿼리 | **Observability → Query Performance** |
| 권고(인덱스 등) | **Advisor** (상단 패널) |

**CPU 80% 이메일 알림** 같은 임계값 UI는 Reports에 없을 수 있습니다. 필요 시 [Metrics API + Grafana](https://supabase.com/docs/guides/telemetry/metrics/grafana-self-hosted)로 Slack 등 연동합니다.

앱 연결 확인: **Settings → API → Project URL** = `VITE_SUPABASE_URL`

### Netlify

| 보는 것 | 위치 |
|---------|------|
| Functions 에러·지연 | 사이트 → **Logs & metrics → Observability** (Credit/Pro) |
| 구 UI Function Metrics | **Logs & metrics → Functions** (Legacy·Observability 없을 때) |
| 호출 로그 | **Logs & metrics → Functions** → 함수 선택 |

**우선 확인 함수:** `vote`, `profiles-bootstrap-signup`, `nickname-check`, `matchup-og`

로컬 `npm run dev`만으로는 Functions 메트릭에 잡히지 않습니다. **배포 URL** 기준으로 봅니다.

---

## 5. 배포 전 체크리스트 (복사용)

- [ ] Supabase SQL: `supabase_api_rate_limits.sql` (투표 분산 한도)
- [ ] Supabase SQL: `supabase_server_maintenance_settings.sql` (미실행 시)
- [ ] Netlify: `VITE_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` + `VITE_SITE_ORIGIN`
- [ ] Netlify 재배포 완료
- [ ] `/matchups` 로그인 → Network에서 votes/likes **배치 조회** 확인
- [ ] `/api/vote` 정상·과다 호출 시 429 확인 (선택)
- [ ] Observability에서 `vote` p95·5xx 스파이크 없음 (이벤트 전후)
- [ ] 긴급 점검 켜기/해제·`/admin` 접근 리허설 (선택)

---

## 6. 트래픽 급증 시 대응 순서

1. **긴급 점검 모드** (관리자 헤더 또는 설정) — 일반 유저 차단, `/admin`에서 복구 작업  
2. **Supabase Reports → Database** — CPU·연결·Disk IOPS  
3. **Netlify Observability** — `vote` 5xx·p95  
4. **Query Performance** — 느린 쿼리·인덱스  
5. 필요 시 Supabase **compute 업그레이드**, Netlify 플랜·Functions 한도 확인  

---

## 7. 추후 과제 (P2)

| 항목 | 비고 |
|------|------|
| 관리자 `profiles` 전량 로드 | 서버 페이징·RPC ([`ADMIN_QUERY_EFFICIENCY.md`](ADMIN_QUERY_EFFICIENCY.md)) |
| 문의 `inquiries` 전량 로드 | `.range()` 페이징 |
| HOT 백빙 완전 SQL화 | RPC/뷰 ([`CLIENT_QUERY_AUDIT.md`](CLIENT_QUERY_AUDIT.md)) |
| 부하 테스트 | k6/Artillery — 동시 투표·피드 시나리오 |
| Grafana 알림 | Supabase Metrics API |

---

## 8. 관련 문서

- [`DEPLOYMENT_ENV.md`](DEPLOYMENT_ENV.md) — env·OAuth·단일 Supabase 프로젝트
- [`MATCHUP_VOTE_PERF.md`](MATCHUP_VOTE_PERF.md) — 투표 응답·FCM `waitUntil`
- [`MATCHUP_FEED_MEDIA_PERF.md`](MATCHUP_FEED_MEDIA_PERF.md) — 피드·미디어·댓글 페이징
- [`BUNDLE_OPTIMIZATION.md`](BUNDLE_OPTIMIZATION.md) — 프론트 번들·lazy 라우트
- [`ADMIN_QUERY_EFFICIENCY.md`](ADMIN_QUERY_EFFICIENCY.md) — 관리자 쿼리
