import { create } from 'zustand'
import type { ClaveDirection } from '../data/instruments'

export type SessionState = {
  activeIds: string[]
  mutedIds: string[]
  soloId: string | null
  bpm: number
  swing: number
  claveDirection: ClaveDirection
  isPlaying: boolean
  beat: number
  practiceMode: boolean
  lastTriggeredAt: Record<string, number>
  ready: boolean
  loading: boolean
  error: string | null

  setReady: (ready: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setPlaying: (playing: boolean) => void
  setBeat: (beat: number) => void
  setBpm: (bpm: number) => void
  setSwing: (swing: number) => void
  setClaveDirection: (dir: ClaveDirection) => void
  setPracticeMode: (on: boolean) => void
  toggleActive: (id: string) => void
  toggleMute: (id: string) => void
  toggleSolo: (id: string) => void
  clearSolo: () => void
  pulse: (id: string) => void
  tapTempo: () => void
}

const tapTimes: number[] = []

export const useSessionStore = create<SessionState>((set, get) => ({
  activeIds: ['clave'],
  mutedIds: [],
  soloId: null,
  bpm: 180,
  swing: 0.08,
  claveDirection: '3-2',
  isPlaying: false,
  beat: 1,
  practiceMode: false,
  lastTriggeredAt: {},
  ready: false,
  loading: true,
  error: null,

  setReady: (ready) => set({ ready }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBeat: (beat) => set({ beat }),
  setBpm: (bpm) => set({ bpm: Math.min(200, Math.max(80, Math.round(bpm))) }),
  setSwing: (swing) => set({ swing: Math.min(0.3, Math.max(0, swing)) }),
  setClaveDirection: (claveDirection) => set({ claveDirection }),
  setPracticeMode: (practiceMode) => set({ practiceMode }),

  toggleActive: (id) => {
    const { activeIds, soloId } = get()
    if (activeIds.includes(id)) {
      set({
        activeIds: activeIds.filter((x) => x !== id),
        soloId: soloId === id ? null : soloId,
      })
    } else {
      set({ activeIds: [...activeIds, id] })
    }
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

  pulse: (id) =>
    set((s) => ({
      lastTriggeredAt: { ...s.lastTriggeredAt, [id]: performance.now() },
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
    'activeIds' | 'mutedIds' | 'soloId' | 'practiceMode'
  >,
): boolean {
  if (state.practiceMode) {
    return id === 'clave'
  }
  if (state.soloId) {
    return state.soloId === id
  }
  return state.activeIds.includes(id) && !state.mutedIds.includes(id)
}
