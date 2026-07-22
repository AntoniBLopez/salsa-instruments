/**
 * Downloads FreePats World Percussion (CC0) FLAC hits and converts them to WAV.
 * Requires: npm i -D ffmpeg-static
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

const root = process.cwd()
const tmp = join(root, '.tmp-freepats')
const outDir = join(root, 'public/samples')
mkdirSync(tmp, { recursive: true })
mkdirSync(outDir, { recursive: true })

const base =
  'https://raw.githubusercontent.com/freepats/world-percussion/main/samples'

const downloads = [
  [`${base}/Claves/01.flac`, 'clave-open.wav'],
  [`${base}/Claves/02.flac`, 'clave-mute.wav'],
  [`${base}/Conga/v2_01_01.flac`, 'conga-open.wav'],
  [`${base}/MutedConga/High_v2_01_01.flac`, 'conga-mute.wav'],
  [`${base}/HighConga/v2_01_01.flac`, 'conga-slap.wav'],
  [`${base}/Bongos/1_01.flac`, 'bongo-open.wav'],
  [`${base}/Bongos/1_02.flac`, 'bongo-mute.wav'],
  [`${base}/Bongos/1_03.flac`, 'bongo-slap.wav'],
  // Maracas: `pnpm fetch:maracas` (EggShaker beads — FreePats Maracas/ sound scrape-like)
  // Güiro mute: keep synthetic scrape from `pnpm generate:samples`
]

for (const [url, outName] of downloads) {
  const flac = join(tmp, outName.replace('.wav', '.flac'))
  const wav = join(outDir, outName)
  process.stdout.write(`fetch ${outName}… `)
  const res = await fetch(url)
  if (!res.ok) {
    console.log(`skip (${res.status})`)
    continue
  }
  writeFileSync(flac, Buffer.from(await res.arrayBuffer()))
  execFileSync(
    ffmpegPath,
    ['-y', '-i', flac, '-ac', '1', '-ar', '44100', wav],
    { stdio: 'ignore' },
  )
  console.log('ok')
}

rmSync(tmp, { recursive: true, force: true })
console.log('FreePats samples updated (CC0).')
