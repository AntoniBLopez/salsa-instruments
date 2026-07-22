export type HitKind = 'open' | 'mute' | 'slap'
export type Hit = 0 | HitKind

export type ClaveDirection = '3-2' | '2-3'

export type InstrumentConfig = {
  id: string
  name: string
  description: string
  image: string
  samples: Partial<Record<HitKind, string>>
  subdivision: '16n'
  patterns: {
    '3-2'?: Hit[]
    '2-3'?: Hit[]
    default?: Hit[]
  }
  fx?: { reverbWet?: number; filterFreq?: number }
  /** Always available in Practice mode */
  isClave?: boolean
}

const O: Hit = 'open'
const M: Hit = 'mute'
const S: Hit = 'slap'
const _: Hit = 0

/** Son clave 3-2 over one bar of 16ths */
const CLAVE_32: Hit[] = [
  O, _, _, _, O, _, _, _, O, _, _, O, _, _, O, _,
]

/** Son clave 2-3 (swap bars of the classic two-bar feel, packed to 16) */
const CLAVE_23: Hit[] = [
  O, _, _, O, _, _, O, _, O, _, _, _, O, _, _, _,
]

export const INSTRUMENTS: InstrumentConfig[] = [
  {
    id: 'clave',
    name: 'Clave',
    description: 'El corazón rítmico — son 3-2 / 2-3',
    image: '/images/clave.svg',
    samples: {
      open: '/samples/clave-open.wav',
      mute: '/samples/clave-mute.wav',
    },
    subdivision: '16n',
    patterns: {
      '3-2': CLAVE_32,
      '2-3': CLAVE_23,
    },
    fx: { reverbWet: 0.12, filterFreq: 8000 },
    isClave: true,
  },
  {
    id: 'conga',
    name: 'Congas',
    description: 'Tumbao básico',
    image: '/images/conga.svg',
    samples: {
      open: '/samples/conga-open.wav',
      mute: '/samples/conga-mute.wav',
      slap: '/samples/conga-slap.wav',
    },
    subdivision: '16n',
    patterns: {
      // tumbao simplificado (2 compases = 32 steps, aquí 16 repetible)
      default: [
        M, _, O, _, _, _, S, _, M, _, O, _, S, _, O, _,
      ],
    },
    fx: { reverbWet: 0.18, filterFreq: 4500 },
  },
  {
    id: 'bongo',
    name: 'Bongós',
    description: 'Martillo',
    image: '/images/bongo.svg',
    samples: {
      open: '/samples/bongo-open.wav',
      mute: '/samples/bongo-mute.wav',
      slap: '/samples/bongo-slap.wav',
    },
    subdivision: '16n',
    patterns: {
      default: [
        O, M, O, M, O, M, S, M, O, M, O, M, O, M, S, _,
      ],
    },
    fx: { reverbWet: 0.14, filterFreq: 6000 },
  },
  {
    id: 'timbale',
    name: 'Timbales',
    description: 'Cáscara',
    image: '/images/timbale.svg',
    samples: {
      open: '/samples/timbale-open.wav',
      mute: '/samples/timbale-mute.wav',
      slap: '/samples/timbale-slap.wav',
    },
    subdivision: '16n',
    patterns: {
      default: [
        O, _, O, O, _, O, _, O, O, _, O, O, _, O, _, O,
      ],
    },
    fx: { reverbWet: 0.2, filterFreq: 7000 },
  },
  {
    id: 'maracas',
    name: 'Maracas',
    description: 'Shaker a corcheas',
    image: '/images/maracas.svg',
    samples: {
      open: '/samples/maracas-open.wav',
      mute: '/samples/maracas-mute.wav',
    },
    subdivision: '16n',
    patterns: {
      default: [
        O, _, O, _, O, _, O, _, O, _, O, _, O, _, O, _,
      ],
    },
    fx: { reverbWet: 0.1, filterFreq: 9000 },
  },
  {
    id: 'guiro',
    name: 'Güiro',
    description: 'Scrapes en el compás',
    image: '/images/guiro.svg',
    samples: {
      open: '/samples/guiro-open.wav',
      mute: '/samples/guiro-mute.wav',
    },
    subdivision: '16n',
    patterns: {
      default: [
        O, _, _, M, _, _, O, _, _, M, _, _, O, _, M, _,
      ],
    },
    fx: { reverbWet: 0.16, filterFreq: 5000 },
  },
  {
    id: 'campana',
    name: 'Campana',
    description: 'Campaneo mambo / salsa',
    image: '/images/campana.svg',
    samples: {
      open: '/samples/campana-open.wav',
      mute: '/samples/campana-mute.wav',
    },
    subdivision: '16n',
    patterns: {
      default: [
        O, _, _, _, O, _, M, _, O, _, _, _, O, _, M, _,
      ],
    },
    fx: { reverbWet: 0.22, filterFreq: 7500 },
  },
]

export const INSTRUMENT_BY_ID = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i]),
) as Record<string, InstrumentConfig>

export function resolvePattern(
  instrument: InstrumentConfig,
  claveDirection: ClaveDirection,
): Hit[] {
  if (instrument.isClave) {
    return instrument.patterns[claveDirection] ?? CLAVE_32
  }
  return instrument.patterns.default ?? []
}
