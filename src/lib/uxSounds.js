/**
 * 주요 페이지·버튼용 Web Audio 효과음 (외부 파일 없음).
 * 브라우저 자동재생이 막히면 첫 터치/키 입력에서 이어서 재생한다.
 */
import { useEffect } from 'react'

/** @type {AudioContext | null} */
let sharedCtx = null
let unlockBound = false
/** @type {Set<string>} */
const playedThisSession = new Set()
/** @type {Array<() => void>} */
const pendingPlays = []

function getSharedContext() {
  if (typeof window === 'undefined') return null
  if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    sharedCtx = AC ? new AC() : null
    return sharedCtx
  } catch {
    sharedCtx = null
    return null
  }
}

function flushPending() {
  if (!pendingPlays.length) return
  const jobs = pendingPlays.splice(0, pendingPlays.length)
  for (const job of jobs) job()
}

function ensureUnlockListeners() {
  if (unlockBound || typeof window === 'undefined') return
  unlockBound = true
  const unlock = () => {
    const ctx = getSharedContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => flushPending()).catch(() => {})
      return
    }
    flushPending()
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(ev, unlock, { capture: true, passive: true })
  }
}

function whenAudioReady(play) {
  const ctx = getSharedContext()
  if (!ctx) return
  ensureUnlockListeners()
  if (ctx.state === 'suspended') {
    pendingPlays.push(play)
    void ctx.resume().then(() => flushPending()).catch(() => {})
    return
  }
  play()
}

function envGain(ctx, peak, t0, attack, hold, release) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  g.gain.setValueAtTime(peak, t0 + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
  return g
}

function tone(ctx, dest, { type = 'sine', freq, endFreq, t0, dur, peak, attack = 0.03, release }) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur)
  const rel = release ?? Math.max(0.08, dur - attack)
  const g = envGain(ctx, peak, t0, attack, Math.max(0, dur - attack - rel), rel)
  osc.connect(g)
  g.connect(dest)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noiseBurst(ctx, dest, { t0, dur, peak, hp = 600, lp = 4200 }) {
  const len = Math.ceil(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < ch.length; i++) {
    const u = i / (ch.length - 1 || 1)
    ch[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * u)
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const hip = ctx.createBiquadFilter()
  hip.type = 'highpass'
  hip.frequency.setValueAtTime(hp, t0)
  hip.frequency.exponentialRampToValueAtTime(hp * 3.2, t0 + dur)
  const lop = ctx.createBiquadFilter()
  lop.type = 'lowpass'
  lop.frequency.setValueAtTime(lp, t0)
  lop.frequency.exponentialRampToValueAtTime(lp * 1.6, t0 + dur * 0.55)
  const g = envGain(ctx, peak, t0, 0.04, dur * 0.22, dur * 0.72)
  src.connect(hip)
  hip.connect(lop)
  lop.connect(g)
  g.connect(dest)
  src.start(t0)
  src.stop(t0 + dur)
}

function kick(ctx, dest, t0) {
  tone(ctx, dest, {
    type: 'sine',
    freq: 168,
    endFreq: 48,
    t0,
    dur: 0.22,
    peak: 0.22,
    attack: 0.006,
    release: 0.16,
  })
}

function clap(ctx, dest, t0) {
  noiseBurst(ctx, dest, { t0, dur: 0.14, peak: 0.11, hp: 1400, lp: 6500 })
}

/** 메인 진입 — 킥·박수·튀는 훅 (~3.8초, 활기찬 로고 스팅) */
function playMainWelcome(ctx) {
  const t0 = ctx.currentTime
  const beat = 60 / 128
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.4, t0 + 0.04)
  master.gain.setValueAtTime(0.4, t0 + 3.05)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.85)
  master.connect(ctx.destination)

  noiseBurst(ctx, master, { t0, dur: 0.28, peak: 0.08, hp: 700, lp: 5200 })

  // 128bpm 킥 + 박수 (2마디)
  for (const i of [0, 2, 4, 6]) kick(ctx, master, t0 + i * beat)
  for (const i of [1, 3, 5, 7]) clap(ctx, master, t0 + i * beat)

  // 짧은 베이스 바운스
  const bass = [98, 98, 130.81, 98, 146.83, 130.81, 98, 87.31]
  bass.forEach((freq, i) => {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: t0 + i * beat,
      dur: beat * 0.78,
      peak: 0.075,
      attack: 0.01,
      release: beat * 0.45,
    })
  })

  // 튀는 메이저 훅 — C5 E5 G5 C6 / E5 G5 C6 E6 + 마지막 팡
  const hook = [
    523.25, 659.25, 783.99, 1046.5,
    659.25, 783.99, 1046.5, 1318.51,
  ]
  hook.forEach((freq, i) => {
    const at = t0 + i * (beat / 2)
    tone(ctx, master, {
      type: 'square',
      freq,
      t0: at,
      dur: beat * 0.42,
      peak: 0.036,
      attack: 0.008,
      release: beat * 0.28,
    })
    tone(ctx, master, {
      type: 'sine',
      freq: freq * 2,
      t0: at,
      dur: beat * 0.32,
      peak: 0.03,
      attack: 0.006,
      release: beat * 0.22,
    })
  })

  // 피날레 코드 히트 (C · E · G · C)
  const finale = t0 + 8 * (beat / 2) + 0.04
  for (const freq of [261.63, 329.63, 392, 523.25, 783.99]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: finale,
      dur: 1.15,
      peak: freq > 500 ? 0.05 : 0.07,
      attack: 0.012,
      release: 0.85,
    })
  }
  clap(ctx, master, finale)
  kick(ctx, master, finale)
  tone(ctx, master, {
    type: 'sine',
    freq: 1567.98,
    t0: finale + 0.08,
    dur: 0.45,
    peak: 0.04,
    attack: 0.008,
    release: 0.35,
  })
}

/** 베스트 피드 진입 — 불꽃 누가쉬 + 챔피언 팡파르 (~4.0초) */
function playBestEnter(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.42, t0 + 0.05)
  master.gain.setValueAtTime(0.42, t0 + 3.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 타오르는 누가쉬
  noiseBurst(ctx, master, { t0, dur: 0.42, peak: 0.1, hp: 520, lp: 4800 })
  noiseBurst(ctx, master, { t0: t0 + 0.18, dur: 0.32, peak: 0.07, hp: 1600, lp: 7200 })

  kick(ctx, master, t0)
  clap(ctx, master, t0 + 0.22)
  kick(ctx, master, t0 + 0.44)
  clap(ctx, master, t0 + 0.66)

  // 골드 팡파르 — D 메이저 상승
  const fanfare = [
    { at: 0.08, freq: 293.66, peak: 0.07, dur: 0.36 },
    { at: 0.3, freq: 369.99, peak: 0.068, dur: 0.32 },
    { at: 0.5, freq: 440, peak: 0.07, dur: 0.34 },
    { at: 0.72, freq: 587.33, peak: 0.074, dur: 0.42 },
    { at: 1.05, freq: 739.99, peak: 0.068, dur: 0.4 },
    { at: 1.38, freq: 880, peak: 0.06, dur: 0.48 },
  ]
  for (const n of fanfare) {
    tone(ctx, master, {
      type: 'sawtooth',
      freq: n.freq,
      t0: t0 + n.at,
      dur: n.dur,
      peak: n.peak * 0.42,
      attack: 0.012,
      release: n.dur * 0.55,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq,
      t0: t0 + n.at,
      dur: n.dur + 0.08,
      peak: n.peak,
      attack: 0.01,
      release: n.dur * 0.62,
    })
  }

  // 중반 히트 — 불꽃 한 번 더
  noiseBurst(ctx, master, { t0: t0 + 1.85, dur: 0.22, peak: 0.08, hp: 900, lp: 5600 })
  kick(ctx, master, t0 + 1.85)
  clap(ctx, master, t0 + 2.02)

  // 우승 코드 (D · F# · A · D)
  const win = t0 + 2.28
  for (const freq of [146.83, 185, 220, 293.66, 369.99, 440, 587.33]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: win,
      dur: 1.55,
      peak: freq < 200 ? 0.08 : 0.048,
      attack: 0.02,
      release: 1.15,
    })
  }
  kick(ctx, master, win)
  clap(ctx, master, win)
  clap(ctx, master, win + 0.12)
  tone(ctx, master, {
    type: 'sine',
    freq: 1174.66,
    t0: win + 0.1,
    dur: 0.55,
    peak: 0.045,
    attack: 0.008,
    release: 0.42,
  })
  tone(ctx, master, {
    type: 'sine',
    freq: 1760,
    t0: win + 0.28,
    dur: 0.42,
    peak: 0.032,
    attack: 0.008,
    release: 0.32,
  })
}

/** 추천 피드 진입 — 반짝 글리터 + 픽 아르페지오 (~4.0초) */
function playHotEnter(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.38, t0 + 0.05)
  master.gain.setValueAtTime(0.38, t0 + 3.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 반짝 가루가 흩어지는 누가쉬
  noiseBurst(ctx, master, { t0, dur: 0.36, peak: 0.07, hp: 1800, lp: 8200 })
  noiseBurst(ctx, master, { t0: t0 + 0.22, dur: 0.24, peak: 0.05, hp: 2400, lp: 9000 })

  clap(ctx, master, t0 + 0.08)
  kick(ctx, master, t0 + 0.28)
  clap(ctx, master, t0 + 0.52)

  // F# 라이디안 스파클 — 추천·픽 느낌
  const twinkles = [
    { at: 0.12, freq: 739.99 },
    { at: 0.28, freq: 880 },
    { at: 0.44, freq: 1108.73 },
    { at: 0.6, freq: 1318.51 },
    { at: 0.78, freq: 1479.98 },
    { at: 0.98, freq: 1760 },
    { at: 1.2, freq: 2217.46 },
    { at: 1.48, freq: 2637.02 },
  ]
  for (const n of twinkles) {
    tone(ctx, master, {
      type: 'sine',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.32,
      peak: 0.048,
      attack: 0.006,
      release: 0.24,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq * 2,
      t0: t0 + n.at + 0.05,
      dur: 0.18,
      peak: 0.018,
      attack: 0.005,
      release: 0.14,
    })
  }

  // 중반 튕기는 훅
  const hook = [369.99, 466.16, 554.37, 739.99, 880, 1108.73]
  hook.forEach((freq, i) => {
    tone(ctx, master, {
      type: 'square',
      freq,
      t0: t0 + 1.55 + i * 0.12,
      dur: 0.2,
      peak: 0.028,
      attack: 0.008,
      release: 0.14,
    })
  })

  // 픽 확정 코드 (F# · A# · C# · F#)
  const pick = t0 + 2.35
  noiseBurst(ctx, master, { t0: pick, dur: 0.2, peak: 0.06, hp: 2000, lp: 7800 })
  kick(ctx, master, pick)
  clap(ctx, master, pick + 0.06)
  for (const freq of [185, 233.08, 277.18, 369.99, 466.16, 554.37, 739.99]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: pick,
      dur: 1.45,
      peak: freq < 250 ? 0.07 : 0.042,
      attack: 0.018,
      release: 1.05,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1479.98,
    t0: pick + 0.12,
    dur: 0.5,
    peak: 0.04,
    attack: 0.008,
    release: 0.38,
  })
  tone(ctx, master, {
    type: 'sine',
    freq: 2217.46,
    t0: pick + 0.3,
    dur: 0.38,
    peak: 0.026,
    attack: 0.008,
    release: 0.28,
  })
}

/** 신규 피드 진입 — 도전장 호출 + 검 스파크 (~4.0초) */
function playNewEnter(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.4, t0 + 0.05)
  master.gain.setValueAtTime(0.4, t0 + 3.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 도전장 펼치는 누가쉬 + 스파크
  noiseBurst(ctx, master, { t0, dur: 0.3, peak: 0.085, hp: 700, lp: 4200 })
  noiseBurst(ctx, master, { t0: t0 + 0.16, dur: 0.14, peak: 0.07, hp: 2800, lp: 9800 })

  kick(ctx, master, t0)
  clap(ctx, master, t0 + 0.18)
  kick(ctx, master, t0 + 0.4)

  // 호출 훅 — E 마이너 상승 (덤벼 봐)
  const call = [
    { at: 0.12, freq: 164.81, peak: 0.07, dur: 0.28 },
    { at: 0.32, freq: 196, peak: 0.068, dur: 0.26 },
    { at: 0.52, freq: 246.94, peak: 0.07, dur: 0.28 },
    { at: 0.74, freq: 329.63, peak: 0.074, dur: 0.34 },
    { at: 1.02, freq: 392, peak: 0.07, dur: 0.32 },
    { at: 1.28, freq: 493.88, peak: 0.066, dur: 0.38 },
  ]
  for (const n of call) {
    tone(ctx, master, {
      type: 'sawtooth',
      freq: n.freq,
      t0: t0 + n.at,
      dur: n.dur,
      peak: n.peak * 0.38,
      attack: 0.01,
      release: n.dur * 0.5,
    })
    tone(ctx, master, {
      type: 'square',
      freq: n.freq,
      t0: t0 + n.at,
      dur: n.dur * 0.72,
      peak: n.peak * 0.55,
      attack: 0.008,
      release: n.dur * 0.45,
    })
  }

  // 검이 부딪히는 스파크 두 번
  const clash = t0 + 1.72
  noiseBurst(ctx, master, { t0: clash, dur: 0.12, peak: 0.1, hp: 3200, lp: 11000 })
  clap(ctx, master, clash)
  tone(ctx, master, {
    type: 'sine',
    freq: 2100,
    endFreq: 740,
    t0: clash,
    dur: 0.16,
    peak: 0.055,
    attack: 0.004,
    release: 0.12,
  })
  noiseBurst(ctx, master, { t0: clash + 0.2, dur: 0.12, peak: 0.09, hp: 2600, lp: 9800 })
  clap(ctx, master, clash + 0.2)

  // 모집 확정 — E 마이너 파워코드 + 하이 스파크
  const join = t0 + 2.28
  kick(ctx, master, join)
  clap(ctx, master, join)
  clap(ctx, master, join + 0.14)
  for (const freq of [82.41, 123.47, 164.81, 246.94, 329.63, 493.88]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: join,
      dur: 1.5,
      peak: freq < 140 ? 0.085 : 0.045,
      attack: 0.016,
      release: 1.1,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1318.51,
    t0: join + 0.1,
    dur: 0.48,
    peak: 0.042,
    attack: 0.008,
    release: 0.36,
  })
  tone(ctx, master, {
    type: 'sine',
    freq: 1975.53,
    t0: join + 0.28,
    dur: 0.36,
    peak: 0.028,
    attack: 0.008,
    release: 0.26,
  })
}

/** 빅스사용법(랜딩) 진입 — 문이 열리는 누가쉬 + 가이드 차임 (~4.0초) */
function playLandingEnter(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.36, t0 + 0.08)
  master.gain.setValueAtTime(0.36, t0 + 3.2)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 공간이 열리는 누가쉬
  noiseBurst(ctx, master, { t0, dur: 0.48, peak: 0.07, hp: 380, lp: 3600 })
  noiseBurst(ctx, master, { t0: t0 + 0.2, dur: 0.28, peak: 0.045, hp: 1400, lp: 6400 })

  kick(ctx, master, t0 + 0.06)
  clap(ctx, master, t0 + 0.34)

  // 안내 차임 — A 메이저로 한 걸음씩 (사용법 스텝)
  const steps = [
    { at: 0.22, freq: 440 },
    { at: 0.48, freq: 554.37 },
    { at: 0.74, freq: 659.25 },
    { at: 1.02, freq: 880 },
    { at: 1.32, freq: 1108.73 },
    { at: 1.64, freq: 1318.51 },
  ]
  for (const n of steps) {
    tone(ctx, master, {
      type: 'sine',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.42,
      peak: 0.055,
      attack: 0.012,
      release: 0.3,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq / 2,
      t0: t0 + n.at,
      dur: 0.5,
      peak: 0.03,
      attack: 0.02,
      release: 0.36,
    })
  }

  // 부드러운 안내 패드
  for (const freq of [110, 164.81, 220, 277.18]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: t0 + 0.35,
      dur: 3.2,
      peak: freq < 140 ? 0.05 : 0.028,
      attack: 0.35,
      release: 1.2,
    })
  }

  // 시작해볼까요 — A 메이저 오프닝 코드
  const start = t0 + 2.25
  clap(ctx, master, start)
  kick(ctx, master, start)
  for (const freq of [220, 277.18, 329.63, 440, 554.37, 880]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: start,
      dur: 1.55,
      peak: freq < 300 ? 0.065 : 0.04,
      attack: 0.02,
      release: 1.15,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1760,
    t0: start + 0.14,
    dur: 0.5,
    peak: 0.032,
    attack: 0.01,
    release: 0.38,
  })
}

/** 랭킹 페이지 진입 — 스코어보드 틱 + 포디엄 상승 (~4.0초) */
function playRankingEnter(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.4, t0 + 0.05)
  master.gain.setValueAtTime(0.4, t0 + 3.2)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  noiseBurst(ctx, master, { t0, dur: 0.28, peak: 0.07, hp: 600, lp: 3800 })
  kick(ctx, master, t0)

  // 순위가 올라가는 틱 (3 → 2 → 1)
  const ticks = [0.16, 0.38, 0.6, 0.82, 1.04, 1.26]
  ticks.forEach((at, i) => {
    const freq = 620 + i * 95
    tone(ctx, master, {
      type: 'square',
      freq,
      t0: t0 + at,
      dur: 0.07,
      peak: 0.034,
      attack: 0.004,
      release: 0.05,
    })
    clap(ctx, master, t0 + at)
  })

  // 포디엄 스텝 — G → B → D → G
  const podium = [
    { at: 0.2, freq: 196 },
    { at: 0.62, freq: 246.94 },
    { at: 1.04, freq: 293.66 },
    { at: 1.48, freq: 392 },
  ]
  for (const n of podium) {
    tone(ctx, master, {
      type: 'sawtooth',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.36,
      peak: 0.028,
      attack: 0.01,
      release: 0.22,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.42,
      peak: 0.062,
      attack: 0.012,
      release: 0.28,
    })
    kick(ctx, master, t0 + n.at)
  }

  // 1위 공개
  const first = t0 + 2.15
  noiseBurst(ctx, master, { t0: first, dur: 0.22, peak: 0.08, hp: 900, lp: 5400 })
  kick(ctx, master, first)
  clap(ctx, master, first)
  clap(ctx, master, first + 0.1)
  for (const freq of [98, 146.83, 196, 246.94, 293.66, 392, 493.88]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: first,
      dur: 1.6,
      peak: freq < 160 ? 0.08 : 0.046,
      attack: 0.018,
      release: 1.15,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1567.98,
    t0: first + 0.12,
    dur: 0.5,
    peak: 0.04,
    attack: 0.008,
    release: 0.38,
  })
  tone(ctx, master, {
    type: 'sine',
    freq: 2349.32,
    t0: first + 0.3,
    dur: 0.36,
    peak: 0.026,
    attack: 0.008,
    release: 0.26,
  })
}

/** 마이페이지 진입 — 사물함 오픈 + 홈 베이스 차임 (~4.0초) */
function playMyPageEnter(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.36, t0 + 0.06)
  master.gain.setValueAtTime(0.36, t0 + 3.2)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 문이 열리는 클릭 + 누가쉬
  noiseBurst(ctx, master, { t0, dur: 0.12, peak: 0.06, hp: 2200, lp: 7600 })
  noiseBurst(ctx, master, { t0: t0 + 0.1, dur: 0.32, peak: 0.055, hp: 500, lp: 3400 })
  kick(ctx, master, t0 + 0.08)
  clap(ctx, master, t0 + 0.26)

  // 내 공간 멜로디 — F 메이저 (따뜻하고 활기)
  const home = [
    { at: 0.22, freq: 349.23 },
    { at: 0.46, freq: 440 },
    { at: 0.7, freq: 523.25 },
    { at: 0.96, freq: 587.33 },
    { at: 1.24, freq: 698.46 },
    { at: 1.56, freq: 880 },
  ]
  for (const n of home) {
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.4,
      peak: 0.058,
      attack: 0.012,
      release: 0.28,
    })
    tone(ctx, master, {
      type: 'sine',
      freq: n.freq * 2,
      t0: t0 + n.at + 0.04,
      dur: 0.22,
      peak: 0.022,
      attack: 0.008,
      release: 0.16,
    })
  }

  // 부드러운 베이스 홈
  for (const freq of [87.31, 130.81, 174.61]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: t0 + 0.28,
      dur: 3.1,
      peak: freq < 100 ? 0.06 : 0.032,
      attack: 0.28,
      release: 1.15,
    })
  }

  // 도착 — F 메이저 홈 코드
  const arrive = t0 + 2.22
  kick(ctx, master, arrive)
  clap(ctx, master, arrive)
  clap(ctx, master, arrive + 0.12)
  for (const freq of [174.61, 220, 261.63, 349.23, 440, 523.25]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: arrive,
      dur: 1.55,
      peak: freq < 240 ? 0.068 : 0.04,
      attack: 0.02,
      release: 1.15,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1396.91,
    t0: arrive + 0.14,
    dur: 0.48,
    peak: 0.034,
    attack: 0.01,
    release: 0.36,
  })
}

/** 투표 확인 모달 — 도장 + 선택 확정 차임 (~4.0초) */
function playVoteConfirm(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.4, t0 + 0.04)
  master.gain.setValueAtTime(0.4, t0 + 3.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 투표용지 + 도장
  noiseBurst(ctx, master, { t0, dur: 0.16, peak: 0.07, hp: 900, lp: 3800 })
  kick(ctx, master, t0 + 0.08)
  noiseBurst(ctx, master, { t0: t0 + 0.1, dur: 0.14, peak: 0.09, hp: 400, lp: 1800 })
  clap(ctx, master, t0 + 0.22)

  // A vs B가 한쪽으로 기울어지는 훅
  const decide = [
    { at: 0.28, freq: 196 },
    { at: 0.5, freq: 246.94 },
    { at: 0.72, freq: 329.63 },
    { at: 0.96, freq: 392 },
    { at: 1.22, freq: 523.25 },
  ]
  for (const n of decide) {
    tone(ctx, master, {
      type: 'square',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.22,
      peak: 0.032,
      attack: 0.008,
      release: 0.15,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.3,
      peak: 0.055,
      attack: 0.01,
      release: 0.2,
    })
  }

  // 체크 스파클
  tone(ctx, master, {
    type: 'sine',
    freq: 1174.66,
    t0: t0 + 1.48,
    dur: 0.28,
    peak: 0.045,
    attack: 0.006,
    release: 0.2,
  })
  tone(ctx, master, {
    type: 'sine',
    freq: 1567.98,
    t0: t0 + 1.66,
    dur: 0.32,
    peak: 0.038,
    attack: 0.006,
    release: 0.24,
  })
  clap(ctx, master, t0 + 1.52)

  // 확정 코드 — 선택이 기록됨
  const lock = t0 + 2.15
  kick(ctx, master, lock)
  clap(ctx, master, lock)
  clap(ctx, master, lock + 0.12)
  for (const freq of [130.81, 196, 261.63, 329.63, 392, 523.25]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: lock,
      dur: 1.6,
      peak: freq < 180 ? 0.075 : 0.044,
      attack: 0.016,
      release: 1.15,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 2093,
    t0: lock + 0.16,
    dur: 0.45,
    peak: 0.03,
    attack: 0.008,
    release: 0.34,
  })
}

/** NEW 매치업 생성 완료 토스트 — 게시 팡 + 모집 시작 (~4.0초) */
function playMatchupCreated(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.4, t0 + 0.04)
  master.gain.setValueAtTime(0.4, t0 + 3.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 올라가는 누가쉬 + 게시 스탬프
  noiseBurst(ctx, master, { t0, dur: 0.28, peak: 0.08, hp: 700, lp: 5200 })
  kick(ctx, master, t0)
  clap(ctx, master, t0 + 0.12)

  // 생생한 런치 훅 — C 메이저 상승
  const launch = [
    { at: 0.18, freq: 261.63 },
    { at: 0.36, freq: 329.63 },
    { at: 0.54, freq: 392 },
    { at: 0.74, freq: 523.25 },
    { at: 0.96, freq: 659.25 },
    { at: 1.2, freq: 783.99 },
  ]
  for (const n of launch) {
    tone(ctx, master, {
      type: 'square',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.22,
      peak: 0.03,
      attack: 0.008,
      release: 0.15,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.3,
      peak: 0.055,
      attack: 0.01,
      release: 0.2,
    })
  }

  // 콘페티 스파클
  clap(ctx, master, t0 + 1.42)
  tone(ctx, master, {
    type: 'sine',
    freq: 1318.51,
    t0: t0 + 1.4,
    dur: 0.28,
    peak: 0.04,
    attack: 0.006,
    release: 0.2,
  })
  tone(ctx, master, {
    type: 'sine',
    freq: 1760,
    t0: t0 + 1.58,
    dur: 0.26,
    peak: 0.032,
    attack: 0.006,
    release: 0.18,
  })

  // 모집 시작 코드
  const live = t0 + 2.12
  kick(ctx, master, live)
  clap(ctx, master, live)
  clap(ctx, master, live + 0.14)
  noiseBurst(ctx, master, { t0: live, dur: 0.2, peak: 0.06, hp: 1200, lp: 6400 })
  for (const freq of [130.81, 196, 261.63, 329.63, 392, 523.25, 659.25]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: live,
      dur: 1.65,
      peak: freq < 180 ? 0.075 : 0.042,
      attack: 0.016,
      release: 1.2,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 2093,
    t0: live + 0.16,
    dur: 0.48,
    peak: 0.032,
    attack: 0.008,
    release: 0.36,
  })
}

/** 도전장 완료 모달 — 검 스파크 + 대결 시작 팡 (~4.0초) */
function playChallengeComplete(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.42, t0 + 0.04)
  master.gain.setValueAtTime(0.42, t0 + 3.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  // 검이 맞부딪히는 오프닝
  noiseBurst(ctx, master, { t0, dur: 0.14, peak: 0.1, hp: 2800, lp: 11000 })
  kick(ctx, master, t0)
  clap(ctx, master, t0 + 0.08)
  noiseBurst(ctx, master, { t0: t0 + 0.16, dur: 0.12, peak: 0.08, hp: 2200, lp: 9000 })
  tone(ctx, master, {
    type: 'sine',
    freq: 2400,
    endFreq: 720,
    t0: t0 + 0.02,
    dur: 0.18,
    peak: 0.05,
    attack: 0.004,
    release: 0.12,
  })

  // 대결 호출 — E 마이너에서 G 메이저로 뒤집힘
  const rise = [
    { at: 0.28, freq: 164.81 },
    { at: 0.48, freq: 196 },
    { at: 0.68, freq: 246.94 },
    { at: 0.9, freq: 329.63 },
    { at: 1.14, freq: 392 },
    { at: 1.4, freq: 493.88 },
  ]
  for (const n of rise) {
    tone(ctx, master, {
      type: 'sawtooth',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.28,
      peak: 0.026,
      attack: 0.01,
      release: 0.18,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.34,
      peak: 0.058,
      attack: 0.01,
      release: 0.22,
    })
  }

  clap(ctx, master, t0 + 1.62)
  tone(ctx, master, {
    type: 'sine',
    freq: 1567.98,
    t0: t0 + 1.6,
    dur: 0.3,
    peak: 0.04,
    attack: 0.006,
    release: 0.22,
  })

  // 경쟁 시작 — G 메이저 히트
  const start = t0 + 2.12
  kick(ctx, master, start)
  clap(ctx, master, start)
  clap(ctx, master, start + 0.12)
  noiseBurst(ctx, master, { t0: start, dur: 0.2, peak: 0.07, hp: 900, lp: 5200 })
  for (const freq of [98, 146.83, 196, 246.94, 293.66, 392, 493.88]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: start,
      dur: 1.65,
      peak: freq < 160 ? 0.08 : 0.046,
      attack: 0.016,
      release: 1.2,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1567.98,
    t0: start + 0.14,
    dur: 0.5,
    peak: 0.038,
    attack: 0.008,
    release: 0.38,
  })
  tone(ctx, master, {
    type: 'sine',
    freq: 2349.32,
    t0: start + 0.32,
    dur: 0.36,
    peak: 0.026,
    attack: 0.008,
    release: 0.26,
  })
}

/** 로그인 성공 — 문 열림 + 웰컴 백 차임 (~4.0초) */
function playLoginSuccess(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.38, t0 + 0.05)
  master.gain.setValueAtTime(0.38, t0 + 3.2)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  noiseBurst(ctx, master, { t0, dur: 0.22, peak: 0.065, hp: 500, lp: 3200 })
  kick(ctx, master, t0)
  clap(ctx, master, t0 + 0.16)

  // 돌아온 거 환영해요 — A 메이저 스텝
  const welcome = [
    { at: 0.2, freq: 220 },
    { at: 0.42, freq: 277.18 },
    { at: 0.64, freq: 329.63 },
    { at: 0.88, freq: 440 },
    { at: 1.14, freq: 554.37 },
    { at: 1.42, freq: 659.25 },
  ]
  for (const n of welcome) {
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.38,
      peak: 0.056,
      attack: 0.012,
      release: 0.26,
    })
    tone(ctx, master, {
      type: 'sine',
      freq: n.freq * 2,
      t0: t0 + n.at + 0.04,
      dur: 0.22,
      peak: 0.02,
      attack: 0.008,
      release: 0.16,
    })
  }

  for (const freq of [110, 164.81, 220]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: t0 + 0.24,
      dur: 3.15,
      peak: freq < 130 ? 0.055 : 0.03,
      attack: 0.28,
      release: 1.15,
    })
  }

  const in_ = t0 + 2.2
  kick(ctx, master, in_)
  clap(ctx, master, in_)
  clap(ctx, master, in_ + 0.12)
  for (const freq of [220, 277.18, 329.63, 440, 554.37, 880]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: in_,
      dur: 1.55,
      peak: freq < 300 ? 0.065 : 0.04,
      attack: 0.02,
      release: 1.15,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1760,
    t0: in_ + 0.14,
    dur: 0.48,
    peak: 0.032,
    attack: 0.01,
    release: 0.36,
  })
}

/** 회원가입 완료 — 축하 콘페티 + 웰컴 기프트 (~4.0초) */
function playSignupComplete(ctx) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.4, t0 + 0.04)
  master.gain.setValueAtTime(0.4, t0 + 3.15)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.05)
  master.connect(ctx.destination)

  noiseBurst(ctx, master, { t0, dur: 0.26, peak: 0.08, hp: 900, lp: 6200 })
  kick(ctx, master, t0)
  clap(ctx, master, t0 + 0.1)
  clap(ctx, master, t0 + 0.22)

  const sparkle = [
    { at: 0.18, freq: 659.25 },
    { at: 0.34, freq: 783.99 },
    { at: 0.5, freq: 987.77 },
    { at: 0.68, freq: 1174.66 },
    { at: 0.88, freq: 1318.51 },
    { at: 1.1, freq: 1567.98 },
    { at: 1.34, freq: 1975.53 },
  ]
  for (const n of sparkle) {
    tone(ctx, master, {
      type: 'sine',
      freq: n.freq,
      t0: t0 + n.at,
      dur: 0.28,
      peak: 0.042,
      attack: 0.006,
      release: 0.2,
    })
    tone(ctx, master, {
      type: 'triangle',
      freq: n.freq / 2,
      t0: t0 + n.at,
      dur: 0.32,
      peak: 0.03,
      attack: 0.01,
      release: 0.22,
    })
  }

  clap(ctx, master, t0 + 1.55)
  tone(ctx, master, {
    type: 'sine',
    freq: 2093,
    t0: t0 + 1.52,
    dur: 0.3,
    peak: 0.036,
    attack: 0.006,
    release: 0.22,
  })

  const gift = t0 + 2.1
  kick(ctx, master, gift)
  clap(ctx, master, gift)
  clap(ctx, master, gift + 0.12)
  noiseBurst(ctx, master, { t0: gift, dur: 0.2, peak: 0.065, hp: 1400, lp: 7200 })
  for (const freq of [146.83, 185, 220, 293.66, 369.99, 440, 587.33]) {
    tone(ctx, master, {
      type: 'triangle',
      freq,
      t0: gift,
      dur: 1.65,
      peak: freq < 200 ? 0.07 : 0.044,
      attack: 0.018,
      release: 1.2,
    })
  }
  tone(ctx, master, {
    type: 'sine',
    freq: 1760,
    t0: gift + 0.14,
    dur: 0.5,
    peak: 0.034,
    attack: 0.008,
    release: 0.38,
  })
}

const PLAYERS = {
  mainWelcome: playMainWelcome,
  bestEnter: playBestEnter,
  hotEnter: playHotEnter,
  newEnter: playNewEnter,
  landingEnter: playLandingEnter,
  rankingEnter: playRankingEnter,
  myPageEnter: playMyPageEnter,
  voteConfirm: playVoteConfirm,
  matchupCreated: playMatchupCreated,
  challengeComplete: playChallengeComplete,
  loginSuccess: playLoginSuccess,
  signupComplete: playSignupComplete,
}

/** 가입 직후 SIGNED_IN이 로그인 환영음을 겹쳐 내지 않게 한다 */
let suppressLoginSuccessUntil = 0

export function markSignupJustCompleted() {
  suppressLoginSuccessUntil = Date.now() + 8000
}

/**
 * @param {keyof typeof PLAYERS} id
 * @param {{ oncePerSession?: boolean }} [opts]
 */
export function playUxSound(id, { oncePerSession = false } = {}) {
  const player = PLAYERS[id]
  if (!player) return
  if (id === 'loginSuccess' && Date.now() < suppressLoginSuccessUntil) return
  if (oncePerSession && playedThisSession.has(id)) return

  whenAudioReady(() => {
    if (oncePerSession && playedThisSession.has(id)) return
    const ctx = getSharedContext()
    if (!ctx || ctx.state === 'closed') return
    if (oncePerSession) playedThisSession.add(id)
    try {
      player(ctx)
    } catch (e) {
      playedThisSession.delete(id)
      console.warn('[uxSounds] play failed', e)
    }
  })
}

/** 페이지 마운트 시 한 번. 같은 탭에서 재진입해도 중복 재생하지 않는다. */
export function usePageEnterSound(soundId) {
  useEffect(() => {
    if (!soundId) return
    playUxSound(soundId, { oncePerSession: true })
  }, [soundId])
}
