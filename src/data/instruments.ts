export type HitKind = 'open' | 'mute' | 'slap'
export type Hit = 0 | HitKind
export type ClaveDirection = '3-2' | '2-3'
export type RhythmLevel = 'beginner' | 'intermediate' | 'advanced'

export type RhythmPatterns = {
  '3-2'?: Hit[]
  '2-3'?: Hit[]
  default?: Hit[]
}

export type RhythmDef = {
  id: string
  name: string
  description: string
  level?: RhythmLevel
  /** Vocalización típica (referencia) */
  vocalization?: string
  /** If true, pick pattern by global clave direction */
  claveAware?: boolean
  patterns: RhythmPatterns
}

export type InstrumentConfig = {
  id: string
  name: string
  description: string
  image: string
  samples: Partial<Record<HitKind, string>>
  subdivision: '16n'
  rhythms: RhythmDef[]
  fx?: { reverbWet?: number; filterFreq?: number }
  isClave?: boolean
}

const O: Hit = 'open'
const M: Hit = 'mute'
const S: Hit = 'slap'
const _: Hit = 0

export const CYCLE_STEPS = 32
export const COUNTS = 8

export const LEVEL_LABEL: Record<RhythmLevel, string> = {
  beginner: 'Básico',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

function empty(): Hit[] {
  return Array.from({ length: CYCLE_STEPS }, () => _ as Hit)
}

function at(pattern: Hit[], beat: number, hit: Hit, and = false): void {
  const step = Math.round((beat - 1) * 4 + (and ? 2 : 0))
  if (step >= 0 && step < CYCLE_STEPS) pattern[step] = hit
}

function fromEighths(eighths: Hit[]): Hit[] {
  const pattern = empty()
  eighths.forEach((hit, i) => {
    if (hit !== 0) pattern[i * 2] = hit
  })
  return pattern
}

function swapBars(pattern: Hit[]): Hit[] {
  const half = CYCLE_STEPS / 2
  return [...pattern.slice(half), ...pattern.slice(0, half)]
}

/** Convert 0/1 grid → Hit[] with per-step articulation */
function fromBinary(
  bits: Array<0 | 1>,
  articulate: (step: number) => HitKind = () => 'open',
): Hit[] {
  if (bits.length !== CYCLE_STEPS) {
    throw new Error(`Pattern must have ${CYCLE_STEPS} steps, got ${bits.length}`)
  }
  return bits.map((b, step) => (b ? articulate(step) : _))
}

// --- Clave (son authentic — NOT the off-by-& grids from generic prompts) ---
// 3-2: 1, 2&, 4, 6, 7  — "pa — pa — pa  /  pa — pa"
// 2-3: 2, 3, 5, 6&, 8
function buildClave32(): Hit[] {
  const p = empty()
  at(p, 1, O)
  at(p, 2, O, true)
  at(p, 4, O)
  at(p, 6, O)
  at(p, 7, O)
  return p
}
function buildClave23(): Hit[] {
  const p = empty()
  at(p, 2, O)
  at(p, 3, O)
  at(p, 5, O)
  at(p, 6, O, true)
  at(p, 8, O)
  return p
}
/** Rumba: 3-side third stroke delayed to the & */
function buildRumba32(): Hit[] {
  const p = empty()
  at(p, 1, O)
  at(p, 2, O, true)
  at(p, 4, O, true) // 4&
  at(p, 6, O)
  at(p, 7, O)
  return p
}
function buildRumba23(): Hit[] {
  const p = empty()
  at(p, 2, O)
  at(p, 3, O)
  at(p, 5, O)
  at(p, 6, O, true)
  at(p, 8, O, true) // 8&
  return p
}

const CLAVE_32 = buildClave32()
const CLAVE_23 = buildClave23()
const RUMBA_32 = buildRumba32()
const RUMBA_23 = buildRumba23()

// --- Congas ---
// Regla: tumbao/marcha/guaguancó van CON AIRE. Nunca un golpe en cada corchea
// (salvo instrumentos que de verdad van constantes: martillo, maracas, cáscara).

// Beginner: solo slap + un open
const CONGA_BASIC = fromEighths([
  _, _, S, _, _, _, O, _,
  _, _, S, _, _, _, O, _,
])

/**
 * Tumbao clásico ("pa … cu-cum"):
 *   slap en 2 y 6  → "pa"
 *   open + open en 4/4& y 8/8& → "cu-cum"
 */
const CONGA_TUMBAO = fromEighths([
  _, _, S, _, _, _, O, O,
  _, _, S, _, _, _, O, O,
])

// Variación con un mute de apoyo antes del slap
const CONGA_TUMBAO_FULL = fromEighths([
  _, M, S, _, _, _, O, O,
  _, M, S, _, _, _, O, O,
])

/** Guaguancó: frases con aire, no relleno 16n */
const CONGA_ADVANCED = fromEighths([
  S, _, M, O, _, _, O, _,
  S, _, M, O, _, _, O, O,
])

/** Bombo: énfasis en el segundo compás, sin metrónomo */
const CONGA_BOMBO = fromEighths([
  _, _, S, _, _, _, O, _,
  S, _, _, _, _, _, O, O,
])

/** Marcha ligera: menos heel-toe, más huecos */
const CONGA_MARCHA = fromEighths([
  M, _, _, _, S, _, _, _,
  M, _, _, _, O, _, O, _,
])

// --- Bongós ---
/** Martillo: sí va a corcheas (auténtico). Open/mute + slap en 4&/8&. */
const BONGO_MARTILLO = fromEighths([
  O, M, O, M, O, M, O, S,
  O, M, O, M, O, M, O, S,
])

/** Acentos con aire — no relleno 16n */
const BONGO_INTER = fromEighths([
  O, M, _, M, O, _, O, S,
  O, M, O, _, _, M, O, S,
])

/** Repique: frases, no ametralladora */
const BONGO_REPIQUE = fromEighths([
  O, _, O, M, _, _, S, _,
  O, M, _, _, O, _, S, O,
])

/** Cerrado: mutes con aire + remate */
const BONGO_CERRADO = fromEighths([
  M, _, M, _, M, _, O, S,
  M, _, M, _, M, _, O, S,
])

// --- Timbales ---
// Cáscara 2-3 (16n) — "ca-sca-ra ca-sca"
const CASCARA_23 = fromBinary(
  [
    1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0,
  ],
  () => 'open',
)
const CASCARA_32 = swapBars(CASCARA_23)

/** Cáscara doble: un poco más llena, pero con huecos */
const CASCARA_DOBLE_23 = fromEighths([
  O, O, O, _, _, O, _, O,
  O, O, O, _, _, O, O, _,
])
const CASCARA_DOBLE_32 = swapBars(CASCARA_DOBLE_23)

/** Paila: golpes claros, no cada semicorchea */
const PAILA_23 = fromEighths([
  O, _, _, O, _, _, O, _,
  O, _, O, _, O, _, O, _,
])
const PAILA_32 = swapBars(PAILA_23)

// --- Maracas ---
// Alternate open/mute = forward / back shake — "chi-quin"
const MARACAS_CONSTANTE = fromEighths([
  O, M, O, M, O, M, O, M,
  O, M, O, M, O, M, O, M,
])

/** Síncopa densa pero con aire (no 20 hits/ciclo) */
const MARACAS_SYNC = fromEighths([
  O, M, _, O, _, M, O, _,
  O, M, _, O, _, M, O, _,
])

const MARACAS_BOLERO = fromEighths([
  O, _, _, _, M, _, _, _,
  O, _, _, _, M, _, _, _,
])

const MARACAS_SINCOPA = fromEighths([
  O, _, M, O, _, M, _, O,
  O, _, M, O, _, M, O, _,
])

// --- Güiro ---
// One-shots: open = scrape largo, mute = tic. Nunca llenar cada 16n.
const GUIRO_SALSA = fromEighths([
  O, _, _, M, O, _, M, _,
  O, _, _, M, O, _, M, _,
])

const GUIRO_MONTUNO = fromEighths([
  O, _, M, M, _, _, O, _,
  O, _, M, M, _, _, O, _,
])

const GUIRO_CHACHA = fromEighths([
  O, _, M, _, O, _, M, _,
  O, _, M, _, O, _, M, _,
])

// --- Campana (10 variaciones: básica → timba) ---
/** Mouth (mute) on offbeat clusters; bell (open) on downs */
function campanaArticulate(step: number, bits: Array<0 | 1>): HitKind {
  if (!bits[step]) return 'open'
  const sub = step % 4
  // Consecutive 16ths → alternate mouth / bell for roll feel
  const prev = step > 0 && bits[step - 1]
  if (prev && sub !== 0) return 'mute'
  if (sub === 3) return 'mute'
  return 'open'
}

function campanaFrom(
  bits: Array<0 | 1>,
  articulate?: (step: number) => HitKind,
): Hit[] {
  return fromBinary(
    bits,
    articulate ?? ((step) => campanaArticulate(step, bits)),
  )
}

function campanaPair(bits23: Array<0 | 1>, articulate?: (step: number) => HitKind) {
  const p23 = campanaFrom(bits23, articulate)
  return { '2-3': p23, '3-2': swapBars(p23) }
}

// 1. Corcheas estables (principiantes)
const CAMPANA_CORCHEAS = campanaFrom(
  [
    1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
  ],
  () => 'open',
)

/**
 * Mambo Bell clásico (2-3) — "tu, tucu tu, tucu tu, tucu tu ti tu"
 * Compás 1 = lado 2 · Compás 2 = lado 1 (golpe fuerte en 5)
 * open = "tu/ti" · mute = "cu" de los tucu
 */
const CAMPANA_MAMBO_BITS_23: Array<0 | 1> = [
  0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0,
  1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0,
]
function campanaMamboArticulate(step: number): HitKind {
  // "cu" de los tucu = boca (mute) en la semicorchea 'a'
  return step % 4 === 3 ? 'mute' : 'open'
}
const CAMPANA_MAMBO_23 = fromBinary(
  CAMPANA_MAMBO_BITS_23,
  campanaMamboArticulate,
)
const CAMPANA_MAMBO = {
  '2-3': CAMPANA_MAMBO_23,
  '3-2': swapBars(CAMPANA_MAMBO_23),
}

// 3. Martillo: sí va a corcheas (nombre = constante), con boca en &
const CAMPANA_MARTILLO = fromEighths([
  O, M, O, M, O, M, O, M,
  O, M, O, M, O, M, O, M,
])

// 4. Síncopa básica (montuno) — con huecos
const CAMPANA_SYNC_23 = fromEighths([
  O, _, _, O, _, O, _, _,
  O, _, _, O, _, O, _, O,
])
const CAMPANA_SYNC = {
  '2-3': CAMPANA_SYNC_23,
  '3-2': swapBars(CAMPANA_SYNC_23),
}

// 5. Mambo + ponche en coros — mismo esqueleto, remate más marcado
const CAMPANA_PONCHE_23 = fromEighths([
  O, _, _, _, O, _, _, M,
  O, _, O, _, O, M, O, _,
])
const CAMPANA_PONCHE = {
  '2-3': CAMPANA_PONCHE_23,
  '3-2': swapBars(CAMPANA_PONCHE_23),
}

// 6–10: variaciones avanzadas CON AIRE (los dumps 16n sonaban a metrónomo)
const CAMPANA_DOBLE = fromEighths([
  O, _, O, M, _, O, _, O,
  O, _, O, M, _, O, _, O,
])

const CAMPANA_TIMBA = fromEighths([
  O, M, _, O, _, M, O, _,
  O, _, O, M, _, O, _, M,
])

const CAMPANA_ROLLS = campanaFrom([
  1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0,
  1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0,
])

const CAMPANA_ULTRA = fromEighths([
  O, _, _, O, _, M, _, O,
  O, _, M, _, _, O, _, M,
])

const CAMPANA_FUERTE = fromEighths([
  O, _, O, _, O, M, O, _,
  O, _, O, M, _, O, _, O,
])

// On-beat negras — útil para practicar encima de la clave
const CAMPANA_ONBEAT = fromEighths([
  O, _, _, _, O, _, _, _,
  O, _, _, _, O, _, _, _,
])

// --- Bajo ---
// Anticipado auténtico: 2& → 4, 6& → 8 — "bom … bun"
const BAJO_ANTICIPADO = fromEighths([
  _, _, _, O, _, _, M, _,
  _, _, _, O, _, _, S, _,
])

const BAJO_BOMBO = fromEighths([
  _, _, _, O, _, _, O, _,
  _, _, M, _, _, _, O, _,
])

// Practice: mark 4 and 8
const BAJO_SIMPLE = fromEighths([
  _, _, _, _, _, _, O, _,
  _, _, _, _, _, _, O, _,
])

// Even quarters (variation) — "tum tum tum tum" on 2/4/6/8
const BAJO_PULSO = fromBinary(
  [
    0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
  ],
  () => 'open',
)

export const INSTRUMENTS: InstrumentConfig[] = [
  {
    id: 'clave',
    name: 'Clave',
    description: 'El pulso guía de la salsa',
    image: '/images/clave.svg',
    samples: {
      open: '/samples/clave-open.wav',
      mute: '/samples/clave-mute.wav',
    },
    subdivision: '16n',
    isClave: true,
    fx: { reverbWet: 0.1, filterFreq: 9000 },
    rhythms: [
      {
        id: 'son',
        name: 'Son',
        level: 'intermediate',
        vocalization: 'pa — pa — pa / pa — pa',
        description: 'Son clave (2-3 / 3-2 del transport)',
        claveAware: true,
        patterns: { '2-3': CLAVE_23, '3-2': CLAVE_32 },
      },
      {
        id: 'rumba',
        name: 'Rumba',
        level: 'advanced',
        vocalization: 'pa — pa — pa-á / pa — pa',
        description: 'Rumba clave — 3er golpe del lado de 3 atrasado',
        claveAware: true,
        patterns: { '2-3': RUMBA_23, '3-2': RUMBA_32 },
      },
    ],
  },
  {
    id: 'conga',
    name: 'Congas',
    description: 'La marcha del tumbao',
    image: '/images/conga.svg',
    samples: {
      open: '/samples/conga-open.wav',
      mute: '/samples/conga-mute.wav',
      slap: '/samples/conga-slap.wav',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.16, filterFreq: 4500 },
    rhythms: [
      {
        id: 'basic',
        name: 'Básico',
        level: 'beginner',
        vocalization: 'pa …… cum',
        description: 'Solo slap en 2/6 y un open en 4/8',
        patterns: { default: CONGA_BASIC },
      },
      {
        id: 'tumbao',
        name: 'Tumbao',
        level: 'intermediate',
        vocalization: 'pa … cu-cum',
        description: 'Tumbao clásico: slap en 2/6, cu-cum (2 opens) en 4/8',
        patterns: { default: CONGA_TUMBAO },
      },
      {
        id: 'tumbao-lleno',
        name: 'Tumbao + mute',
        level: 'intermediate',
        vocalization: 'ti-pa … cu-cum',
        description: 'Tumbao con mute de apoyo antes del slap',
        patterns: { default: CONGA_TUMBAO_FULL },
      },
      {
        id: 'marcha',
        name: 'Marcha',
        level: 'intermediate',
        vocalization: 'ta · ta · pam · ta',
        description: 'Marcha más abierta y ligera',
        patterns: { default: CONGA_MARCHA },
      },
      {
        id: 'bombo',
        name: 'Bombo',
        level: 'advanced',
        vocalization: '… bom … cu-cum',
        description: 'Énfasis tipo bombo en el segundo compás',
        patterns: { default: CONGA_BOMBO },
      },
      {
        id: 'guaguanco',
        name: 'Guaguancó',
        level: 'advanced',
        vocalization: 'pam · cu-cum … pam · cu-cum',
        description: 'Frases folklóricas con aire (no relleno)',
        patterns: { default: CONGA_ADVANCED },
      },
    ],
  },
  {
    id: 'maracas',
    name: 'Maracas',
    description: 'Shaker constante o sincopado',
    image: '/images/maracas.svg',
    samples: {
      open: '/samples/maracas-open.wav?v=beads2',
      mute: '/samples/maracas-mute.wav?v=beads2',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.04, filterFreq: 18000 },
    rhythms: [
      {
        id: 'bolero',
        name: 'Bolero',
        level: 'beginner',
        vocalization: 'chin …… chin',
        description: 'Más espaciado, feel lento',
        patterns: { default: MARACAS_BOLERO },
      },
      {
        id: 'constante',
        name: 'Constante',
        level: 'intermediate',
        vocalization: 'chi-quin chi-quin',
        description: 'Shake a corcheas (ida/vuelta)',
        patterns: { default: MARACAS_CONSTANTE },
      },
      {
        id: 'sincopa',
        name: 'Síncopa',
        level: 'intermediate',
        vocalization: 'chin · quin-chin',
        description: 'Patrón sincopado tipo cáscara',
        patterns: { default: MARACAS_SINCOPA },
      },
      {
        id: 'sync-densa',
        name: 'Síncopa densa',
        level: 'advanced',
        vocalization: 'chi-chi-quin chi-chi-quin',
        description: 'Variación sincopada más llena',
        patterns: { default: MARACAS_SYNC },
      },
    ],
  },
  {
    id: 'guiro',
    name: 'Güiro',
    description: 'Raspados de salsa y cha-cha',
    image: '/images/guiro.svg',
    samples: {
      open: '/samples/guiro-open.wav?v=ridges2',
      mute: '/samples/guiro-mute.wav?v=ridges2',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.1, filterFreq: 12000 },
    rhythms: [
      {
        id: 'cha-cha',
        name: 'Cha-cha',
        level: 'beginner',
        vocalization: 'ras · ras · ras · ras',
        description: 'Alternancia regular cha-cha-chá',
        patterns: { default: GUIRO_CHACHA },
      },
      {
        id: 'salsa',
        name: 'Salsa',
        level: 'intermediate',
        vocalization: 'raaaas · tic · raaas · tic',
        description: 'Largo en 1/5, cortos en el medio',
        patterns: { default: GUIRO_SALSA },
      },
      {
        id: 'montuno',
        name: 'Montuno',
        level: 'advanced',
        vocalization: 'ras-ti-ki ras-ti-ki',
        description: 'Raspado más lleno para el montuno',
        patterns: { default: GUIRO_MONTUNO },
      },
    ],
  },
  {
    id: 'campana',
    name: 'Campana',
    description: 'Campaneo de mambo',
    image: '/images/campana.svg',
    samples: {
      open: '/samples/campana-open.wav?v=vcsl2',
      mute: '/samples/campana-mute.wav?v=vcsl2',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.1, filterFreq: 14000 },
    rhythms: [
      {
        id: 'onbeat',
        name: 'Negras',
        level: 'beginner',
        vocalization: 'ting · ting · ting · ting',
        description: 'Solo 1, 3, 5 y 7 — para pillar el pulso',
        patterns: { default: CAMPANA_ONBEAT },
      },
      {
        id: 'corcheas',
        name: 'Corcheas',
        level: 'beginner',
        vocalization: 'ting-ting ting-ting',
        description: 'On-beat a corcheas (la más simple y usada)',
        patterns: { default: CAMPANA_CORCHEAS },
      },
      {
        id: 'mambo',
        name: 'Mambo',
        level: 'intermediate',
        vocalization: 'tu, tucu tu, tucu tu, tucu tu ti tu',
        description: 'Mambo Bell clásico de montuno (lado 2 + golpe fuerte en 5)',
        claveAware: true,
        patterns: CAMPANA_MAMBO,
      },
      {
        id: 'martillo-bell',
        name: 'Martillo',
        level: 'beginner',
        vocalization: 'ting-tak ting-tak',
        description: 'Corcheas constantes campana/boca (sí va lleno)',
        patterns: { default: CAMPANA_MARTILLO },
      },
      {
        id: 'sync',
        name: 'Síncopa',
        level: 'intermediate',
        vocalization: 'ting · · ting · ting',
        description: 'Síncopa de montuno con huecos',
        claveAware: true,
        patterns: CAMPANA_SYNC,
      },
      {
        id: 'ponche',
        name: 'Ponche',
        level: 'intermediate',
        vocalization: 'TING · TING-tak / ting ting ting-TAK ting',
        description: 'Mambo con ponche en el remate',
        claveAware: true,
        patterns: CAMPANA_PONCHE,
      },
      {
        id: 'doble',
        name: 'Doble',
        level: 'intermediate',
        vocalization: 'ting-ki-ting ting-ki-ting',
        description: 'Doble campana — muy chula',
        patterns: { default: CAMPANA_DOBLE },
      },
      {
        id: 'timba',
        name: 'Timba',
        level: 'advanced',
        vocalization: 'ti-ki-ri-ki ti-ki-ri-ki',
        description: 'Síncopa avanzada (timba / salsa dura)',
        patterns: { default: CAMPANA_TIMBA },
      },
      {
        id: 'rolls',
        name: 'Rolls',
        level: 'advanced',
        vocalization: 'ting-ki-ri ting-ki-ri-ri',
        description: 'Con rolls — ideal para solos',
        patterns: { default: CAMPANA_ROLLS },
      },
      {
        id: 'ultra',
        name: 'Ultra',
        level: 'advanced',
        vocalization: 'ting ti-ki-ri ting',
        description: 'Ultra sincopada (estilo moderno / timba)',
        patterns: { default: CAMPANA_ULTRA },
      },
      {
        id: 'fuerte',
        name: 'Fuerte',
        level: 'advanced',
        vocalization: 'ti-ki-ri-ki-ri-ki',
        description: 'La más densa — secciones fuertes',
        patterns: { default: CAMPANA_FUERTE },
      },
    ],
  },
  {
    id: 'bajo',
    name: 'Bajo',
    description: 'Tumbao del bajo salsero',
    image: '/images/bajo.svg',
    samples: {
      open: '/samples/bajo-open.wav',
      mute: '/samples/bajo-mute.wav',
      slap: '/samples/bajo-slap.wav',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.1, filterFreq: 4200 },
    rhythms: [
      {
        id: 'simple',
        name: 'Simple',
        level: 'beginner',
        vocalization: '…… bom …… bom',
        description: 'Solo marca 4 y 8 — ideal para practicar',
        patterns: { default: BAJO_SIMPLE },
      },
      {
        id: 'pulso',
        name: 'Pulso',
        level: 'beginner',
        vocalization: 'tum · tum · tum · tum',
        description: 'Negras en 2, 4, 6 y 8',
        patterns: { default: BAJO_PULSO },
      },
      {
        id: 'anticipado',
        name: 'Anticipado',
        level: 'intermediate',
        vocalization: '… bom … bun',
        description: 'Tumbao anticipado: 2&→4 y 6&→8',
        patterns: { default: BAJO_ANTICIPADO },
      },
      {
        id: 'bombo',
        name: 'Con bombo',
        level: 'advanced',
        vocalization: '… bom … ba-bom',
        description: 'Anticipado con énfasis tipo bombo',
        patterns: { default: BAJO_BOMBO },
      },
    ],
  },
  {
    id: 'bongo',
    name: 'Bongós',
    description: 'El martillo del bongosero',
    image: '/images/bongo.svg',
    samples: {
      open: '/samples/bongo-open.wav',
      mute: '/samples/bongo-mute.wav',
      slap: '/samples/bongo-slap.wav',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.12, filterFreq: 6500 },
    rhythms: [
      {
        id: 'martillo',
        name: 'Martillo',
        level: 'beginner',
        vocalization: 'ti-ki ti-ki ti-ki ti-SLAP',
        description: 'Martillo a corcheas con slap en 4& / 8&',
        patterns: { default: BONGO_MARTILLO },
      },
      {
        id: 'martillo-acentos',
        name: 'Con acentos',
        level: 'intermediate',
        vocalization: 'ti-ki · ki-ti ti-ki ti-SLAP',
        description: 'Martillo con síncopas y acentos',
        patterns: { default: BONGO_INTER },
      },
      {
        id: 'cerrado',
        name: 'Cerrado',
        level: 'intermediate',
        vocalization: 'ki-ki-ki-ki ti-SLAP',
        description: 'Más muted, groove contenido',
        patterns: { default: BONGO_CERRADO },
      },
      {
        id: 'repique',
        name: 'Repique',
        level: 'advanced',
        vocalization: 'ti-ki-ri-ki ti-ki-ri-ki',
        description: 'Repique denso para el mambo',
        patterns: { default: BONGO_REPIQUE },
      },
    ],
  },
  {
    id: 'timbale',
    name: 'Timbales',
    description: 'Cáscara y paila',
    image: '/images/timbale.svg',
    samples: {
      open: '/samples/timbale-open.wav',
      mute: '/samples/timbale-mute.wav',
      slap: '/samples/timbale-slap.wav',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.18, filterFreq: 7500 },
    rhythms: [
      {
        id: 'cascara',
        name: 'Cáscara',
        level: 'beginner',
        vocalization: 'ca-sca-ra ca-sca',
        description: 'Cáscara básica alineada a la clave',
        claveAware: true,
        patterns: { '2-3': CASCARA_23, '3-2': CASCARA_32 },
      },
      {
        id: 'cascara-doble',
        name: 'Cáscara doble',
        level: 'advanced',
        vocalization: 'ca-ca-sca-ra ca-sca',
        description: 'Más densa, para secciones calientes',
        claveAware: true,
        patterns: { '2-3': CASCARA_DOBLE_23, '3-2': CASCARA_DOBLE_32 },
      },
      {
        id: 'paila',
        name: 'Paila',
        level: 'intermediate',
        vocalization: 'tin · ta-ki tin · ta-ki',
        description: 'Paila con redoble / acentos',
        claveAware: true,
        patterns: { '2-3': PAILA_23, '3-2': PAILA_32 },
      },
    ],
  },
]

export const INSTRUMENT_BY_ID = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i]),
) as Record<string, InstrumentConfig>

export function defaultRhythmId(instrument: InstrumentConfig): string {
  const mid = instrument.rhythms.find((r) => r.level === 'intermediate')
  return mid?.id ?? instrument.rhythms[0]?.id ?? 'default'
}

export function getRhythm(
  instrument: InstrumentConfig,
  rhythmId: string,
): RhythmDef {
  return (
    instrument.rhythms.find((r) => r.id === rhythmId) ?? instrument.rhythms[0]
  )
}

export function resolvePattern(
  instrument: InstrumentConfig,
  claveDirection: ClaveDirection,
  rhythmId: string,
): Hit[] {
  const rhythm = getRhythm(instrument, rhythmId)
  if (!rhythm) return empty()
  if (rhythm.claveAware) {
    return (
      rhythm.patterns[claveDirection] ??
      rhythm.patterns.default ??
      empty()
    )
  }
  return rhythm.patterns.default ?? empty()
}

export function defaultSelectedRhythms(): Record<string, string> {
  return Object.fromEntries(
    INSTRUMENTS.map((i) => [i.id, defaultRhythmId(i)]),
  )
}

export function hitsOnCounts(pattern: Hit[]): number[] {
  const counts: number[] = []
  pattern.forEach((hit, step) => {
    if (hit === 0) return
    const beat = Math.floor(step / 4) + 1
    const and = step % 4 === 2
    counts.push(and ? beat + 0.5 : beat)
  })
  return counts
}
