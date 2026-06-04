/**
 * 로컬 OPENAI_API_KEY를 Netlify(함수 런타임)에 등록합니다.
 * 키는 저장소에 넣지 말고 .env 또는 .env.local(둘 다 gitignore)에만 두세요.
 *
 * 사용:
 *   npm run netlify:push-openai
 *
 * 또는 환경 변수만:
 *   PowerShell: $env:OPENAI_API_KEY="sk-..."; npm run netlify:push-openai
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')

function readOpenAiFromDotEnv() {
  for (const name of ['.env', '.env.local']) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const m = trimmed.match(/^OPENAI_API_KEY\s*=\s*(.*)$/)
      if (!m) continue
      let v = m[1].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (v) return v
    }
  }
  return null
}

const key = process.env.OPENAI_API_KEY || readOpenAiFromDotEnv()
if (!key) {
  console.error(
    '[netlify-push-openai] OPENAI_API_KEY 가 없습니다.\n' +
      '  - 프로젝트 루트에 .env 또는 .env.local 파일을 만들고 OPENAI_API_KEY=sk-... 를 넣거나,\n' +
      '  - PowerShell: $env:OPENAI_API_KEY="sk-..."; npm run netlify:push-openai',
  )
  process.exit(1)
}

const args = [
  'env:set',
  'OPENAI_API_KEY',
  key,
  '--context',
  'production',
  '--context',
  'deploy-preview',
  '--scope',
  'functions',
  '--secret',
  '--force',
]

const netlifyBin = process.platform === 'win32' ? 'netlify.cmd' : 'netlify'
const r = spawnSync(netlifyBin, args, { stdio: 'inherit', cwd: root, shell: false })
if (r.error) {
  console.error('[netlify-push-openai]', r.error.message)
  process.exit(1)
}
if (r.status !== 0) process.exit(r.status ?? 1)
console.log('[netlify-push-openai] Netlify production / deploy-preview 함수 스코프에 등록했어요.')
