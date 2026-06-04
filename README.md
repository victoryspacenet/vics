# vics

React + Vite 기반 매치업 앱.

## 다른 기기에서 연동해서 작업하기

### 1. GitHub에 올리기 (노트북에서, 최초 1회)

1. [GitHub](https://github.com)에서 새 저장소 생성 (예: `vics`)
2. Git 사용자 정보 설정 (아직 안 했다면):
   ```bash
   git config --global user.name "본인이름"
   git config --global user.email "본인@email.com"
   ```
3. 원격 저장소 연결 후 푸시:
   ```bash
   git remote add origin https://github.com/본인아이디/vics.git
   git branch -M main
   git push -u origin main
   ```

### 2. 다른 기기에서 받아서 작업하기

1. 프로젝트 클론:
   ```bash
   git clone https://github.com/본인아이디/vics.git
   cd vics
   ```
2. 환경 변수 설정:
   - Windows: `copy .env.example .env.local`
   - Mac/Linux: `cp .env.example .env.local`
   - `.env.local`을 열어 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등을 입력하세요. (이 파일은 Git에 올라가지 않습니다.)
   - 배포(Netlify)는 `.env.local`을 사용하지 않습니다. **Netlify 대시보드에 같은 변수명으로** 넣어야 프로덕션과 동일한 DB에 붙습니다. 자세한 표는 [`docs/DEPLOYMENT_ENV.md`](docs/DEPLOYMENT_ENV.md)를 보세요.
3. 의존성 설치 및 실행:
   ```bash
   npm install
   npm run dev
   ```

#### 배포 없이 바로 확인할 때 (추천 흐름)

운영 URL은 **마지막으로 배포된 빌드**만 보여 주므로, 평소에는 로컬에서 먼저 확인하는 편이 답답함이 적습니다.

| 명령 | 접속 주소 | 언제 쓰면 좋은지 |
|------|-----------|------------------|
| `npm run dev` | http://localhost:5173 | UI·스타일·대부분 기능 — **가장 빠른** Hot Reload |
| `npm run dev:netlify` | http://localhost:8888 | Netlify Functions (`/api/*`)까지 로컬에서 써야 할 때 |
| `npm run build` 후 `npm run preview` | http://localhost:4173 (기본) | 프로덕션 빌드에 가까운 점검 |

`8888`이 안 열리거나 흰 화면만 나오면: 다른 터미널의 `npm run dev` / `dev:netlify`를 **하나만** 남기고 끄기 → `http://127.0.0.1:8888` 로 접속 시도 → 그래도 안 되면 PowerShell에서 `netstat -ano | findstr ":5173"` 으로 5173 점유 프로세스를 확인합니다.

### 3. 작업 후 동기화

- **노트북에서**: `git add -A` → `git commit -m "메시지"` → `git push`
- **다른 기기에서**: `git pull` 후 작업 → `git add -A` → `git commit -m "메시지"` → `git push`

---

## 웹에 배포하기 (Vercel / Netlify)

코드를 GitHub에 푸시한 뒤, 아래 중 하나로 배포하면 브라우저에서 앱을 열어볼 수 있습니다.

### Vercel (추천)

1. [vercel.com](https://vercel.com) 가입 후 **Add New → Project**
2. GitHub 저장소 `vics` 선택 → **Import**
3. **Environment Variables**에 추가:
   - `VITE_SUPABASE_URL` = Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase Anon Key
4. **Deploy** 클릭 → 완료 후 `https://vics-xxx.vercel.app` 주소로 접속

### Netlify

1. [netlify.com](https://netlify.com) 가입 후 **Add new site → Import an existing project**
2. GitHub 저장소 `vics` 선택
3. Build 설정은 자동 감지됨.
4. **Project configuration → Environment variables**(구 UI에서는 *Site settings → Environment variables* 등)에서 아래를 추가합니다. 로컬 `.env.local`과 **키 이름을 맞추고**, 가능하면 **같은 Supabase 프로젝트** 값을 씁니다.
   - `VITE_SUPABASE_URL` — `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — Supabase 대시보드 **Settings → API Keys** (Legacy `anon` 등)
   - (권장) `VITE_SITE_ORIGIN` — 프로덕션 사이트 URL, 끝 슬래시 없음 (`https://www.example.com`)
   - Functions에서 쓰는 경우: `SUPABASE_SERVICE_ROLE_KEY` 등 — [`docs/DEPLOYMENT_ENV.md`](docs/DEPLOYMENT_ENV.md) 참고
5. **Deploy site** → 완료 후 배포 URL로 접속

> 이후 `git push`할 때마다 자동으로 재배포됩니다.  
> 환경 변수를 바꾼 뒤에는 **한 번 더 배포**해야 번들·함수에 반영됩니다.

#### 로컬은 되는데 배포만 안 될 때

- Netlify에 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`가 비어 있거나 오타·다른 프로젝트인지 확인하세요.
- 자세한 매핑은 [`docs/DEPLOYMENT_ENV.md`](docs/DEPLOYMENT_ENV.md).
- 트래픽 급증·P1(SQL·rate limit·모니터링) 체크리스트: [`docs/SCALE_OUT_OPERATIONS.md`](docs/SCALE_OUT_OPERATIONS.md).

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
