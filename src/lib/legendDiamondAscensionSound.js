/**
 * 다이아몬드 전설 연출용 Web Audio (외부 파일 없음)
 */

function getCtx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    return AC ? new AC() : null
  } catch {
    return null
  }
}

function scheduleClose(ctx, ms) {
  window.setTimeout(() => {
    try {
      void ctx.close()
    } catch {
      /* ignore */
    }
  }, ms)
}

/** Step 1: 저음 웅성 + 느린 펄스(심장 박동 느낌) */
export function playLegendSilencePhase() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.55
  master.connect(ctx.destination)

  const rumble = ctx.createOscillator()
  rumble.type = 'sine'
  rumble.frequency.setValueAtTime(58, t0)
  rumble.frequency.exponentialRampToValueAtTime(42, t0 + 2.4)
  const gR = ctx.createGain()
  gR.gain.setValueAtTime(0.0001, t0)
  gR.gain.exponentialRampToValueAtTime(0.14, t0 + 0.35)
  gR.gain.exponentialRampToValueAtTime(0.1, t0 + 2.2)
  gR.gain.linearRampToValueAtTime(0.0001, t0 + 2.65)
  rumble.connect(gR)
  gR.connect(master)
  rumble.start(t0)
  rumble.stop(t0 + 2.7)

  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(1.15, t0)
  const lfoG = ctx.createGain()
  lfoG.gain.value = 18
  lfo.connect(lfoG)
  lfoG.connect(rumble.detune)
  lfo.start(t0)
  lfo.stop(t0 + 2.7)

  const pad = ctx.createOscillator()
  pad.type = 'triangle'
  pad.frequency.setValueAtTime(110, t0)
  pad.frequency.linearRampToValueAtTime(180, t0 + 2.5)
  const gP = ctx.createGain()
  gP.gain.setValueAtTime(0.0001, t0)
  gP.gain.exponentialRampToValueAtTime(0.045, t0 + 0.8)
  gP.gain.linearRampToValueAtTime(0.0001, t0 + 2.6)
  pad.connect(gP)
  gP.connect(master)
  pad.start(t0)
  pad.stop(t0 + 2.7)

  scheduleClose(ctx, 3200)
}

/** Step 2: 짧은 오케스트럴 타격(노이즈 + 저역) */
export function playLegendBreakthroughPhase() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.72
  master.connect(ctx.destination)

  const len = Math.ceil(ctx.sampleRate * 0.55)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < ch.length; i++) {
    const u = i / (ch.length - 1 || 1)
    ch[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.exp(-u * 5))
  }
  const hit = ctx.createBufferSource()
  hit.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(2200, t0)
  bp.Q.setValueAtTime(0.4, t0)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.18)
  g.gain.linearRampToValueAtTime(0.0001, t0 + 0.5)
  hit.connect(bp)
  bp.connect(g)
  g.connect(master)
  hit.start(t0)
  hit.stop(t0 + 0.52)

  const boom = ctx.createOscillator()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(95, t0)
  boom.frequency.exponentialRampToValueAtTime(38, t0 + 0.35)
  const gB = ctx.createGain()
  gB.gain.setValueAtTime(0.0001, t0)
  gB.gain.exponentialRampToValueAtTime(0.22, t0 + 0.04)
  gB.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45)
  boom.connect(gB)
  gB.connect(master)
  boom.start(t0)
  boom.stop(t0 + 0.48)

  scheduleClose(ctx, 900)
}

/** Step 3: 신성한 잔향(합창 느낌 삼각파 3성부) */
export function playLegendCoronationPhase() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.42
  master.connect(ctx.destination)

  const freqs = [196, 247, 294]
  for (const f of freqs) {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(f, t0)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.25)
    g.gain.linearRampToValueAtTime(0.04, t0 + 1.2)
    g.gain.linearRampToValueAtTime(0.0001, t0 + 2.4)
    o.connect(g)
    g.connect(master)
    o.start(t0)
    o.stop(t0 + 2.45)
  }

  scheduleClose(ctx, 2800)
}
