/**
 * Builds güiro one-shots from real CC0 Freesound recordings
 * (HQ previews → mono WAV → carved scrape / tick).
 *
 * open  = longer multi-ridge scrape ("raaas")
 * mute  = short scrape / tick ("ca")
 *
 * Sources (Creative Commons 0):
 * - brunoboselli "Guiro" https://freesound.org/people/brunoboselli/sounds/472469/
 * - SamuelGremaud "GUIRO" (bamboo) https://freesound.org/people/SamuelGremaud/sounds/517640/
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

const root = process.cwd()
const tmp = join(root, '.tmp-guiro')
const outDir = join(root, 'public/samples')
mkdirSync(tmp, { recursive: true })
mkdirSync(outDir, { recursive: true })

const sources = {
  long: {
    url: 'https://cdn.freesound.org/previews/472/472469_300738-hq.mp3',
    file: 'long.mp3',
    // Densest multi-ridge scrape in the take (~18–20 crestas)
    start: 4.24,
    maxMs: 380,
    fadeMs: 80,
    peak: 0.9,
    hp: 260,
    out: 'guiro-open.wav',
  },
  short: {
    url: 'https://cdn.freesound.org/previews/517/517640_8031303-hq.mp3',
    file: 'short.mp3',
    // Clean bamboo tick/scrape
    start: 2.88,
    maxMs: 120,
    fadeMs: 30,
    peak: 0.88,
    hp: 300,
    out: 'guiro-mute.wav',
  },
}

function readWav(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF')
  let o = 12
  let rate = 44100
  let bits = 16
  let ch = 1
  let dataOff = 0
  let dataSize = 0
  while (o + 8 <= buf.length) {
    const id = buf.toString('ascii', o, o + 4)
    const size = view.getUint32(o + 4, true)
    if (id === 'fmt ') {
      ch = view.getUint16(o + 10, true)
      rate = view.getUint32(o + 12, true)
      bits = view.getUint16(o + 22, true)
    } else if (id === 'data') {
      dataOff = o + 8
      dataSize = size
      break
    }
    o += 8 + size + (size % 2)
  }
  if (bits !== 16) throw new Error(`need 16-bit, got ${bits}`)
  const n = Math.floor(dataSize / (2 * ch))
  const samples = new Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let c = 0; c < ch; c++) {
      s += view.getInt16(dataOff + (i * ch + c) * 2, true) / 32768
    }
    samples[i] = s / ch
  }
  return { rate, samples }
}

function highpass(samples, cutoff, rate = 44100) {
  const rc = 1 / (2 * Math.PI * cutoff)
  const dt = 1 / rate
  const a = rc / (rc + dt)
  let y = 0
  let prev = 0
  return samples.map((x) => {
    y = a * (y + x - prev)
    prev = x
    return y
  })
}

/** Mild band emphasis so ridge clicks cut through without hiss */
function shelfBoost(samples, amount = 0.35) {
  // One-pole differentiator-ish brightener, then mix back
  let prev = 0
  return samples.map((x) => {
    const d = x - prev
    prev = x
    return x + d * amount
  })
}

function normalize(samples, peak = 0.9) {
  let m = 0
  for (const s of samples) m = Math.max(m, Math.abs(s))
  const g = peak / (m || 1)
  return samples.map((s) => s * g)
}

function fadeEdges(samples, fadeInMs, fadeOutMs, rate = 44100) {
  const out = samples.slice()
  const fi = Math.floor((rate * fadeInMs) / 1000)
  const fo = Math.floor((rate * fadeOutMs) / 1000)
  for (let i = 0; i < fi && i < out.length; i++) out[i] *= i / fi
  for (let i = 0; i < fo && i < out.length; i++) {
    out[out.length - 1 - i] *= i / fo
  }
  return out
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

/** Snap start to nearest energy onset near the requested time */
function snapToOnset(samples, rate, approxSec, lookBack = 0.04, lookAhead = 0.08) {
  const center = Math.floor(approxSec * rate)
  const a = Math.max(0, center - Math.floor(lookBack * rate))
  const b = Math.min(samples.length - 1, center + Math.floor(lookAhead * rate))
  let peak = 0
  for (let i = a; i <= b; i++) peak = Math.max(peak, Math.abs(samples[i]))
  const thr = peak * 0.18
  for (let i = a; i <= b; i++) {
    if (Math.abs(samples[i]) >= thr) return Math.max(0, i - 24)
  }
  return a
}

for (const src of Object.values(sources)) {
  process.stdout.write(`fetch ${src.out}… `)
  const mp3 = join(tmp, src.file)
  const wav = join(tmp, src.file.replace('.mp3', '.wav'))
  const res = await fetch(src.url)
  if (!res.ok) throw new Error(`download failed ${src.url} (${res.status})`)
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()))
  execFileSync(
    ffmpegPath,
    ['-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', '44100', wav],
  )

  let { samples } = readWav(readFileSync(wav))
  const rate = 44100
  const start = snapToOnset(samples, rate, src.start)
  const len = Math.floor((rate * src.maxMs) / 1000)
  samples = samples.slice(start, start + len)
  samples = highpass(samples, src.hp, rate)
  samples = shelfBoost(samples, 0.28)
  samples = fadeEdges(samples, 4, src.fadeMs, rate)
  samples = normalize(samples, src.peak)
  writeWav16(join(outDir, src.out), samples, rate)
  console.log(`ok (${(samples.length / rate).toFixed(3)}s from t=${(start / rate).toFixed(2)})`)
}

rmSync(tmp, { recursive: true, force: true })
console.log('Güiro updated from Freesound CC0 recordings.')
