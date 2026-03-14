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
   - `.env.local`을 열어 Supabase URL과 Anon Key를 입력하세요.
3. 의존성 설치 및 실행:
   ```bash
   npm install
   npm run dev
   ```

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
3. Build 설정은 자동 감지됨. **Environment variables**에 추가:
   - `VITE_SUPABASE_URL` = Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase Anon Key
4. **Deploy site** → 완료 후 `https://xxx.netlify.app` 주소로 접속

> 이후 `git push`할 때마다 자동으로 재배포됩니다.

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
