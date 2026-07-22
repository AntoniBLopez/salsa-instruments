import * as Tone from 'tone'
import {
  INSTRUMENTS,
  resolvePattern,
  type ClaveDirection,
  type Hit,
  type HitKind,
  type InstrumentConfig,
} from '../data/instruments'
import { isInstrumentAudible, useSessionStore } from '../store/sessionStore'

type InstrumentVoice = {
  config: InstrumentConfig
  players: Tone.Players
  filter: Tone.Filter
  channel: Tone.Channel
  part: Tone.Part<[string, HitKind]> | null
}

function stepToTransportTime(step: number): string {
  const bars = Math.floor(step / 16)
  const rem = step % 16
  const quarters = Math.floor(rem / 4)
  const sixteenths = rem % 4
  return `${bars}:${quarters}:${sixteenths}`
}

function patternToEvents(pattern: Hit[]): Array<[string, HitKind]> {
  const events: Array<[string, HitKind]> = []
  pattern.forEach((hit, step) => {
    if (hit !== 0) {
      events.push([stepToTransportTime(step), hit])
    }
  })
  return events
}

function patternLoopEnd(pattern: Hit[]): string {
  const bars = Math.max(1, Math.ceil(pattern.length / 16))
  return `${bars}m`
}

export class AudioEngine {
  private voices = new Map<string, InstrumentVoice>()
  private reverb: Tone.Reverb | null = null
  private clickPlayer: Tone.Player | null = null
  private beatLoop: Tone.Loop | null = null
  private clickLoop: Tone.Loop | null = null
  private initialized = false
  private initPromise: Promise<void> | null = null
  private unsub: (() => void) | null = null
  private lastClave: ClaveDirection | null = null

  async init() {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    useSessionStore.getState().setLoading(true)
    useSessionStore.getState().setError(null)

    this.initPromise = this.doInit()
    return this.initPromise
  }

  private async doInit() {
    try {
      this.reverb = new Tone.Reverb({ decay: 1.6, wet: 1 })
      await this.reverb.generate()
      this.reverb.toDestination()

      for (const inst of INSTRUMENTS) {
        const sampleMap: Record<string, string> = {}
        for (const [kind, path] of Object.entries(inst.samples)) {
          sampleMap[kind] = path
        }

        const players = new Tone.Players(sampleMap)
        const filter = new Tone.Filter({
          type: 'lowpass',
          frequency: inst.fx?.filterFreq ?? 8000,
        })
        const channel = new Tone.Channel({ volume: -4 }).toDestination()
        const wet = inst.fx?.reverbWet ?? 0.15
        const send = channel.send('reverb', Tone.gainToDb(wet * 0.55))
        send.connect(this.reverb!)

        players.connect(filter)
        filter.connect(channel)

        this.voices.set(inst.id, {
          config: inst,
          players,
          filter,
          channel,
          part: null,
        })
      }

      await Tone.loaded()

      this.clickPlayer = new Tone.Player('/samples/click.wav').toDestination()
      this.clickPlayer.volume.value = -12
      await Tone.loaded()

      const state = useSessionStore.getState()
      Tone.getTransport().bpm.value = state.bpm
      Tone.getTransport().swing = state.swing
      Tone.getTransport().swingSubdivision = '8n'

      this.buildAllParts()
      this.buildBeatLoop()
      this.buildClickLoop()

      this.unsub = useSessionStore.subscribe((next, prev) => {
        if (next.bpm !== prev.bpm) {
          Tone.getTransport().bpm.value = next.bpm
        }
        if (next.swing !== prev.swing) {
          Tone.getTransport().swing = next.swing
        }
        if (next.claveDirection !== prev.claveDirection) {
          this.rebuildClavePart(next.claveDirection)
        }
      })

      this.initialized = true
      useSessionStore.getState().setReady(true)
    } catch (err) {
      this.initPromise = null
      const message =
        err instanceof Error ? err.message : 'Error al cargar audio'
      useSessionStore.getState().setError(message)
      throw err
    } finally {
      useSessionStore.getState().setLoading(false)
    }
  }

  private shouldPlay(id: string): boolean {
    return isInstrumentAudible(id, useSessionStore.getState())
  }

  private triggerHit(id: string, hit: HitKind, time: number) {
    if (!this.shouldPlay(id)) return
    const voice = this.voices.get(id)
    if (!voice) return

    const kind = voice.players.has(hit)
      ? hit
      : voice.players.has('open')
        ? 'open'
        : null
    if (!kind) return

    const player = voice.players.player(kind)
    try {
      if (player.state === 'started') {
        player.stop(time)
      }
      player.start(time)
    } catch {
      // ignore overlapping start races
    }

    Tone.getDraw().schedule(() => {
      useSessionStore.getState().pulse(id)
    }, time)
  }

  private buildPartFor(inst: InstrumentConfig, pattern: Hit[]) {
    const voice = this.voices.get(inst.id)
    if (!voice) return

    voice.part?.dispose()
    const events = patternToEvents(pattern)

    const part = new Tone.Part<[string, HitKind]>((time, hit) => {
      this.triggerHit(inst.id, hit, time)
    }, events)

    part.loop = true
    part.loopEnd = patternLoopEnd(pattern)
    part.start(0)
    voice.part = part
  }

  private buildAllParts() {
    const dir = useSessionStore.getState().claveDirection
    this.lastClave = dir
    for (const inst of INSTRUMENTS) {
      this.buildPartFor(inst, resolvePattern(inst, dir))
    }
  }

  private rebuildClavePart(dir: ClaveDirection) {
    if (this.lastClave === dir) return
    this.lastClave = dir
    const clave = INSTRUMENTS.find((i) => i.isClave)
    if (!clave) return
    this.buildPartFor(clave, resolvePattern(clave, dir))
  }

  private buildBeatLoop() {
    this.beatLoop?.dispose()
    let beat = 1
    this.beatLoop = new Tone.Loop((time) => {
      Tone.getDraw().schedule(() => {
        useSessionStore.getState().setBeat(beat)
        beat = beat >= 4 ? 1 : beat + 1
      }, time)
    }, '4n')
    this.beatLoop.start(0)
  }

  private buildClickLoop() {
    this.clickLoop?.dispose()
    this.clickLoop = new Tone.Loop((time) => {
      const { practiceMode, isPlaying } = useSessionStore.getState()
      if (!practiceMode || !isPlaying || !this.clickPlayer) return
      try {
        this.clickPlayer.start(time)
      } catch {
        /* noop */
      }
    }, '4n')
    this.clickLoop.start(0)
  }

  async start() {
    await Tone.start()
    if (!this.initialized) {
      await this.init()
    }
    const transport = Tone.getTransport()
    transport.position = 0
    if (transport.state !== 'started') {
      transport.start()
    }
    useSessionStore.getState().setPlaying(true)
    useSessionStore.getState().setBeat(1)
  }

  stop() {
    const transport = Tone.getTransport()
    transport.stop()
    transport.position = 0
    useSessionStore.getState().setPlaying(false)
    useSessionStore.getState().setBeat(1)
  }

  async toggle() {
    if (useSessionStore.getState().isPlaying) {
      this.stop()
    } else {
      await this.start()
    }
  }

  dispose() {
    this.unsub?.()
    this.unsub = null
    this.beatLoop?.dispose()
    this.clickLoop?.dispose()
    this.clickPlayer?.dispose()
    for (const voice of this.voices.values()) {
      voice.part?.dispose()
      voice.players.dispose()
      voice.filter.dispose()
      voice.channel.dispose()
    }
    this.voices.clear()
    this.reverb?.dispose()
    this.initialized = false
  }
}

export const audioEngine = new AudioEngine()
