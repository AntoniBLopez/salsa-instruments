export type HitKind = 'open' | 'mute' | 'slap'
/** Pitched hit — `pitch` = semitones from the instrument root sample (bajo open = C2) */
export type SoundHit = { kind: HitKind; pitch?: number }
export type Hit = 0 | HitKind | SoundHit
export type ClaveDirection = '3-2' | '2-3'
export type RhythmLevel = 'beginner' | 'intermediate' | 'advanced'

export function isRest(hit: Hit): hit is 0 {
  return hit === 0
}

export function hitKind(hit: Exclude<Hit, 0>): HitKind {
  return typeof hit === 'string' ? hit : hit.kind
}

/** Semitones from root sample; 0 if unpitched / percussion */
export function hitPitch(hit: Exclude<Hit, 0>): number {
  return typeof hit === 'string' ? 0 : (hit.pitch ?? 0)
}

/** Pitch-class label relative to C (root sample) */
export function pitchName(semitones: number): string {
  const names = [
    'C',
    'C#',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'G',
    'Ab',
    'A',
    'Bb',
    'B',
  ]
  const pc = ((semitones % 12) + 12) % 12
  const oct = Math.floor(semitones / 12)
  const base = names[pc]!
  if (oct === 0) return base
  if (oct > 0) return base + "'".repeat(oct)
  return base + ','.repeat(-oct)
}

function note(pitch: number, kind: HitKind = 'open'): SoundHit {
  return { kind, pitch }
}

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
  /**
   * Family id for nested UI (e.g. all mambo variations share group "mambo").
   * Ungrouped rhythms appear as top-level chips.
   */
  group?: string
  /** Label shown on the parent chip for this group (set on every member) */
  groupLabel?: string
  /** Selecting this rhythm also sets the global clave direction (cáscara, mambo…) */
  setsClaveDirection?: ClaveDirection
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
// Contraste open / mute / slap + huecos reales. El open (~420 ms) necesita
// aire después — no corcheas seguidas de opens.
// Corcheas → fromEighths (golpe en el primer step de cada corchea).

/** #1 Tumbao básico — solo abiertos en 2 y 4 */
const CONGA_BASICO = fromEighths([
  _, _, O, _, _, _, O, _,
  _, _, O, _, _, _, O, _,
])

/**
 * Tumbao Uribe: slap en 2/6 (“pa”) + dos opens en 4/4& (“cu-cum”)
 */
const CONGA_URIBE = fromEighths([
  _, _, S, _, _, _, O, O,
  _, _, S, _, _, _, O, O,
])

/**
 * Tumbao estándar (el más habitual en salsa dura):
 * “cu-cum-pa” cada 2 tiempos — O O S _ × 4
 */
const CONGA_ESTANDAR = fromEighths([
  O, O, S, _, O, O, S, _,
  O, O, S, _, O, O, S, _,
])

const CONGA_TUMBAO_GROUP = 'tumbao'
const CONGA_TUMBAO_GROUP_LABEL = 'Tumbao'

function congaTumbaoRhythm(
  id: string,
  name: string,
  level: RhythmLevel,
  description: string,
  pattern: Hit[],
  vocalization?: string,
): RhythmDef {
  return {
    id,
    name,
    level,
    description,
    vocalization,
    group: CONGA_TUMBAO_GROUP,
    groupLabel: CONGA_TUMBAO_GROUP_LABEL,
    patterns: { default: pattern },
  }
}

/** #2 Tumbao con tapado — M anticipa el open */
const CONGA_TAPADO = fromEighths([
  _, M, O, _, _, M, O, _,
  _, M, O, _, _, M, O, _,
])

/** #3 Tumbao con slap de cierre — empuje al 1 siguiente */
const CONGA_SLAP = fromEighths([
  _, _, O, _, _, _, O, S,
  _, _, O, _, _, _, O, S,
])

/** #4 Tumbao completo — tapado + abierto + slap (orquesta) */
const CONGA_COMPLETO = fromEighths([
  _, M, O, _, _, M, O, S,
  _, M, O, _, _, M, O, S,
])

/** #5 Songo — open adelantado al & de 1 */
const CONGA_SONGO = fromEighths([
  _, O, _, M, _, _, O, S,
  _, O, _, M, _, _, O, S,
])

/** #6 Guaguancó ligero — conversación de tapados sin saturar */
const CONGA_GUAGUANCO = fromEighths([
  M, _, O, M, _, M, O, _,
  M, _, O, M, _, M, O, _,
])

/** #7 Timba — solo secciones fuertes */
const CONGA_TIMBA = fromEighths([
  M, O, _, M, O, _, O, S,
  M, O, _, M, O, _, O, S,
])

/** #8 Relleno / cierre — solo 1–2 compases antes de un corte */
const CONGA_RELLENO = fromEighths([
  O, M, O, M, O, M, O, S,
  _, _, O, _, _, _, O, S,
])

// --- Bongós ---
// Sonidos: open = macho (agudo), mute = macho tapado, slap = HEMBRA (grave).
/**
 * Martillo auténtico ("dicky-docky-dicky-DUM-ky"):
 * corcheas constantes en el macho, y el golpe del tiempo 4 (y 8)
 * es el open del tambor GRAVE (hembra) — el "dum" característico.
 */
const BONGO_MARTILLO = fromEighths([
  O, M, M, M, O, M, S, M,
  O, M, M, M, O, M, S, M,
])

/** Martillo con acentos: mismo esqueleto con síncopas ligeras */
const BONGO_INTER = fromEighths([
  O, M, _, M, O, _, S, M,
  O, M, M, _, O, M, S, _,
])

/** Repique: frases con aire para el mambo */
const BONGO_REPIQUE = fromEighths([
  O, _, O, M, _, _, S, _,
  O, M, _, _, O, _, S, O,
])

/** Cerrado: mutes contenidos + hembra en 4/8 */
const BONGO_CERRADO = fromEighths([
  M, _, M, _, M, _, S, _,
  M, _, M, _, M, _, S, _,
])

// --- Timbales ---
/**
 * Cáscara auténtica (2-3), toda en corcheas:
 *   lado 2: 1, 2, 3, 3&, 4&
 *   lado 3: 1, 2, 2&, 3&, 4&
 * open = acento (negras) · mute = golpe suave (contratiempos)
 */
const CASCARA_23 = fromEighths([
  O, _, O, _, O, M, _, M,
  O, _, O, M, _, M, _, M,
])
const CASCARA_32 = swapBars(CASCARA_23)

/** Cáscara a dos manos: corcheas llenas, acentos = la cáscara de arriba */
const CASCARA_DOBLE_23 = fromEighths([
  O, M, O, M, O, O, M, O,
  O, M, O, O, M, O, M, O,
])
const CASCARA_DOBLE_32 = swapBars(CASCARA_DOBLE_23)

/** Paila: cáscara con 4/4& añadidos (variante más llena) */
const PAILA_23 = fromEighths([
  O, _, O, _, O, M, O, M,
  O, _, O, M, O, M, O, M,
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
// El güiro es continuo: la frase viene de largo/corto, no de vaciar el grid.
// 2 = open (largo / bajada "chek") · 1 = mute (corto / subida "chik") · 0 = silencio
function fromGuiroGrid(bits: Array<0 | 1 | 2>): Hit[] {
  if (bits.length !== CYCLE_STEPS) {
    throw new Error(`Güiro pattern must have ${CYCLE_STEPS} steps, got ${bits.length}`)
  }
  return bits.map((b) => (b === 2 ? O : b === 1 ? M : _))
}

/** Motor con aire — variación por defecto */
export const GUIRO_DEFAULT_ID = 'guiro-1'

function guiroRhythm(
  id: string,
  name: string,
  level: RhythmLevel,
  description: string,
  bits: Array<0 | 1 | 2>,
  vocalization?: string,
): RhythmDef {
  return {
    id,
    name,
    level,
    description,
    vocalization,
    patterns: { default: fromGuiroGrid(bits) },
  }
}

const GUIRO_RHYTHMS: RhythmDef[] = [
  guiroRhythm(
    'guiro-1',
    'Son básico',
    'beginner',
    'Motor con aire: corto solo en el “y” de 2 y 4 (silencio en el “y” de 1 y 3)',
    [
      // 8ths → 16n: [2,0,2,1, 2,0,2,1] × 2
      2, 0, 0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 1, 0, 2,
      0, 0, 0, 2, 0, 1, 0,
    ],
    'chek · chek-chik  chek · chek-chik',
  ),
  guiroRhythm(
    'guiro-minimal',
    'Son mínimo',
    'beginner',
    'Solo negras (largo) — motor más ligero / tradicional',
    [
      // negras en 16n: open cada 4 pasos
      2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2,
      0, 0, 0, 2, 0, 0, 0,
    ],
    'chek chek chek chek',
  ),
  guiroRhythm(
    'guiro-tresillo',
    'A tresillo',
    'beginner',
    'Montado al Mambo Básico — célula corto-corto-largo (ta-ta-tun)',
    [
      1, 0, 1, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0, 0, 1,
      0, 1, 0, 2, 0, 0, 0,
    ],
    'chi-chi-CHEK chi-chi-CHEK chi-chi-CHEK chi-chi-CHEK',
  ),
  guiroRhythm(
    'guiro-2',
    'Son marcado',
    'beginner',
    'Acento claro (largo) en 1 y 3 de cada compás',
    [
      2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2,
      0, 1, 0, 1, 0, 1, 0,
    ],
    'CHEK-chik chek-chik CHEK-chik chek-chik',
  ),
  guiroRhythm(
    'guiro-3',
    'Guaracha',
    'intermediate',
    'Doble corto — más movido',
    [
      2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2,
      0, 1, 1, 2, 0, 1, 0,
    ],
    'chek-chi-chik chek-chik',
  ),
  guiroRhythm(
    'guiro-4',
    'Chachachá',
    'intermediate',
    'Silencio en el 4 — respiración de frase',
    [
      2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2,
      0, 1, 0, 0, 0, 0, 0,
    ],
    'chek-chik chek-chik chek-chik …(aire)',
  ),
  guiroRhythm(
    'guiro-5',
    'Songo',
    'intermediate',
    'Sincopado con aire estratégico',
    [
      2, 0, 1, 0, 0, 1, 2, 0, 1, 0, 0, 0, 2, 0, 1, 0, 2, 0, 1, 0, 0, 1, 2, 0, 1,
      0, 0, 0, 2, 0, 1, 0,
    ],
    'chek-chik · chik-chek chik · chek-chik',
  ),
  guiroRhythm(
    'guiro-6',
    'Ponche',
    'intermediate',
    'Acentos largos alineados con el ponche',
    [
      2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2,
      0, 2, 0, 1, 0, 1, 0,
    ],
    'chek-chik chek-chik CHEK-CHEK chek-chik',
  ),
  guiroRhythm(
    'guiro-7',
    'Descarga',
    'advanced',
    'Redoble corto de adorno',
    [
      2, 0, 1, 1, 1, 0, 1, 0, 2, 0, 1, 1, 1, 0, 1, 0, 2, 0, 1, 1, 1, 0, 1, 0, 2,
      0, 1, 1, 1, 0, 1, 0,
    ],
    'chek-chik-a chek-chik',
  ),
  guiroRhythm(
    'guiro-8',
    'Timba',
    'advanced',
    'Síncopa moderna con huecos deliberados',
    [
      2, 0, 0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 1, 0, 2, 0, 1,
      0, 0, 0, 2, 0, 1, 0,
    ],
    'chek · chik-chek · chik · chek-chik',
  ),
  guiroRhythm(
    'guiro-9',
    'Coro / Break',
    'advanced',
    'Más abierto — deja respirar el coro',
    [
      2, 0, 1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 2,
      0, 1, 0, 0, 0, 0, 0,
    ],
    'chek-chik …(aire) chek-chik …(aire)',
  ),
  guiroRhythm(
    'guiro-10',
    'Relleno / Cierre',
    'advanced',
    'Recargado — solo para finales de frase / cortes (aire tras cada open)',
    [
      2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2,
      0, 1, 1, 2, 0, 1, 0,
    ],
    'chek · chi-chik chek-chik',
  ),
]

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

/**
 * Mambo variations as 16 eighth-notes (2 bars).
 * NEVER dump raw 16n grids — one-shots need phrasing + air.
 * M = "ta" (boca) · O = "tun" (campana abierta) · _ = silencio
 */
function mamboPair(eighths: Hit[]): RhythmPatterns {
  if (eighths.length !== 16) {
    throw new Error(`Mambo pattern needs 16 eighths, got ${eighths.length}`)
  }
  const p23 = fromEighths(eighths)
  return { '2-3': p23, '3-2': swapBars(p23) }
}

// Corcheas / negras / martillo (fuera del grupo Mambo)
const CAMPANA_CORCHEAS = campanaFrom(
  [
    1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
  ],
  () => 'open',
)

const CAMPANA_MARTILLO = fromEighths([
  O, M, O, M, O, M, O, M,
  O, M, O, M, O, M, O, M,
])

const CAMPANA_ONBEAT = fromEighths([
  O, _, _, _, O, _, _, _,
  O, _, _, _, O, _, _, _,
])

/**
 * Célula "tata-tun" = M M O _  (ta ta tun ·)
 * Estándar = 3× tata-tun + ta-tun (M _ O _)
 */
const MAMBO_1 = mamboPair([
  // Básico: tata-tun × 4 (simétrico, fácil de pillar)
  M, M, O, _, M, M, O, _,
  M, M, O, _, M, M, O, _,
])
const MAMBO_2 = mamboPair([
  // Estándar clásico — EL que tiene que sonar a "tata-tun…"
  M, M, O, _, M, M, O, _,
  M, M, O, _, M, _, O, _,
])
const MAMBO_3 = mamboPair([
  // Ponche: estándar + remate doble abierto
  M, M, O, _, M, M, O, _,
  M, M, O, _, M, O, O, _,
])
const MAMBO_4 = mamboPair([
  // Sincopado (montuno): huecos y acentos desplazados
  M, _, O, M, _, O, _, _,
  M, _, _, O, M, O, _, O,
])
const MAMBO_5 = mamboPair([
  // Doble: más energía, pero sigue habiendo aire tras cada tun
  M, M, O, M, M, M, O, _,
  M, M, O, M, M, _, O, _,
])
const MAMBO_6 = mamboPair([
  // Rolls: tres bocas → tun
  M, M, M, O, _, M, M, O,
  M, M, M, O, _, M, _, O,
])
const MAMBO_7 = mamboPair([
  // Timba: síncopa moderna con aire
  M, _, O, M, O, _, M, _,
  O, M, _, O, _, M, O, _,
])
const MAMBO_8 = mamboPair([
  // Complejo: frases cruzadas
  M, M, O, _, M, O, M, O,
  M, M, O, M, _, O, _, O,
])
const MAMBO_9 = mamboPair([
  // Aceleración: 1ª mitad estándar, 2ª más llena
  M, M, O, _, M, M, O, _,
  M, M, O, M, M, O, M, O,
])
const MAMBO_10 = mamboPair([
  // Máximo: denso pero en corcheas con frase tata-tun
  M, M, O, M, M, O, M, O,
  M, M, O, M, M, O, M, O,
])

const MAMBO_GROUP = 'mambo'
const MAMBO_GROUP_LABEL = 'Mambo'
/** Variación por defecto al abrir el grupo Mambo */
export const MAMBO_DEFAULT_ID = 'mambo-2'

function mamboRhythm(
  id: string,
  name: string,
  level: RhythmLevel,
  description: string,
  patterns: RhythmPatterns,
  vocalization?: string,
): RhythmDef {
  return {
    id,
    name,
    level,
    description,
    vocalization,
    claveAware: true,
    group: MAMBO_GROUP,
    groupLabel: MAMBO_GROUP_LABEL,
    patterns,
  }
}

const CAMPANA_MAMBO_RHYTHMS: RhythmDef[] = [
  mamboRhythm(
    'mambo-1',
    'Básico',
    'beginner',
    'tata-tun repetido — para pillar la frase',
    MAMBO_1,
    'tata-tun tata-tun tata-tun tata-tun',
  ),
  mamboRhythm(
    'mambo-2',
    'Estándar',
    'intermediate',
    'Mambo Bell clásico — 3× tata-tun + ta-tun',
    MAMBO_2,
    'tata-tun tata-tun tata-tun ta-tun',
  ),
  mamboRhythm(
    'mambo-3',
    'Ponche',
    'intermediate',
    'Estándar con ponche doble al final',
    MAMBO_3,
    'tata-tun tata-tun tata-tun ta-TUN-TUN',
  ),
  mamboRhythm(
    'mambo-4',
    'Sincopado',
    'intermediate',
    'Montuno sincopado con huecos',
    MAMBO_4,
    'ta · tun-ta · tun',
  ),
  mamboRhythm(
    'mambo-5',
    'Doble',
    'intermediate',
    'Más lleno, sigue la frase tata-tun',
    MAMBO_5,
    'tata-tun-ta tata-tun',
  ),
  mamboRhythm(
    'mambo-6',
    'Rolls',
    'advanced',
    'Roll de boca hacia el tun',
    MAMBO_6,
    'ta-ta-ta-TUN · tata-tun',
  ),
  mamboRhythm(
    'mambo-7',
    'Timba',
    'advanced',
    'Síncopa moderna tipo timba',
    MAMBO_7,
    'ta · tun-ta tun · ta',
  ),
  mamboRhythm(
    'mambo-8',
    'Complejo',
    'advanced',
    'Frases cruzadas',
    MAMBO_8,
    'tata-tun ta-tun-ta',
  ),
  mamboRhythm(
    'mambo-9',
    'Aceleración',
    'advanced',
    'Empieza estándar y aprieta en el 2º compás',
    MAMBO_9,
    'tata-tun tata-tun / tata-tun-ta-tun-ta-tun',
  ),
  mamboRhythm(
    'mambo-10',
    'Máximo',
    'advanced',
    'El más lleno — coros / mambo fuerte',
    MAMBO_10,
    'tata-tun-ta-tun tata-tun-ta-tun tata-tun-ta-tun tata-tun-ta-tun',
  ),
]

// --- Bajo (fraseo + pitches; open sample = C2) ---
// Criterio: dónde anticipas y con qué articulación resuelves (aire real).
// Corcheas → fromEighths (golpe en el primer step de cada corchea).
const C = 0
const D = 2
const G = 7

/** #1 Solo tónica en 4 y 8 */
const BAJO_SIMPLE = fromEighths([
  _, _, _, _, _, _, note(C), _,
  _, _, _, _, _, _, note(C), _,
])

/** #2 Pulso en los “&” (empuje constante sin llenar el 1) */
const BAJO_PULSO = fromEighths([
  _, note(C), _, note(C), _, note(C), _, note(C),
  _, note(C), _, note(C), _, note(C), _, note(C),
])

/**
 * #3 Anticipado — tumbao de manual: 2&→4, 6&→8
 * V anticipa, I resuelve (O / M / S)
 */
const BAJO_ANTICIPADO = fromEighths([
  _, _, _, note(G), _, _, note(C, 'mute'), _,
  _, _, _, note(G), _, _, note(C, 'slap'), _,
])

/** #4 Mismo esqueleto, slap de cierre en ambos compases */
const BAJO_ANTICIPADO_SLAP = fromEighths([
  _, _, _, note(G), _, _, note(C, 'slap'), _,
  _, _, _, note(G), _, _, note(C, 'slap'), _,
])

/**
 * #5 Con bombo — ancla en el 1 + anticipado
 * O(1) bombo · O(2&) · M/S(4)
 */
const BAJO_BOMBO = fromEighths([
  note(C), _, _, note(G), _, _, note(C, 'mute'), _,
  note(C), _, _, note(G), _, _, note(C, 'slap'), _,
])

/**
 * #6 Tumbao 2-3 — anticipa hacia el compás siguiente (&4 → 1 del loop)
 */
const BAJO_TUMBAO_23 = fromEighths([
  _, _, _, _, _, _, note(C, 'mute'), _,
  _, _, _, _, _, _, note(C), _,
])

/** #7 Songo — síncopa en el 2, aire en 1/3 */
const BAJO_SONGO = fromEighths([
  _, _, note(G, 'mute'), _, _, _, note(C), _,
  _, _, note(G, 'mute'), _, _, _, note(C, 'slap'), _,
])

/** #8 Timba — más movido; solo secciones fuertes */
const BAJO_TIMBA = fromEighths([
  _, note(G, 'mute'), _, note(G), _, _, note(C, 'mute'), _,
  _, note(D, 'mute'), _, note(D), _, _, note(G, 'slap'), _,
])

/**
 * #9 Descarga / relleno — solo breaks o final de frase
 * Compás 1 denso · compás 2 resuelve anticipado
 */
const BAJO_DESCARGA = fromEighths([
  note(C), _, note(G, 'mute'), note(C), _, note(G, 'mute'), note(C), _,
  _, _, _, note(G), _, _, note(C, 'slap'), _,
])

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
        id: 'son-23',
        name: '2-3',
        level: 'intermediate',
        vocalization: 'pa — pa / pa — pa — pa',
        description: 'Son clave empezando por el lado de 2',
        group: 'son',
        groupLabel: 'Son',
        setsClaveDirection: '2-3',
        patterns: { default: CLAVE_23 },
      },
      {
        id: 'son-32',
        name: '3-2',
        level: 'intermediate',
        vocalization: 'pa — pa — pa / pa — pa',
        description: 'Son clave empezando por el lado de 3',
        group: 'son',
        groupLabel: 'Son',
        setsClaveDirection: '3-2',
        patterns: { default: CLAVE_32 },
      },
      {
        id: 'rumba-23',
        name: '2-3',
        level: 'advanced',
        vocalization: 'pa — pa / pa — pa — pa-á',
        description: 'Rumba clave 2-3 (3er golpe del lado de 3 atrasado)',
        group: 'rumba',
        groupLabel: 'Rumba',
        setsClaveDirection: '2-3',
        patterns: { default: RUMBA_23 },
      },
      {
        id: 'rumba-32',
        name: '3-2',
        level: 'advanced',
        vocalization: 'pa — pa — pa-á / pa — pa',
        description: 'Rumba clave 3-2 (3er golpe del lado de 3 atrasado)',
        group: 'rumba',
        groupLabel: 'Rumba',
        setsClaveDirection: '3-2',
        patterns: { default: RUMBA_32 },
      },
    ],
  },
  {
    id: 'conga',
    name: 'Congas',
    description: 'Tumbao: open / mute / slap con aire',
    image: '/images/conga.svg',
    samples: {
      open: '/samples/conga-open.wav?v=vcsl1',
      mute: '/samples/conga-mute.wav?v=vcsl1',
      slap: '/samples/conga-slap.wav?v=vcsl1',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.16, filterFreq: 4500 },
    rhythms: [
      congaTumbaoRhythm(
        'tumbao-estandar',
        'Estándar',
        'beginner',
        'El más habitual: cu-cum-pa cada 2 tiempos (empieza en el 1)',
        CONGA_ESTANDAR,
        'cu-cum-pa cu-cum-pa',
      ),
      congaTumbaoRhythm(
        'tumbao-basico',
        'Básico',
        'beginner',
        'Esqueleto: solo abiertos (TUN) en 2 y 4 — silencio en 1 y 3',
        CONGA_BASICO,
        '· · TUN · · · TUN ·',
      ),
      congaTumbaoRhythm(
        'tumbao-uribe',
        'Uribe',
        'beginner',
        'Variante Uribe: slap en 2/6 + doble open en 4/4&',
        CONGA_URIBE,
        'pa … cu-cum',
      ),
      congaTumbaoRhythm(
        'completo',
        'Completo',
        'intermediate',
        'De disco: tapado anuncia el abierto + slap de cierre',
        CONGA_COMPLETO,
        '· ta-TUN · · ta-TUN-ke',
      ),
      {
        id: 'tapado',
        name: 'Con tapado',
        level: 'beginner',
        vocalization: 'ta-TUN … ta-TUN',
        description: 'Tapado anticipa el abierto — más “hablado”',
        patterns: { default: CONGA_TAPADO },
      },
      {
        id: 'slap-cierre',
        name: 'Slap de cierre',
        level: 'intermediate',
        vocalization: 'TUN …… TUN-ke',
        description: 'Abiertos en 2 y 4 + slap que empuja al 1 siguiente',
        patterns: { default: CONGA_SLAP },
      },
      {
        id: 'songo',
        name: 'Songo',
        level: 'advanced',
        vocalization: '· TUN · ta …… TUN-ke',
        description: 'Abierto adelantado al “y” de 1 — más movimiento',
        patterns: { default: CONGA_SONGO },
      },
      {
        id: 'guaguanco',
        name: 'Guaguancó',
        level: 'advanced',
        vocalization: 'ta · TUN-ta · ta-TUN',
        description: 'Conversación de tapados — ligero, sin saturar',
        patterns: { default: CONGA_GUAGUANCO },
      },
      {
        id: 'timba',
        name: 'Timba',
        level: 'advanced',
        vocalization: 'ta-TUN · ta-TUN · TUN-ke',
        description: 'Solo secciones fuertes — no de base',
        patterns: { default: CONGA_TIMBA },
      },
      {
        id: 'relleno',
        name: 'Relleno',
        level: 'advanced',
        vocalization: 'TUN-ta-TUN-ta-TUN-ta-TUN-ke · TUN …… TUN-ke',
        description: 'Cierre / break — 1–2 compases antes de un corte',
        patterns: { default: CONGA_RELLENO },
      },
    ],
  },
  {
    id: 'maracas',
    name: 'Maracas',
    description: 'Shaker constante o sincopado',
    image: '/images/maracas.svg',
    samples: {
      open: '/samples/maracas-open.wav?v=vcsl1',
      mute: '/samples/maracas-mute.wav?v=vcsl1',
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
    description: 'Motor continuo: largo (open) / corto (mute)',
    image: '/images/guiro.svg',
    samples: {
      open: '/samples/guiro-open.wav?v=fs1',
      mute: '/samples/guiro-mute.wav?v=fs1',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.1, filterFreq: 12000 },
    rhythms: [...GUIRO_RHYTHMS],
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
        vocalization: 'tun · tun · tun · tun',
        description: 'Solo 1, 3, 5 y 7 — para pillar el pulso',
        patterns: { default: CAMPANA_ONBEAT },
      },
      {
        id: 'corcheas',
        name: 'Corcheas',
        level: 'beginner',
        vocalization: 'tun-tun tun-tun',
        description: 'On-beat a corcheas (la más simple y usada)',
        patterns: { default: CAMPANA_CORCHEAS },
      },
      {
        id: 'martillo-bell',
        name: 'Martillo',
        level: 'beginner',
        vocalization: 'tun-ta tun-ta',
        description: 'Corcheas constantes campana/boca',
        patterns: { default: CAMPANA_MARTILLO },
      },
      ...CAMPANA_MAMBO_RHYTHMS,
    ],
  },
  {
    id: 'bajo',
    name: 'Bajo',
    description: 'Tumbao salsero con pitches (raíz = C)',
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
        description: 'Solo la tónica en 4 y 8 — referencia armónica',
        patterns: { default: BAJO_SIMPLE },
      },
      {
        id: 'pulso',
        name: 'Pulso',
        level: 'beginner',
        vocalization: '· tum · tum · tum · tum',
        description: 'Empuje en los “&” — sin llenar el 1',
        patterns: { default: BAJO_PULSO },
      },
      {
        id: 'anticipado',
        name: 'Anticipado',
        level: 'intermediate',
        vocalization: '… bom … bun',
        description: 'Tumbao de manual: anticipa en 2&/6&, resuelve en 4/8',
        patterns: { default: BAJO_ANTICIPADO },
      },
      {
        id: 'anticipado-slap',
        name: 'Ant. slap',
        level: 'intermediate',
        vocalization: '… bom … PAM',
        description: 'Mismo esqueleto con slap de cierre — más punch',
        patterns: { default: BAJO_ANTICIPADO_SLAP },
      },
      {
        id: 'bombo',
        name: 'Con bombo',
        level: 'intermediate',
        vocalization: 'bom · bom … bun',
        description: 'Anticipado + ancla grave en el 1 (orquesta real)',
        patterns: { default: BAJO_BOMBO },
      },
      {
        id: 'tumbao-23',
        name: 'Tumbao 2-3',
        level: 'intermediate',
        vocalization: '…… bun …… bom',
        description: 'Anticipa hacia el siguiente compás (&4 → 1 del loop)',
        patterns: { default: BAJO_TUMBAO_23 },
      },
      {
        id: 'songo',
        name: 'Songo',
        level: 'advanced',
        vocalization: '· bun · · bom',
        description: 'Síncopa en el 2 — aire en 1 y 3',
        patterns: { default: BAJO_SONGO },
      },
      {
        id: 'timba',
        name: 'Timba',
        level: 'advanced',
        vocalization: '· bun · bom · · PAM',
        description: 'Más movido — solo secciones fuertes, no como base',
        patterns: { default: BAJO_TIMBA },
      },
      {
        id: 'descarga',
        name: 'Descarga',
        level: 'advanced',
        vocalization: 'bom-bun-bom-bun-bom · · bom … PAM',
        description: 'Relleno / break — 1–2 compases antes de un corte',
        patterns: { default: BAJO_DESCARGA },
      },
    ],
  },
  {
    id: 'bongo',
    name: 'Bongós',
    description: 'El martillo del bongosero',
    image: '/images/bongo.svg',
    samples: {
      open: '/samples/bongo-open.wav?v=vcsl1',
      mute: '/samples/bongo-mute.wav?v=vcsl1',
      slap: '/samples/bongo-slap.wav?v=vcsl1',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.12, filterFreq: 6500 },
    rhythms: [
      {
        id: 'martillo',
        name: 'Martillo',
        level: 'beginner',
        vocalization: 'di-ki do-ki di-ki DUM-ki',
        description: 'Martillo auténtico: corcheas en el macho, hembra en 4/8',
        patterns: { default: BONGO_MARTILLO },
      },
      {
        id: 'martillo-acentos',
        name: 'Con acentos',
        level: 'intermediate',
        vocalization: 'di-ki · ki di · DUM-ki',
        description: 'Martillo con síncopas y acentos',
        patterns: { default: BONGO_INTER },
      },
      {
        id: 'cerrado',
        name: 'Cerrado',
        level: 'intermediate',
        vocalization: 'ki · ki · ki · DUM',
        description: 'Más muted, groove contenido',
        patterns: { default: BONGO_CERRADO },
      },
      {
        id: 'repique',
        name: 'Repique',
        level: 'advanced',
        vocalization: 'ti-ki-ri DUM ti-ki-ri DUM',
        description: 'Repique con aire para el mambo',
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
      open: '/samples/timbale-open.wav?v=vcsl1',
      mute: '/samples/timbale-mute.wav?v=vcsl1',
      slap: '/samples/timbale-slap.wav?v=vcsl1',
    },
    subdivision: '16n',
    fx: { reverbWet: 0.18, filterFreq: 7500 },
    rhythms: [
      {
        id: 'cascara',
        name: 'Cáscara',
        level: 'beginner',
        vocalization: 'ca · ca · ca-ca · ca / ca · ca-ca · ca-ca',
        description: 'Cáscara auténtica: lado 2 = 1,2,3,3&,4& · lado 3 = 1,2,2&,3&,4&',
        claveAware: true,
        patterns: { '2-3': CASCARA_23, '3-2': CASCARA_32 },
      },
      {
        id: 'paila',
        name: 'Paila',
        level: 'intermediate',
        vocalization: 'ca · ca · ca-ca ca-ca / ca · ca-ca ca-ca',
        description: 'Cáscara con el 4 y 4& añadidos (variante llena)',
        claveAware: true,
        patterns: { '2-3': PAILA_23, '3-2': PAILA_32 },
      },
      {
        id: 'cascara-doble',
        name: 'Cáscara 2 manos',
        level: 'advanced',
        vocalization: 'CA-ti-CA-ti-CA-CA-ti-CA',
        description: 'Corcheas llenas a dos manos: acentos = la cáscara',
        claveAware: true,
        patterns: { '2-3': CASCARA_DOBLE_23, '3-2': CASCARA_DOBLE_32 },
      },
    ],
  },
]

export const INSTRUMENT_BY_ID = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i]),
) as Record<string, InstrumentConfig>

/** Default Son variation (also drives global clave direction) */
export const SON_DEFAULT_ID = 'son-32'
/** Default Rumba variation */
export const RUMBA_DEFAULT_ID = 'rumba-32'
/** Default bajo — tumbao anticipado de manual */
export const BAJO_DEFAULT_ID = 'anticipado'
/** Default conga — tumbao estándar (cu-cum-pa) */
export const CONGA_DEFAULT_ID = 'tumbao-estandar'

export function defaultRhythmId(instrument: InstrumentConfig): string {
  if (instrument.id === 'campana') {
    const mambo = instrument.rhythms.find((r) => r.id === MAMBO_DEFAULT_ID)
    if (mambo) return mambo.id
  }
  if (instrument.id === 'clave') {
    const son = instrument.rhythms.find((r) => r.id === SON_DEFAULT_ID)
    if (son) return son.id
  }
  if (instrument.id === 'guiro') {
    const g = instrument.rhythms.find((r) => r.id === GUIRO_DEFAULT_ID)
    if (g) return g.id
  }
  if (instrument.id === 'bajo') {
    const b = instrument.rhythms.find((r) => r.id === BAJO_DEFAULT_ID)
    if (b) return b.id
  }
  if (instrument.id === 'conga') {
    const c = instrument.rhythms.find((r) => r.id === CONGA_DEFAULT_ID)
    if (c) return c.id
  }
  const mid = instrument.rhythms.find((r) => r.level === 'intermediate')
  return mid?.id ?? instrument.rhythms[0]?.id ?? 'default'
}

/** Top-level rhythm entries for the UI (ungrouped + one chip per group) */
export function topLevelRhythms(instrument: InstrumentConfig): Array<
  | { kind: 'rhythm'; rhythm: RhythmDef }
  | { kind: 'group'; group: string; label: string; members: RhythmDef[] }
> {
  const seen = new Set<string>()
  const out: Array<
    | { kind: 'rhythm'; rhythm: RhythmDef }
    | { kind: 'group'; group: string; label: string; members: RhythmDef[] }
  > = []
  for (const r of instrument.rhythms) {
    if (!r.group) {
      out.push({ kind: 'rhythm', rhythm: r })
      continue
    }
    if (seen.has(r.group)) continue
    seen.add(r.group)
    const members = instrument.rhythms.filter((x) => x.group === r.group)
    out.push({
      kind: 'group',
      group: r.group,
      label: r.groupLabel ?? r.group,
      members,
    })
  }
  return out
}

export function getRhythm(
  instrument: InstrumentConfig,
  rhythmId: string,
): RhythmDef {
  let id = rhythmId
  // Legacy ids from before grouped variations
  if (instrument.id === 'campana' && rhythmId === 'mambo') id = MAMBO_DEFAULT_ID
  if (instrument.id === 'clave' && rhythmId === 'son') id = SON_DEFAULT_ID
  if (instrument.id === 'clave' && rhythmId === 'rumba') id = RUMBA_DEFAULT_ID
  if (
    instrument.id === 'guiro' &&
    (rhythmId === 'cha-cha' || rhythmId === 'salsa' || rhythmId === 'montuno')
  ) {
    id = GUIRO_DEFAULT_ID
  }
  if (
    instrument.id === 'bajo' &&
    (rhythmId === 'tumbao' ||
      rhythmId === 'tumbao-iv' ||
      rhythmId === 'walking' ||
      rhythmId === 'montuno' ||
      rhythmId === 'octava')
  ) {
    id = BAJO_DEFAULT_ID
  }
  if (instrument.id === 'conga' && rhythmId === 'tumbao') id = 'tumbao-uribe'
  if (
    instrument.id === 'conga' &&
    (rhythmId === 'basico' || rhythmId === 'basic' || rhythmId === 'cucum')
  ) {
    id = rhythmId === 'cucum' ? 'tumbao-uribe' : 'tumbao-basico'
  }
  if (
    instrument.id === 'conga' &&
    (rhythmId === 'tumbao-lleno' ||
      rhythmId === 'marcha' ||
      rhythmId === 'bombo')
  ) {
    id = CONGA_DEFAULT_ID
  }
  return (
    instrument.rhythms.find((r) => r.id === id) ?? instrument.rhythms[0]
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

/** Label for a 16n step in the 1–8 count (e.g. 2, 6.5, 4e, 7a) */
export function hitLabel(step: number): string {
  const beat = Math.floor(step / 4) + 1
  const sub = step % 4
  if (sub === 0) return String(beat)
  if (sub === 1) return `${beat}e`
  if (sub === 2) return `${beat}.5`
  return `${beat}a`
}

export type PatternHitMark = {
  step: number
  label: string
  kind: HitKind
  pitch: number
  /** e.g. "2.5·G" when pitched, else just the count label */
  display: string
}

/** Hit positions for UI (ordered by step) */
export function patternHitMarks(pattern: Hit[]): PatternHitMark[] {
  const marks: PatternHitMark[] = []
  pattern.forEach((hit, step) => {
    if (isRest(hit)) return
    const kind = hitKind(hit)
    const pitch = hitPitch(hit)
    const label = hitLabel(step)
    marks.push({
      step,
      label,
      kind,
      pitch,
      display:
        typeof hit === 'object' ? `${label}·${pitchName(pitch)}` : label,
    })
  })
  return marks
}

export function hitsOnCounts(pattern: Hit[]): number[] {
  return patternHitMarks(pattern).map((m) => {
    const beat = Math.floor(m.step / 4) + 1
    const sub = m.step % 4
    if (sub === 0) return beat
    if (sub === 1) return beat + 0.25
    if (sub === 2) return beat + 0.5
    return beat + 0.75
  })
}
