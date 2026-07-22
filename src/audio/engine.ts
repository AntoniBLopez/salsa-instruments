import * as Tone from 'tone'
import {
  CYCLE_STEPS,
  INSTRUMENTS,
  defaultRhythmId,
  getRhythm,
  hitKind,
  hitPitch,
  isRest,
  resolvePattern,
  type Hit,
  type HitKind,
  type InstrumentConfig,
} from '../data/instruments'
import { isInstrumentAudible, useSessionStore } from '../store/sessionStore'

type InstrumentVoice = {
  config: InstrumentConfig
  /** Loaded buffers by hit kind */
  buffers: Partial<Record<HitKind, Tone.ToneAudioBuffer>>
  output: Tone.Gain
}

export class AudioEngine {
  private voices = new Map<string, InstrumentVoice>()
  private clickBuffer: Tone.ToneAudioBuffer | null = null
  private master: Tone.Gain | null = null
  private stepRepeatId: number | null = null
  private clickLoop: Tone.Loop | null = null
  private step = 0
  private initialized = false
  private initPromise: Promise<void> | null = null
  /** Cached resolved patterns — refreshed when rhythms/clave change */
  private patternCache = new Map<string, Hit[]>()

  async init() {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise
    this.initPromise = this.doInit()
    return this.initPromise
  }

  private async doInit() {
    useSessionStore.getState().setLoading(true)
    useSessionStore.getState().setError(null)

    try {
      await Tone.start()

      this.master = new Tone.Gain(0.9).toDestination()

      for (const inst of INSTRUMENTS) {
        const output = new Tone.Gain(1).connect(this.master)
        const buffers: Partial<Record<HitKind, Tone.ToneAudioBuffer>> = {}

        await Promise.all(
          (Object.entries(inst.samples) as Array<[HitKind, string]>).map(
            async ([kind, url]) => {
              const buf = new Tone.ToneAudioBuffer(url)
              await buf.load(url)
              buffers[kind] = buf
            },
          ),
        )

        this.voices.set(inst.id, { config: inst, buffers, output })
      }

      this.clickBuffer = new Tone.ToneAudioBuffer('/samples/click.wav')
      await this.clickBuffer.load('/samples/click.wav')

      const state = useSessionStore.getState()
      const transport = Tone.getTransport()
      transport.bpm.value = state.bpm
      transport.swing = state.swing
      transport.swingSubdivision = '8n'

      this.refreshAllPatterns()
      // Clocks are armed only on Play — avoids ghost ticks after Pause

      useSessionStore.subscribe((next, prev) => {
        if (next.bpm !== prev.bpm) {
          Tone.getTransport().bpm.value = next.bpm
        }
        if (next.swing !== prev.swing) {
          Tone.getTransport().swing = next.swing
        }
        if (next.claveDirection !== prev.claveDirection) {
          this.refreshClaveAwarePatterns()
        }
        if (next.selectedRhythms !== prev.selectedRhythms) {
          for (const inst of INSTRUMENTS) {
            if (
              next.selectedRhythms[inst.id] !== prev.selectedRhythms[inst.id]
            ) {
              this.refreshPattern(inst)
            }
          }
        }
      })

      this.initialized = true
      useSessionStore.getState().setReady(true)
      console.info(
        '[AudioEngine] ready',
        INSTRUMENTS.map((i) => {
          const v = this.voices.get(i.id)!
          return `${i.id}:[${Object.keys(v.buffers).join(',')}]`
        }).join(' '),
      )
    } catch (err) {
      this.initPromise = null
      const message =
        err instanceof Error ? err.message : 'Error al cargar audio'
      useSessionStore.getState().setError(message)
      console.error('[AudioEngine]', err)
      throw err
    } finally {
      useSessionStore.getState().setLoading(false)
    }
  }

  private rhythmIdFor(inst: InstrumentConfig): string {
    return (
      useSessionStore.getState().selectedRhythms[inst.id] ??
      defaultRhythmId(inst)
    )
  }

  private refreshPattern(inst: InstrumentConfig) {
    const dir = useSessionStore.getState().claveDirection
    const pattern = resolvePattern(inst, dir, this.rhythmIdFor(inst))
    this.patternCache.set(inst.id, pattern)
  }

  private refreshAllPatterns() {
    for (const inst of INSTRUMENTS) {
      this.refreshPattern(inst)
    }
  }

  private refreshClaveAwarePatterns() {
    for (const inst of INSTRUMENTS) {
      const rhythm = getRhythm(inst, this.rhythmIdFor(inst))
      if (rhythm?.claveAware || inst.isClave) {
        this.refreshPattern(inst)
      }
    }
  }

  private playBuffer(
    buffer: Tone.ToneAudioBuffer,
    output: Tone.ToneAudioNode,
    time: number,
    playbackRate = 1,
  ) {
    if (!buffer.loaded) return
    const src = new Tone.ToneBufferSource({
      url: buffer,
      fadeIn: 0.002,
      fadeOut: 0.04,
      playbackRate,
    }).connect(output)
    src.onended = () => src.dispose()
    src.start(time)
  }

  private triggerHit(
    id: string,
    hit: Exclude<Hit, 0>,
    time: number,
    step: number,
  ) {
    if (!isInstrumentAudible(id, useSessionStore.getState())) return
    const voice = this.voices.get(id)
    if (!voice) return

    const kind = hitKind(hit)
    const pitch = hitPitch(hit)
    const pitched = typeof hit === 'object' && hit.pitch !== undefined
    // Prefer the articulation buffer (open/mute/slap). Bajo mute/slap
    // samples are pre-pitched (+7 / +12); compensate so `pitch` stays absolute.
    const buffer =
      voice.buffers[kind] ?? voice.buffers.open ?? voice.buffers.mute
    if (!buffer) {
      console.warn('[AudioEngine] missing buffer', id, kind)
      return
    }

    const bakedOffset =
      pitched && id === 'bajo'
        ? kind === 'mute'
          ? 7
          : kind === 'slap'
            ? 12
            : 0
        : 0
    const rate = pitched ? 2 ** ((pitch - bakedOffset) / 12) : 1
    this.playBuffer(buffer, voice.output, time, rate)

    Tone.getDraw().schedule(() => {
      if (!useSessionStore.getState().isPlaying) return
      useSessionStore.getState().pulse(id, step)
    }, time)
  }

  /**
   * Single 16th-note clock.
   * IMPORTANT: step is a plain counter — never derive it from audio time.
   * With Transport.swing, swung callback times map to the wrong tick via
   * getTicksAtTime() and cause extra/missed clave (and other) hits.
   */
  private startStepClock() {
    if (this.stepRepeatId !== null) {
      Tone.getTransport().clear(this.stepRepeatId)
      this.stepRepeatId = null
    }

    this.step = 0
    this.stepRepeatId = Tone.getTransport().scheduleRepeat((time) => {
      if (!useSessionStore.getState().isPlaying) return

      const step = this.step
      this.step = (step + 1) % CYCLE_STEPS

      // Visual counters locked to the same counter as the patterns
      Tone.getDraw().schedule(() => {
        if (!useSessionStore.getState().isPlaying) return
        useSessionStore.getState().setStep(step)
        if (step % 4 === 0) {
          useSessionStore.getState().setBeat(Math.floor(step / 4) + 1)
        }
      }, time)

      for (const inst of INSTRUMENTS) {
        const pattern = this.patternCache.get(inst.id)
        if (!pattern) continue
        const hit = pattern[step]
        if (!isRest(hit)) {
          this.triggerHit(inst.id, hit, time, step)
        }
      }
    }, '16n')
  }

  private buildClickLoop() {
    this.clickLoop?.dispose()
    this.clickLoop = new Tone.Loop((time) => {
      const { negrasMode, isPlaying } = useSessionStore.getState()
      if (!negrasMode || !isPlaying || !this.clickBuffer?.loaded) return
      if (!this.master) return
      this.playBuffer(this.clickBuffer, this.master, time)
    }, '4n')
    this.clickLoop.start(0)
  }

  /** Tear down clocks + cancel pending UI draws so Pause can't keep animating */
  private disarmClocks() {
    if (this.stepRepeatId !== null) {
      Tone.getTransport().clear(this.stepRepeatId)
      this.stepRepeatId = null
    }
    this.clickLoop?.dispose()
    this.clickLoop = null

    try {
      Tone.getDraw().cancel(0)
    } catch {
      // older Tone builds may not expose cancel the same way
    }
  }

  private resetCounters() {
    this.step = 0
    useSessionStore.getState().setBeat(1)
    useSessionStore.getState().setStep(0)
  }

  async start() {
    await Tone.start()
    if (!this.initialized) {
      await this.init()
    }

    this.refreshAllPatterns()

    const transport = Tone.getTransport()

    // Full stop + clean slate before arming again
    useSessionStore.getState().setPlaying(false)
    this.disarmClocks()
    if (transport.state !== 'stopped') {
      transport.stop()
    }
    transport.position = 0
    this.resetCounters()

    this.startStepClock()
    this.buildClickLoop()

    useSessionStore.getState().setPlaying(true)
    useSessionStore.getState().setBeat(1)
    transport.start()
  }

  stop() {
    // Flip UI first so any already-queued Draw callbacks no-op
    useSessionStore.getState().setPlaying(false)

    this.disarmClocks()

    const transport = Tone.getTransport()
    if (transport.state !== 'stopped') {
      transport.stop()
    }
    transport.position = 0

    this.resetCounters()
  }

  async toggle() {
    if (useSessionStore.getState().isPlaying) {
      this.stop()
    } else {
      await this.start()
    }
  }
}

export const audioEngine = new AudioEngine()
