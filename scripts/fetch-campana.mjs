/**
 * Downloads real CC0 cowbell hits from Versilian Community Sample Library (VCSL)
 * and writes tight open/mute one-shots for the mambo campana.
 *
 * https://github.com/sgossner/VCSL — CC0 / public domain
 * open  = Normal strike (ringing TING)
 * mute  = Muted strike (boca / damped TAK)
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const tmp = join(root, '.tmp-campana')
const outDir = join(root, 'public/samples')
mkdirSync(tmp, { recursive: true })
mkdirSync(outDir, { recursive: true })

const base =
  'https://raw.githubusercontent.com/sgossner/VCSL/master/Idiophones/Struck%20Idiophones/Cowbells'

// Cowbell2 = larger / more "cencerro" body; Normal vs Muted = open vs boca
const sources = [
  {
    url: `${base}/Cowbell2_Normal_v3_rr1_Mid.wav`,
    out: 'campana-open.wav',
    maxMs: 380,
    fadeMs: 70,
    peak: 0.9,
  },
  {
    url: `${base}/Cowbell2_Muted_v3_rr1_Mid.wav`,
    out: 'campana-mute.wav',
    maxMs: 140,
    fadeMs: 35,
    peak: 0.88,
  },
]

function readWav(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (String.fromCharCode(...buf.subarray(0, 4)) !== 'RIFF') {
    throw new Error('not RIFF')
  }
  let offset = 12
  let rate = 44100
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
  if (bits === 16) {
    for (let i = dataOffset; i + 2 * ch <= end; i += 2 * ch) {
      let sum = 0
      for (let c = 0; c < ch; c++) sum += view.getInt16(i + c * 2, true) / 32768
      samples.push(sum / ch)
    }
  } else if (bits === 24) {
    const frame = 3 * ch
    for (let i = dataOffset; i + frame <= end; i += frame) {
      let sum = 0
      for (let c = 0; c < ch; c++) {
        const o = i + c * 3
        let v = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16)
        if (v & 0x800000) v |= ~0xffffff
        sum += v / 8388608
      }
      samples.push(sum / ch)
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

function trimStart(samples, thresh = 0.012) {
  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < thresh) start++
  return samples.slice(Math.max(0, start - 32))
}

function fadeOut(samples, fadeMs, rate) {
  const fade = Math.floor((rate * fadeMs) / 1000)
  if (fade <= 0) return samples
  const out = samples.slice()
  for (let i = 0; i < fade && i < out.length; i++) {
    out[out.length - 1 - i] *= i / fade
  }
  return out
}

function normalize(samples, peak = 0.9) {
  let m = 0
  for (const s of samples) m = Math.max(m, Math.abs(s))
  const g = peak / (m || 1)
  return samples.map((s) => s * g)
}

/** Keep metallic bite; light HP kills rumble without doorbell-ifying */
function highpass(samples, cutoff, rate) {
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
  let { rate, samples } = readWav(raw)
  samples = resample(samples, rate, 44100)
  samples = trimStart(samples)
  samples = samples.slice(0, Math.floor((44100 * src.maxMs) / 1000))
  samples = highpass(samples, 180, 44100)
  samples = fadeOut(samples, src.fadeMs, 44100)
  samples = normalize(samples, src.peak)
  writeWav16(join(outDir, src.out), samples)
  console.log(`ok (${samples.length} samples)`)
}

rmSync(tmp, { recursive: true, force: true })
console.log('Campana updated from VCSL Cowbells (CC0).')
