/**
 * Builds electric-bass one-shots from Free Wave Samples
 * "Roland JV-2080 Pick Bass C2" (royalty-free; redistributable in web apps).
 * https://freewavesamples.com/about-us-license
 *
 * open = C2, mute = G2 (+7), slap = C3 (+12)
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const tmp = join(root, '.tmp-bajo')
const outDir = join(root, 'public/samples')
mkdirSync(tmp, { recursive: true })
mkdirSync(outDir, { recursive: true })

const SRC =
  'https://freewavesamples.com/files/Roland-JV-2080-Pick-Bass-C2.wav'

function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF')
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let offset = 12
  let channels = 1
  let rate = 44100
  let bits = 16
  let dataOffset = 0
  let dataSize = 0
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ') {
      channels = view.getUint16(offset + 10, true)
      rate = view.getUint32(offset + 12, true)
      bits = view.getUint16(offset + 22, true)
    } else if (id === 'data') {
      dataOffset = offset + 8
      dataSize = size
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (bits !== 16) throw new Error(`need 16-bit, got ${bits}`)
  const samples = []
  for (let i = dataOffset; i < dataOffset + dataSize; i += 2 * channels) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      sum += view.getInt16(i + c * 2, true) / 32768
    }
    samples.push(sum / channels)
  }
  return { rate, samples }
}

function resample(samples, srcRate, dstRate) {
  if (Math.abs(srcRate - dstRate) < 1e-6) return samples.slice()
  const outLen = Math.max(1, Math.floor((samples.length * dstRate) / srcRate))
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

function pitchShift(samples, semitones) {
  const factor = 2 ** (semitones / 12)
  return resample(samples, 44100 * factor, 44100)
}

function lowpass(samples, cutoff, rate = 44100) {
  const rc = 1 / (2 * Math.PI * cutoff)
  const dt = 1 / rate
  const a = dt / (rc + dt)
  let y = 0
  return samples.map((x) => {
    y += a * (x - y)
    return y
  })
}

function softClip(samples, drive = 1.25) {
  return samples.map((x) => Math.tanh(x * drive))
}

function trimFade(samples, maxMs, fadeMs) {
  const thresh = 0.012
  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < thresh) start++
  start = Math.max(0, start - 48)
  let s = samples.slice(start, start + Math.floor((44100 * maxMs) / 1000))
  const fade = Math.floor((44100 * fadeMs) / 1000)
  for (let i = 0; i < fade && i < s.length; i++) {
    s[s.length - 1 - i] *= i / fade
  }
  const atk = Math.floor(44100 * 0.004)
  for (let i = 0; i < atk && i < s.length; i++) {
    s[i] *= i / atk
  }
  return s
}

function normalize(samples, peak = 0.88) {
  let m = 0
  for (const x of samples) m = Math.max(m, Math.abs(x))
  const g = peak / (m || 1)
  return samples.map((x) => x * g)
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

process.stdout.write('fetch Pick Bass C2… ')
const res = await fetch(SRC)
if (!res.ok) throw new Error(`download failed ${res.status}`)
const raw = Buffer.from(await res.arrayBuffer())
writeFileSync(join(tmp, 'c2.wav'), raw)
console.log('ok')

let { rate, samples } = readWav(raw)
samples = resample(samples, rate, 44100)

const variants = [
  ['bajo-open.wav', 0, 450, 100, 2800],
  ['bajo-mute.wav', 7, 400, 85, 3000],
  ['bajo-slap.wav', 12, 340, 70, 3400],
]

for (const [name, semi, maxMs, fadeMs, cutoff] of variants) {
  let s = semi ? pitchShift(samples, semi) : samples.slice()
  s = lowpass(s, cutoff)
  s = softClip(s)
  s = trimFade(s, maxMs, fadeMs)
  s = normalize(s)
  writeWav16(join(outDir, name), s)
  console.log('wrote', name)
}

rmSync(tmp, { recursive: true, force: true })
console.log('Bajo samples updated (Free Wave Samples, royalty-free).')
