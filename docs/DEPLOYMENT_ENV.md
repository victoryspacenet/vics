# 환경 변수: 로컬 vs Netlify

로컬에서 `npm run dev`가 되는데 배포 사이트만 로그인·가입·API가 실패할 때, **같은 이름의 변수가 배포 쪽에 없거나 다른 값**인 경우가 많습니다.

## 원칙

| 환경 | 설정 위치 | Git |
|------|------------|-----|
| **로컬 개발** (`npm run dev`) | 루트 **`.env.local`** (또는 `.env`) — `.env.example`을 복사해 생성. Supabase 비밀은 여기에만 둡니다. | **올리지 않음** (`.gitignore`) |
| **로컬 전용 기본값** | **`.env.development`** — 개발 모드에서만 로드. 비밀·키 값은 넣지 말고, 주석으로 안내하거나 비개발용 플래그만 둡니다. | 포함 |
| **프로덕션 번들** (`npm run build` / Netlify Build) | Netlify **Project configuration → Environment variables** 또는 로컬 `.env.production` (gitignore) | Netlify는 대시보드만 사용 권장 |

**같은 키, 같은 Supabase:** 로컬 `.env.local`에 넣은 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`와 **완히 동일한 이름**으로 Netlify에도 넣고, 값은 **가능하면 같은 프로젝트**로 맞춥니다. (이름만 같고 프로젝트가 다르면 “로컬에만 가입됨”처럼 보입니다.)

Vite 개발 모드 로드 순서: `.env` → `.env.development` → **`.env.local`** (뒤가 앞을 덮어씀).

Netlify 빌드 서버는 **저장소에 없는 `.env.local`을 읽지 않습니다.**  
그래서 Supabase URL·Anon 키는 **Netlify에도 반드시 등록**해야 배포본과 로컬이 같은 백엔드를 바라봅니다.

## Netlify에 넣을 변수 (이 프로젝트 기준)

클라이언트 번들(`import.meta.env.*`)에 박히는 것:

| 변수 | 설명 |
|------|------|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase **Settings → API Keys** 의 `anon` `public` (Legacy 탭 등) |
| `VITE_SITE_ORIGIN` | (권장) 프로덕션 사이트 절대 URL, 끝 슬래시 없음. Capacitor·`/api/*` 절대 호출·OAuth `redirectTo`에 사용 |
| `VITE_GA_MEASUREMENT_ID` | (선택) Google Analytics 4 측정 ID (`G-XXXXXXXXXX`). 미설정 시 GA 미로드 |
| `VITE_GA_ENABLE_DEV` | (선택) `1`이면 `npm run dev`에서도 GA 수집 (기본: 프로덕션만) |
| `VITE_HUBSPOT_PORTAL_ID` | (선택) HubSpot 포털 ID (추적 코드 URL의 숫자) |
| `VITE_HUBSPOT_ENABLE_DEV` | (선택) `1`이면 로컬 dev에서도 HubSpot 로드 |

Netlify Functions (`process.env.*`)에서 쓰는 것(예시):

| 변수 | 설명 |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용. 브라우저/프론트 번들에 넣지 말 것 |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 일부 함수가 anon으로 호출할 때 동일 이름 사용 |

`POST /api/profiles-bootstrap-signup`(가입 직후 `profiles` 보강)은 **`SUPABASE_SERVICE_ROLE_KEY`** 로 Auth 사용자와 이메일 일치를 검증한 뒤 `profiles`를 upsert 합니다. **반드시 anon 키를 `VITE_SUPABASE_ANON_KEY`에만** 두세요.

`POST /api/nickname-check`(닉네임 중복 여부)도 서비스 롤로 `profiles`를 조회합니다. 로컬에서 `npm run dev:netlify`로 열 때 가입 화면 중복 확인이 이 경로를 씁니다. **`npm run dev`(Vite만)일 때는** 이 API가 없으므로, Supabase에 `supabase_nickname_is_taken_rpc.sql`의 RPC를 적용하거나 `dev:netlify`로 확인하세요.

함수별로 `OPENAI_API_KEY`, `RESEND_API_KEY` 등이 필요하면 각 함수 문서·`netlify/functions` 주석을 참고하세요.

## 로컬에서 맞추는 절차

1. `cp .env.example .env.local` (Windows: `copy .env.example .env.local`)
2. `.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (필요 시 `VITE_SITE_ORIGIN` 등) 입력
3. Netlify 대시보드에 **아래 표와 동일한 변수명**으로 **같은 Supabase 프로젝트** 값 입력
4. Netlify에서 **Trigger deploy** (환경 변수 변경 후에는 재빌드가 필요)

### 로컬 `.env.local` ↔ Netlify (이름 일치 체크)

| 변수명 | 로컬 (`.env.local`) | Netlify (Environment variables) |
|--------|---------------------|-----------------------------------|
| `VITE_SUPABASE_URL` | 필수 | 필수 (로컬과 동일 프로젝트 권장) |
| `VITE_SUPABASE_ANON_KEY` | 필수 | 필수 |
| `VITE_SITE_ORIGIN` | 권장: `http://localhost:5173` | 권장: 프로덕션 절대 URL (끝 `/` 없음) |

기타 `VITE_*` / Functions용 `SUPABASE_*` 등은 README·각 함수 주석을 참고해 **이름을 바꾸지 말고** 양쪽에 맞춥니다.

## Google Analytics 4 (선택)

1. [Google Analytics](https://analytics.google.com/) → **관리(톱니)** → **데이터 스트림 만들기** → **웹**
2. URL: `https://www.victoryspace.net` (또는 Netlify 기본 도메인)
3. 생성된 **측정 ID** (`G-XXXXXXXXXX`) 복사
4. Netlify **Environment variables**에 `VITE_GA_MEASUREMENT_ID=G-…` 추가 후 **재배포**
5. GA **보고서 → 실시간**에서 사이트 접속·페이지 이동이 보이면 연동 완료

React SPA이므로 코드에서 라우트(`pathname`) 변경마다 `page_view`를 전송합니다. 로컬 테스트는 `.env.local`에 같은 변수를 넣고 `VITE_GA_ENABLE_DEV=1`을 추가하세요.

## HubSpot 추적 (선택)

HubSpot **설정 → 추적 코드**에 있는 스크립트는 사이트에 **직접 HTML 붙이지 않아도** 됩니다. 코드가 아래 env만 읽어 동일한 스크립트를 로드합니다.

1. 추적 코드 URL에서 포털 ID 확인: `https://js.hs-scripts.com/12345678.js` → **`12345678`**
2. Netlify: `VITE_HUBSPOT_PORTAL_ID=12345678` → 재배포
3. HubSpot **설정 → 추적 코드 → 설치 확인** 또는 **분석 → 트래픽**에서 방문 확인

로그인 사용자는 이메일로 `identify`되어 CRM 연락처와 매칭되기 쉽습니다.

---

## Supabase Auth (OAuth)

`npm run dev` 중에는 코드상 OAuth `redirectTo`가 **항상 현재 브라우저 origin**(localhost·LAN IP 등)을 쓰므로, `.env.local`에 `VITE_SITE_ORIGIN`이 운영 URL이어도 로그인 뒤 로컬 탭에 그대로 돌아오게 됩니다.

그래도 Supabase **Authentication → URL Configuration**의 **Redirect URLs**에 아래를 포함해야 합니다.

- 프로덕션: `VITE_SITE_ORIGIN`과 같은 출처(와 `/**` 패턴)
- 로컬: `http://localhost:5173/**` , `http://127.0.0.1:5173/**` (포트에 맞게), 휴대폰에서 `http://192.168.x.x:5173/**` 등 실제로 여는 주소

`redirectTo`가 허용 목록에 없으면 **Site URL**(예: 운영 도메인)로 돌아가며, 로컬에서 수정한 UI가 아닌 배포 사이트만 보이는 것처럼 느껴질 수 있습니다.

**Site URL**은 운영 배포 주소를 두는 경우가 많습니다. 로컬 전용이면 `http://localhost:5173`으로 둘 수도 있습니다.

## 참고

- [Netlify: Environment variables](https://docs.netlify.com/build/environment-variables/get-started/)
- `netlify.toml`의 `[context.*.environment]`에 같은 키를 넣으면 **대시보드 값을 덮어쓸 수 있으므로**, 비밀은 대시보드에만 두는 것을 권장합니다.

---

## 관리자 페이지 vs 회원가입 — 같은 DB·테이블인지 (코드 점검)

**결론:** 앱 전역에서 Supabase는 **`src/lib/supabase.js`의 단일 `createClient`** 하나만 쓰며, URL·Anon 키는 모두 **`import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`** 입니다. 관리자 화면이든 회원가입이든 **별도 하드코딩된 DB 주소는 없습니다.**

### 회원가입이 쌓는 곳

| 단계 | API / 테이블 |
|------|----------------|
| 이메일 가입 | `supabase.auth.signUp` → 프로젝트의 **Auth (`auth.users`)** |
| 닉네임 중복 확인 | `supabase.from('profiles').select(...)` |
| 세션이 있을 때 프로필 반영 | `supabase.from('profiles').upsert(...)` |
| 이메일 확인만 켜진 경우 | 클라이언트 upsert 전에 끝날 수 있으나, DB 트리거 **`handle_new_user`** 등으로 **`public.profiles`** 에 행이 생기는 구성이 일반적입니다. |

### 관리자(유저 목록)가 읽는 곳

| 기능 | 소스 |
|------|------|
| 유저 관리 센터 | `src/lib/userAdminStorage.js` → **`supabase.from('profiles').select(...)`** (페이징·정렬; 신고 수는 `reports_received_count` 컬럼) |
| 신고 수 컬럼·트리거 | SQL **`supabase_profiles_reports_received_count.sql`** 를 Supabase에서 실행 (`matchup_reports` INSERT/DELETE 시 자동 반영) |
| 신규 가입 수(대시보드) | 동일 파일의 **`countProfilesCreatedSince`** → **`profiles`** `created_at` 기준 count |
| 관리자 메모·상태 오버레이 | **`admin_ui_config`** 테이블(JSON blob) — 회원 본문과 별도 보조 데이터 |

### 주의할 때만 “다른 DB처럼” 보이는 경우

1. **로컬 `.env.local`의 Supabase와 Netlify 환경 변수의 Supabase가 서로 다른 프로젝트**일 때  
2. **`profiles`에 행이 확실히 0건일 때** — `userAdminStorage`는 **데모 mock 목록**으로 폴백합니다. (DB에 유저가 있는데 쿼리만 실패한 경우에는 mock으로 위장하지 않도록 코드가 보완되어 있습니다.)

운영에서 관리자와 가입이 같은 데이터를 보려면, **한 빌드·한 배포 URL**에 대해 **`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`가 가리키는 프로젝트가 하나**이면 됩니다.

관리자 화면 쿼리 효율·개선 이력: [`ADMIN_QUERY_EFFICIENCY.md`](ADMIN_QUERY_EFFICIENCY.md)

접속 급증·P1 운영 체크리스트(Supabase SQL, rate limit, 모니터링 위치): [`SCALE_OUT_OPERATIONS.md`](SCALE_OUT_OPERATIONS.md)
