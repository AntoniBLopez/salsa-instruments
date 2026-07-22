import { create } from 'zustand'
import {
  INSTRUMENT_BY_ID,
  defaultSelectedRhythms,
  getRhythm,
  type ClaveDirection,
} from '../data/instruments'

export type SessionState = {
  activeIds: string[]
  mutedIds: string[]
  soloId: string | null
  /** instrumentId → rhythmId */
  selectedRhythms: Record<string, string>
  bpm: number
  swing: number
  claveDirection: ClaveDirection
  isPlaying: boolean
  beat: number
  /** Current 16n step in the 32-step cycle (0–31), for hit UI sync */
  step: number
  /** Click de negras (1–8) encima del groove */
  negrasMode: boolean
  /** Silencia todos los instrumentos (el click de Negras sigue si está ON) */
  muteAll: boolean
  lastTriggeredAt: Record<string, number>
  /** Last pattern step that sounded per instrument */
  lastHitStep: Record<string, number>
  ready: boolean
  loading: boolean
  error: string | null

  setReady: (ready: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setPlaying: (playing: boolean) => void
  setBeat: (beat: number) => void
  setStep: (step: number) => void
  setBpm: (bpm: number) => void
  setSwing: (swing: number) => void
  setClaveDirection: (dir: ClaveDirection) => void
  setNegrasMode: (on: boolean) => void
  setMuteAll: (on: boolean) => void
  setRhythm: (instrumentId: string, rhythmId: string) => void
  setActive: (id: string, on: boolean) => void
  toggleActive: (id: string) => void
  toggleMute: (id: string) => void
  toggleSolo: (id: string) => void
  clearSolo: () => void
  pulse: (id: string, step?: number) => void
  tapTempo: () => void
}

const tapTimes: number[] = []

export const useSessionStore = create<SessionState>((set, get) => ({
  activeIds: ['clave'],
  mutedIds: [],
  soloId: null,
  selectedRhythms: defaultSelectedRhythms(),
  bpm: 180,
  swing: 0,
  claveDirection: '3-2',
  isPlaying: false,
  beat: 1,
  step: 0,
  negrasMode: false,
  muteAll: false,
  lastTriggeredAt: {},
  lastHitStep: {},
  ready: false,
  loading: false,
  error: null,

  setReady: (ready) => set({ ready }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBeat: (beat) => set({ beat }),
  setStep: (step) => set({ step }),
  setBpm: (bpm) => set({ bpm: Math.min(260, Math.max(80, Math.round(bpm))) }),
  setSwing: (swing) => set({ swing: Math.min(0.3, Math.max(0, swing)) }),
  setClaveDirection: (claveDirection) => set({ claveDirection }),
  setNegrasMode: (negrasMode) => set({ negrasMode }),
  setMuteAll: (muteAll) => set({ muteAll }),

  setRhythm: (instrumentId, rhythmId) => {
    const { selectedRhythms, activeIds } = get()
    const inst = INSTRUMENT_BY_ID[instrumentId]
    const rhythm = inst ? getRhythm(inst, rhythmId) : null
    set({
      selectedRhythms: { ...selectedRhythms, [instrumentId]: rhythmId },
      // Choosing a rhythm puts the instrument in the layer
      activeIds: activeIds.includes(instrumentId)
        ? activeIds
        : [...activeIds, instrumentId],
      // Son/Rumba 2-3|3-2 also drive cáscara, mambo, etc.
      ...(rhythm?.setsClaveDirection
        ? { claveDirection: rhythm.setsClaveDirection }
        : {}),
    })
  },

  setActive: (id, on) => {
    const { activeIds, soloId } = get()
    if (on) {
      set({
        activeIds: activeIds.includes(id) ? activeIds : [...activeIds, id],
      })
      return
    }
    set({
      activeIds: activeIds.filter((x) => x !== id),
      soloId: soloId === id ? null : soloId,
    })
  },

  toggleActive: (id) => {
    const { activeIds } = get()
    get().setActive(id, !activeIds.includes(id))
  },

  toggleMute: (id) => {
    const { mutedIds } = get()
    set({
      mutedIds: mutedIds.includes(id)
        ? mutedIds.filter((x) => x !== id)
        : [...mutedIds, id],
    })
  },

  toggleSolo: (id) => {
    const { soloId, activeIds } = get()
    if (soloId === id) {
      set({ soloId: null })
      return
    }
    const nextActive = activeIds.includes(id) ? activeIds : [...activeIds, id]
    set({ soloId: id, activeIds: nextActive })
  },

  clearSolo: () => set({ soloId: null }),

  pulse: (id, step) =>
    set((s) => ({
      lastTriggeredAt: { ...s.lastTriggeredAt, [id]: performance.now() },
      lastHitStep:
        step === undefined
          ? s.lastHitStep
          : { ...s.lastHitStep, [id]: step },
    })),

  tapTempo: () => {
    const now = performance.now()
    tapTimes.push(now)
    while (tapTimes.length > 4) tapTimes.shift()
    if (tapTimes.length < 2) return
    const intervals: number[] = []
    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1])
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    if (avg <= 0) return
    get().setBpm(60000 / avg)
  },
}))

export function isInstrumentAudible(
  id: string,
  state: Pick<
    SessionState,
    'activeIds' | 'mutedIds' | 'soloId' | 'muteAll'
  >,
): boolean {
  if (state.muteAll) return false
  if (state.soloId) {
    return state.soloId === id
  }
  return state.activeIds.includes(id) && !state.mutedIds.includes(id)
}
