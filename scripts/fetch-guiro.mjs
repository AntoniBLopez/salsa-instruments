/**
 * Builds realistic güiro one-shots: stick scraped across wooden ridges.
 * (FreePats has no güiro; old synth was plain AM noise.)
 *
 * open  = long salsa scrape  ("raaaas")
 * mute  = short tick scrape  ("tic")
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SR = 44100
const outDir = join(process.cwd(), 'public/samples')
mkdirSync(outDir, { recursive: true })

function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalize(samples, peak = 0.9) {
  let m = 0
  for (const s of samples) m = Math.max(m, Math.abs(s))
  const g = peak / (m || 1)
  return samples.map((s) => s * g)
}

function highpass(samples, cutoff, passes = 1) {
  let out = samples
  for (let p = 0; p < passes; p++) {
    const rc = 1 / (2 * Math.PI * cutoff)
    const dt = 1 / SR
    const a = rc / (rc + dt)
    let y = 0
    let prev = 0
    const next = new Array(out.length)
    for (let i = 0; i < out.length; i++) {
      const x = out[i]
      y = a * (y + x - prev)
      prev = x
      next[i] = y
    }
    out = next
  }
  return out
}

function bandpassNoise(rand, n, center, q) {
  // Cheap resonant-ish noise via one-pole SVF-ish state
  const out = new Float64Array(n)
  const f = (2 * Math.PI * center) / SR
  let lp = 0
  let bp = 0
  for (let i = 0; i < n; i++) {
    const x = rand() * 2 - 1
    lp += f * bp
    const hp = x - lp - (1 / q) * bp
    bp += f * hp
    out[i] = bp
  }
  return out
}

/**
 * Güiro scrape: discrete ridge ticks + woody rasp noise.
 * Rate eases in/out so it feels like a stick stroke, not a metronome.
 */
function guiroScrape({
  dur = 0.22,
  ridges = 10,
  seed = 1,
  brightness = 1,
  woodFreq = 1450,
}) {
  const rand = mulberry32(seed)
  const n = Math.floor(SR * dur)
  const out = new Float64Array(n)

  // Precompute rasp bed (band-limited noise)
  const rasp = bandpassNoise(rand, n, 2200 * brightness, 1.8)
  const rasp2 = bandpassNoise(rand, n, 3800 * brightness, 2.4)

  for (let r = 0; r < ridges; r++) {
    // Nearly even ridge spacing with mild accel (stick stroke), plus tiny jitter
    const u = (r + 0.5) / ridges
    const accel = u ** 0.85 // slight front-loading without merging peaks
    const jitter = (rand() - 0.5) * 0.004
    const t0 = Math.max(
      0,
      Math.min(dur - 0.012, 0.01 + accel * (dur - 0.03) + jitter),
    )
    const pos = Math.floor(t0 * SR)

    const ridgeAmp = 0.5 + 0.5 * Math.sin(Math.PI * u) // louder mid-stroke
    // Each ridge: sharp stick click (dominant) + short rasp + wood ping
    const clickN = Math.floor(SR * (0.0022 + rand() * 0.001))
    for (let i = 0; i < clickN; i++) {
      if (pos + i >= n) break
      const e = 1 - i / clickN
      out[pos + i] += ridgeAmp * 1.55 * e * e * (rand() * 2 - 1) * brightness
    }

    const grainN = Math.floor(SR * (0.008 + rand() * 0.004))
    for (let i = 0; i < grainN; i++) {
      if (pos + i >= n) break
      const t = i / SR
      const e = Math.exp(-t * 260)
      const idx = pos + i
      out[idx] +=
        ridgeAmp *
        e *
        (rasp[idx] * 0.55 + rasp2[idx] * 0.4) *
        (0.7 + 0.3 * rand())
    }

    // Short wooden body ping under each ridge
    const pingN = Math.floor(SR * 0.014)
    const freq = woodFreq * (0.92 + rand() * 0.16)
    for (let i = 0; i < pingN; i++) {
      if (pos + i >= n) break
      const t = i / SR
      const e = Math.exp(-t * 260)
      out[pos + i] +=
        ridgeAmp * 0.28 * e * Math.sin(2 * Math.PI * freq * t)
    }
  }

  // Overall stroke envelope — quick in, natural out
  const atk = Math.floor(SR * 0.008)
  for (let i = 0; i < n; i++) {
    let env = 1
    if (i < atk) env = (i / atk) ** 0.6
    else {
      const u = (i - atk) / (n - atk)
      env = (1 - u) ** 1.15 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.2)))
    }
    out[i] *= env
  }

  // Fade tail cleanly
  const fade = Math.floor(SR * 0.03)
  for (let i = 0; i < fade; i++) {
    out[n - 1 - i] *= i / Math.max(1, fade)
  }

  let samples = highpass(Array.from(out), 500, 1)
  // Mild pre-emphasis for stick-on-ridge bite
  const bright = [samples[0]]
  for (let i = 1; i < samples.length; i++) {
    bright.push(samples[i] + 0.28 * (samples[i] - samples[i - 1]))
  }
  return normalize(bright, 0.92)
}

function writeWav16(path, samples) {
  const dataSize = samples.length * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2)
  }
  writeFileSync(path, buf)
}

const openHit = guiroScrape({
  dur: 0.26,
  ridges: 12,
  seed: 42,
  brightness: 1.1,
  woodFreq: 1380,
})
const muteHit = guiroScrape({
  dur: 0.085,
  ridges: 3,
  seed: 99,
  brightness: 1.2,
  woodFreq: 1650,
})

writeWav16(join(outDir, 'guiro-open.wav'), openHit)
writeWav16(join(outDir, 'guiro-mute.wav'), muteHit)

console.log(
  'Güiro updated: long scrape (open) + short tick (mute).',
  `open=${openHit.length} mute=${muteHit.length} samples`,
)
