import styles from './TransportBar.module.css'
import { useAudioEngine } from '../audio/useAudioEngine'
import { useSessionStore } from '../store/sessionStore'

export function TransportBar() {
  const { toggle, loading, ready, error, isPlaying } = useAudioEngine()
  const beat = useSessionStore((s) => s.beat)
  const bpm = useSessionStore((s) => s.bpm)
  const swing = useSessionStore((s) => s.swing)
  const claveDirection = useSessionStore((s) => s.claveDirection)
  const practiceMode = useSessionStore((s) => s.practiceMode)
  const setBpm = useSessionStore((s) => s.setBpm)
  const setSwing = useSessionStore((s) => s.setSwing)
  const setClaveDirection = useSessionStore((s) => s.setClaveDirection)
  const setPracticeMode = useSessionStore((s) => s.setPracticeMode)
  const tapTempo = useSessionStore((s) => s.tapTempo)

  return (
    <header className={styles.bar}>
      <div className={styles.brandRow}>
        <div>
          <h1 className={styles.brand}>Salsa Instruments</h1>
          <p className={styles.tagline}>
            Apila percusión de salsa y mambo, marca el conteo y encuentra el groove.
          </p>
        </div>
        {error ? (
          <p className={`${styles.status} ${styles.error}`}>{error}</p>
        ) : (
          <p className={styles.status}>
            {loading ? 'Cargando sonidos…' : ready ? 'Listo para tocar' : 'Preparando…'}
          </p>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
          onClick={() => void toggle()}
          disabled={loading && !ready}
        >
          {isPlaying ? 'Pausa' : 'Play'}
        </button>

        <div className={styles.beats} aria-label="Conteo">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`${styles.beat} ${isPlaying && beat === n ? styles.active : ''}`}
            >
              {n}
            </span>
          ))}
        </div>

        <div className={styles.group}>
          <label htmlFor="bpm">
            Tempo <span className={styles.bpmValue}>{bpm} BPM</span>
          </label>
          <input
            id="bpm"
            type="range"
            min={80}
            max={200}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </div>

        <div className={styles.group}>
          <label htmlFor="swing">
            Swing <span className={styles.bpmValue}>{Math.round(swing * 100)}%</span>
          </label>
          <input
            id="swing"
            type="range"
            min={0}
            max={30}
            value={Math.round(swing * 100)}
            onChange={(e) => setSwing(Number(e.target.value) / 100)}
          />
        </div>

        <div className={styles.chipRow}>
          <button type="button" className={styles.chip} onClick={tapTempo}>
            Tap Tempo
          </button>
          <button
            type="button"
            className={`${styles.chip} ${claveDirection === '3-2' ? styles.on : ''}`}
            onClick={() => setClaveDirection('3-2')}
          >
            Clave 3-2
          </button>
          <button
            type="button"
            className={`${styles.chip} ${claveDirection === '2-3' ? styles.on : ''}`}
            onClick={() => setClaveDirection('2-3')}
          >
            Clave 2-3
          </button>
          <button
            type="button"
            className={`${styles.chip} ${practiceMode ? styles.on : ''}`}
            onClick={() => setPracticeMode(!practiceMode)}
          >
            Practice
          </button>
        </div>
      </div>
    </header>
  )
}
