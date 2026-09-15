/**
 * 관전봇 프로필 사진 50% 채우기.
 * 사용: node scripts/fill-bot-avatars.mjs
 * 키는 .env.local 또는 Netlify env 에서 읽습니다. 콘솔에 시크릿을 출력하지 않습니다.
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { ensureBotProfilePhotos } from '../netlify/lib/botProfilePhotos.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function applyDotEnv(fileName) {
  const file = path.join(root, fileName)
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] == null) process.env[key] = value
  }
}

function readNetlifyEnv(name) {
  const netlifyBin = process.platform === 'win32' ? 'netlify.cmd' : 'netlify'
  const r = spawnSync(netlifyBin, ['env:get', name], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) return ''
  const lines = String(r.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    lines.find((line) => line.startsWith('eyJ')) ||
    lines.find((line) => line.startsWith('sk-')) ||
    lines[lines.length - 1] ||
    ''
  )
}

applyDotEnv('.env')
applyDotEnv('.env.local')

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = readNetlifyEnv('SUPABASE_SERVICE_ROLE_KEY')
}
if (!process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = readNetlifyEnv('VITE_SUPABASE_URL')
}
const netlifyOpenAi = readNetlifyEnv('OPENAI_API_KEY')
if (netlifyOpenAi.startsWith('sk-')) process.env.OPENAI_API_KEY = netlifyOpenAi

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!supabaseUrl || !serviceKey) {
  console.error('[fill-bot-avatars] VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const maxArg = process.argv.find((a) => /^\d+$/.test(a))
const max = Math.max(1, Number(maxArg) || 60)
const replaceExisting = process.argv.includes('--replace')
const facesOnly = process.argv.includes('--faces')
const revertExtraFaces = process.argv.includes('--food-rest')
const started = Date.now()
const result = await ensureBotProfilePhotos(supabase, {
  max,
  started,
  budgetMs: 25 * 60 * 1000,
  replaceExisting,
  facesOnly,
  revertExtraFaces,
})
console.log('[fill-bot-avatars]', {
  bots: result.bots,
  withPhoto: result.withPhoto,
  target: result.target,
  faceTarget: result.faceTarget,
  queued: result.queued,
  attempted: result.attempted,
  uploaded: result.uploaded,
  faces: result.faces,
  errors: result.errors,
  ms: Date.now() - started,
})
if (result.withPhoto < result.target) process.exitCode = 2
