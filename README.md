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

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
