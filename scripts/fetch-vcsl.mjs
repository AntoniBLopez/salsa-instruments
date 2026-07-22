/**
 * Downloads real CC0 one-shots from the Versilian Community Sample Library
 * (https://github.com/sgossner/VCSL — CC0 / public domain) and writes tight
 * WAV one-shots for: bongós, congas (open + slap), timbales (cáscara/paila),
 * güiro and maracas (shaker).
 *
 * Timbales note: cáscara/paila are played on the SHELL, so open/mute use real
 * rim/cross-stick recordings (bright crack + dry tick) and slap is a real tom
 * hit pitched up to macho range.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const tmp = join(root, '.tmp-vcsl')
const outDir = join(root, 'public/samples')
mkdirSync(tmp, { recursive: true })
mkdirSync(outDir, { recursive: true })

const BASE = 'https://raw.githubusercontent.com/sgossner/VCSL/master'
const IDIO = 'Idiophones/Struck Idiophones'
const MEMB = 'Membranophones/Struck Membranophones'

const sources = [
  // --- Bongós (real macho open / macho muted / hembra low) ---
  {
    path: `${MEMB}/Bongos/BongoH_Hit1_v3_rr1_Mid.wav`,
    out: 'bongo-open.wav',
    maxMs: 260, fadeMs: 60, peak: 0.9, hp: 120,
  },
  {
    path: `${MEMB}/Bongos/BongoH_HitMuted1_v3_rr1_Mid.wav`,
    out: 'bongo-mute.wav',
    maxMs: 130, fadeMs: 30, peak: 0.85, hp: 150,
  },
  {
    path: `${MEMB}/Bongos/BongoL_Hit1_v3_rr1_Mid.wav`,
    out: 'bongo-slap.wav',
    maxMs: 280, fadeMs: 60, peak: 0.92, hp: 90,
  },

  // --- Congas: real open tone + real quinto crack for the slap ---
  {
    path: `${MEMB}/Conga/Conga_HitN_v3_rr1_Sum.wav`,
    out: 'conga-open.wav',
    maxMs: 420, fadeMs: 90, peak: 0.9, hp: 55,
  },
  {
    path: `${MEMB}/Conga/Quinto_HitFM1_v2_rr1_Sum.wav`,
    out: 'conga-slap.wav',
    maxMs: 190, fadeMs: 45, peak: 0.92, hp: 260,
  },

  // --- Timbales: shell/rim sounds (cáscara) + macho drum accent ---
  {
    path: `${MEMB}/Legacy Snares/OldSnare/snare_rim.wav`,
    out: 'timbale-open.wav',
    maxMs: 170, fadeMs: 40, peak: 0.88, hp: 300,
  },
  {
    path: `${MEMB}/Legacy Snares/drum1/snare1_click.wav`,
    out: 'timbale-mute.wav',
    maxMs: 110, fadeMs: 25, peak: 0.8, hp: 300,
  },
  {
    path: `${MEMB}/Legacy Toms/tenor_higher/tenorH_ff_rr1.wav`,
    out: 'timbale-slap.wav',
    maxMs: 260, fadeMs: 60, peak: 0.9, hp: 100, semitones: 5,
  },

  // Güiro: `pnpm fetch:guiro` (Freesound CC0 scrapes — VCSL takes are too noisy)

  // --- Maracas: real shaker strokes (down = accent, up = return) ---
  {
    path: `${IDIO}/Shaker, Small/Mid_ShakerHighFaster_Down_rr1.wav`,
    out: 'maracas-open.wav',
    maxMs: 150, fadeMs: 45, peak: 0.85, hp: 700,
  },
  {
    path: `${IDIO}/Shaker, Small/Mid_ShakerHighFaster_Up_rr1.wav`,
    out: 'maracas-mute.wav',
    maxMs: 130, fadeMs: 40, peak: 0.78, hp: 700,
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
  const end = Math.min(dataOffset + dataSize, buf.length)
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

function pitchShift(samples, semitones) {
  if (!semitones) return samples
  const factor = 2 ** (semitones / 12)
  return resample(samples, 44100 * factor, 44100)
}

function trimStart(samples, thresh = 0.01) {
  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < thresh) start++
  return samples.slice(Math.max(0, start - 32))
}

function fadeOut(samples, fadeMs, rate = 44100) {
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

function highpass(samples, cutoff, rate = 44100) {
  if (!cutoff) return samples
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

let failures = 0
for (const src of sources) {
  const url = `${BASE}/${src.path.split('/').map(encodeURIComponent).join('/')}`
  process.stdout.write(`fetch ${src.out}… `)
  const res = await fetch(url)
  if (!res.ok) {
    console.log(`FAIL (${res.status})`)
    failures++
    continue
  }
  const raw = Buffer.from(await res.arrayBuffer())
  let { rate, samples } = readWav(raw)
  samples = resample(samples, rate, 44100)
  samples = pitchShift(samples, src.semitones)
  // Some VCSL takes are recorded very quietly — normalize before onset trim
  samples = normalize(samples, 1)
  samples = trimStart(samples)
  samples = samples.slice(0, Math.floor((44100 * src.maxMs) / 1000))
  samples = highpass(samples, src.hp)
  samples = fadeOut(samples, src.fadeMs)
  samples = normalize(samples, src.peak)
  writeWav16(join(outDir, src.out), samples)
  console.log(`ok (${samples.length} samples)`)
}

rmSync(tmp, { recursive: true, force: true })
if (failures > 0) {
  console.error(`${failures} downloads failed`)
  process.exit(1)
}
console.log('VCSL samples updated (CC0).')
