/**
 * Builds bright bead-shake maraca one-shots from FreePats EggShaker (CC0).
 * FreePats "Maracas/" and some BigSoundBank takes read as scrapes — too güiro-like.
 * https://github.com/freepats/world-percussion — CC0
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const tmp = join(root, '.tmp-maracas')
const outDir = join(root, 'public/samples')
mkdirSync(tmp, { recursive: true })
mkdirSync(outDir, { recursive: true })

const base =
  'https://raw.githubusercontent.com/freepats/world-percussion/main/samples/EggShaker'

const sources = [
  {
    url: `${base}/soft_03.wav`,
    out: 'maracas-open.wav',
    maxMs: 90,
    density: 1.25,
    seed: 3,
    realMix: 0.62,
  },
  {
    url: `${base}/fast_05.wav`,
    out: 'maracas-mute.wav',
    maxMs: 72,
    density: 0.95,
    seed: 17,
    realMix: 0.65,
  },
]

function readWavMono(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (String.fromCharCode(...buf.subarray(0, 4)) !== 'RIFF') {
    throw new Error('not RIFF')
  }
  let offset = 12
  let rate = 48000
  let bits = 16
  let ch = 1
  let dataOffset = 0
  let dataSize = 0
  while (offset + 8 <= buf.length) {
    const id = String.fromCharCode(...buf.subarray(offset, offset + 4))
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ') {
      ch = view.getUint16(offset + 10, true)
      rate = view.getUint32(offset + 12, true)
      bits = view.getUint16(offset + 22, true)
    } else if (id === 'data') {
      dataOffset = offset + 8
      dataSize = size
      break
    }
    offset += 8 + size + (size % 2)
  }
  const samples = []
  const end = dataOffset + dataSize
  if (bits === 24) {
    const frame = 3 * ch
    for (let i = dataOffset; i + frame <= end; i += frame) {
      let v = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16)
      if (v & 0x800000) v |= ~0xffffff
      samples.push(v / 8388608)
    }
  } else if (bits === 16) {
    for (let i = dataOffset; i + 2 * ch <= end; i += 2 * ch) {
      samples.push(view.getInt16(i, true) / 32768)
    }
  } else {
    throw new Error(`unsupported bits ${bits}`)
  }
  return { rate, samples }
}

function resample(samples, srcRate, dstRate = 44100) {
  if (srcRate === dstRate) return samples
  const outLen = Math.floor((samples.length * dstRate) / srcRate)
  const out = new Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const pos = (i * srcRate) / dstRate
    const i0 = Math.floor(pos)
    const frac = pos - i0
    const a = samples[i0] ?? 0
    const b = samples[i0 + 1] ?? 0
    out[i] = a * (1 - frac) + b * frac
  }
  return out
}

function highpass(samples, cutoff, rate, passes = 2) {
  let out = samples
  for (let p = 0; p < passes; p++) {
    const rc = 1 / (2 * Math.PI * cutoff)
    const dt = 1 / rate
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

function normalize(samples, peak = 0.92) {
  let m = 0
  for (const s of samples) m = Math.max(m, Math.abs(s))
  const g = peak / (m || 1)
  return samples.map((s) => s * g)
}

function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Dense short bead collisions — chik, not scrape */
function beadSynth(durSec, seed, density, rate = 44100) {
  const rand = mulberry32(seed)
  const n = Math.floor(rate * durSec)
  const out = new Float64Array(n)
  const beads = Math.floor(70 * density)
  for (let b = 0; b < beads; b++) {
    const t = rand() ** 2.6
    const pos = Math.floor(t * (n - 40))
    const amp = (0.45 + 0.55 * rand()) * (1 - t) ** 0.8
    const clickN = Math.max(2, Math.floor(rate * 0.0009 * (0.8 + rand())))
    for (let i = 0; i < clickN; i++) {
      if (pos + i >= n) break
      out[pos + i] += amp * 1.3 * (1 - i / clickN) * (rand() * 2 - 1)
    }
    const grain = Math.floor(rate * 0.004 * (0.6 + rand()))
    for (let i = 0; i < grain; i++) {
      if (pos + clickN + i >= n) break
      const env = Math.exp(-i / (grain * 0.28))
      out[pos + clickN + i] += amp * 0.65 * env * (rand() - rand())
    }
  }
  let samples = highpass(Array.from(out), 1600, rate, 2)
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= Math.exp(-(i / rate) * 26)
  }
  return normalize(samples, 0.88)
}

function extractShake(samples, rate, maxMs) {
  const thr = 0.015
  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < thr) start++
  start = Math.max(0, start - Math.floor(rate * 0.003))
  let s = samples.slice(start, start + Math.floor((rate * maxMs) / 1000))
  s = highpass(s, 1800, rate, 3)
  const atk = Math.floor(rate * 0.002)
  for (let i = 0; i < atk && i < s.length; i++) {
    s[i] *= (i / atk) ** 0.7
  }
  for (let i = 0; i < s.length; i++) {
    const t = i / rate
    s[i] *= Math.exp(-t * 28) * (t < 0.012 ? 1 : Math.exp(-(t - 0.012) * 18))
  }
  const fade = Math.floor(rate * 0.025)
  for (let i = 0; i < fade && i < s.length; i++) {
    s[s.length - 1 - i] *= i / Math.max(1, fade)
  }
  return normalize(s, 0.9)
}

function brighten(samples, amount = 0.35) {
  const out = [samples[0] ?? 0]
  for (let i = 1; i < samples.length; i++) {
    out.push(samples[i] + amount * (samples[i] - samples[i - 1]))
  }
  return normalize(out, 0.92)
}

function mix(a, b, wa, wb) {
  const n = Math.max(a.length, b.length)
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = (a[i] ?? 0) * wa + (b[i] ?? 0) * wb
  }
  return normalize(out, 0.93)
}

function writeWav16(path, samples, rate = 44100) {
  const dataSize = samples.length * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
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

for (const src of sources) {
  process.stdout.write(`fetch ${src.out}… `)
  const res = await fetch(src.url)
  if (!res.ok) {
    console.log(`fail (${res.status})`)
    continue
  }
  const raw = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(tmp, src.out + '.src'), raw)
  let { rate, samples } = readWavMono(raw)
  samples = resample(samples, rate, 44100)
  const real = extractShake(samples, 44100, src.maxMs)
  const synth = beadSynth(src.maxMs / 1000, src.seed, src.density)
  let out = mix(real, synth, src.realMix, 1 - src.realMix)
  out = brighten(out, 0.38)
  writeWav16(join(outDir, src.out), out)
  console.log('ok')
}

rmSync(tmp, { recursive: true, force: true })
console.log('Maracas updated: EggShaker beads + synth (CC0).')
