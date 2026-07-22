import { useSessionStore } from '../store/sessionStore'
import { audioEngine } from './engine'

/**
 * Thin façade over the singleton AudioEngine.
 * Audio is initialized lazily on the first Play (user gesture).
 */
export function useAudioEngine() {
  const loading = useSessionStore((s) => s.loading)
  const ready = useSessionStore((s) => s.ready)
  const error = useSessionStore((s) => s.error)
  const isPlaying = useSessionStore((s) => s.isPlaying)

  return {
    loading,
    ready,
    error,
    isPlaying,
    toggle: () => audioEngine.toggle(),
    start: () => audioEngine.start(),
    stop: () => audioEngine.stop(),
  }
}
