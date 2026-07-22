/**
 * Generates short CC0-style percussion one-shots (original synthesis).
 * Used to complement FreePats samples for instruments not in that pack
 * (timbale, guiro, campana) and as fallbacks.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/samples')
mkdirSync(outDir, { recursive: true })

const SR = 44100

function writeWav(path, samples) {
  const numSamples = samples.length
  const buffer = Buffer.alloc(44 + numSamples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + numSamples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SR, 24)
  buffer.writeUInt32LE(SR * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(numSamples * 2, 40)
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE((s * 32767) | 0, 44 + i * 2)
  }
  writeFileSync(path, buffer)
}

function env(t, a, d) {
  if (t < a) return t / a
  return Math.exp(-(t - a) / d)
}

function noise() {
  return Math.random() * 2 - 1
}

function clave(dur = 0.12) {
  const n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const e = env(t, 0.001, 0.04)
    out[i] = Math.sin(2 * Math.PI * 2400 * t) * e * 0.55
      + Math.sin(2 * Math.PI * 3600 * t) * e * 0.25
      + noise() * e * 0.08
  }
  return out
}

function woodClick(freq, dur = 0.08) {
  const n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const e = env(t, 0.0008, 0.03)
    out[i] = Math.sin(2 * Math.PI * freq * t) * e * 0.5 + noise() * e * 0.1
  }
  return out
}

function drum(freq, dur, noiseAmt, bright = 1) {
  const n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const f = freq * (1 + Math.exp(-t * 40) * 0.4)
    const e = env(t, 0.002, dur * 0.35)
    const body = Math.sin(2 * Math.PI * f * t) * e
    const click = noise() * Math.exp(-t * 80) * noiseAmt * bright
    out[i] = body * 0.7 + click
  }
  return out
}

function shaker(dur = 0.09) {
  const n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const e = env(t, 0.005, 0.04)
    // band-ish noise
    let nse = noise()
    nse = nse - (out[Math.max(0, i - 1)] || 0) * 0.6
    out[i] = nse * e * 0.35
  }
  return out
}

/** Placeholder only — real güiro ridge scrapes: `pnpm fetch:guiro` */
function guiro(dur = 0.18) {
  const n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  const ridges = dur > 0.12 ? 9 : 3
  for (let r = 0; r < ridges; r++) {
    const u = (r + 0.5) / ridges
    const pos = Math.floor((0.02 + u * 0.85 * dur) * SR)
    for (let i = 0; i < Math.floor(SR * 0.01); i++) {
      if (pos + i >= n) break
      const e = Math.exp(-i / (SR * 0.004))
      out[pos + i] += e * (noise() * 0.5 + Math.sin(2 * Math.PI * 1400 * (i / SR)) * 0.2)
    }
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] *= env(t, 0.008, dur * 0.4)
  }
  return out
}

function campana(freq = 880, dur = 0.45) {
  const n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const e = env(t, 0.001, 0.22)
    out[i] =
      Math.sin(2 * Math.PI * freq * t) * e * 0.4 +
      Math.sin(2 * Math.PI * freq * 2.76 * t) * e * 0.18 +
      Math.sin(2 * Math.PI * freq * 5.4 * t) * e * 0.08 +
      noise() * Math.exp(-t * 120) * 0.12
  }
  return out
}

function timbale(freq, dur = 0.2) {
  return drum(freq, dur, 0.35, 1.2)
}

function metronomeClick() {
  return woodClick(1800, 0.05)
}

/** Electric/salsa bass pluck: fundamental + soft harmonic, quick attack */
function bassNote(freq, dur = 0.45) {
  const n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const e = Math.exp(-t * 4.2) * (t < 0.008 ? t / 0.008 : 1)
    const body =
      Math.sin(2 * Math.PI * freq * t) * 0.7 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.18 * Math.exp(-t * 8) +
      Math.sin(2 * Math.PI * freq * 3 * t) * 0.06 * Math.exp(-t * 14)
    const click = noise() * Math.exp(-t * 90) * 0.08
    out[i] = (body + click) * e * 0.85
  }
  return out
}

// Synthetic complements (FreePats covers clave/conga/bongo/maracas via fetch:freepats)
const files = {
  'clave-open.wav': clave(0.14),
  'clave-mute.wav': woodClick(1900, 0.07),
  'conga-open.wav': drum(120, 0.35, 0.25),
  'conga-mute.wav': drum(140, 0.12, 0.15, 0.7),
  'conga-slap.wav': drum(220, 0.1, 0.55, 1.6),
  'bongo-open.wav': drum(280, 0.18, 0.3),
  'bongo-mute.wav': drum(320, 0.08, 0.2, 0.8),
  'bongo-slap.wav': drum(400, 0.07, 0.5, 1.5),
  'timbale-open.wav': timbale(260, 0.22),
  'timbale-mute.wav': timbale(300, 0.1),
  'timbale-slap.wav': timbale(480, 0.08),
  // Maracas / güiro / campana: fetch:maracas / fetch:guiro / fetch:campana
  // Bajo intentionally omitted — use electric bass hits: `pnpm fetch:bajo`
  'click.wav': metronomeClick(),
}

const onlyMissing = process.argv.includes('--only-missing')

for (const [name, data] of Object.entries(files)) {
  const path = join(outDir, name)
  if (onlyMissing && existsSync(path)) {
    console.log('skip', name)
    continue
  }
  writeWav(path, data)
  console.log('wrote', name)
}
console.log('done')
