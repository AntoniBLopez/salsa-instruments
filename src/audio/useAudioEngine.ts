import { useEffect } from 'react'
import { audioEngine } from './engine'
import { useSessionStore } from '../store/sessionStore'

export function useAudioEngine() {
  const loading = useSessionStore((s) => s.loading)
  const ready = useSessionStore((s) => s.ready)
  const error = useSessionStore((s) => s.error)
  const isPlaying = useSessionStore((s) => s.isPlaying)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await audioEngine.init()
      } catch {
        if (!cancelled) {
          /* error already in store */
        }
      }
    })()
    return () => {
      cancelled = true
      // Keep engine alive across StrictMode remounts in prod; only stop playback
      audioEngine.stop()
    }
  }, [])

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
