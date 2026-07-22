import styles from './TransportBar.module.css'
import { useAudioEngine } from '../audio/useAudioEngine'
import { useSessionStore } from '../store/sessionStore'

export function TransportBar() {
  const { toggle, loading, ready, error, isPlaying } = useAudioEngine()
  const beat = useSessionStore((s) => s.beat)
  const bpm = useSessionStore((s) => s.bpm)
  const swing = useSessionStore((s) => s.swing)
  const negrasMode = useSessionStore((s) => s.negrasMode)
  const muteAll = useSessionStore((s) => s.muteAll)
  const setBpm = useSessionStore((s) => s.setBpm)
  const setSwing = useSessionStore((s) => s.setSwing)
  const setNegrasMode = useSessionStore((s) => s.setNegrasMode)
  const setMuteAll = useSessionStore((s) => s.setMuteAll)
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
            {loading
              ? 'Cargando sonidos…'
              : ready
                ? 'Listo para tocar'
                : 'Pulsa Play para empezar'}
          </p>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
          onClick={() => void toggle()}
          disabled={loading}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>

        <div className={styles.beats} aria-label="Conteo de 8 tiempos">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <span
              key={n}
              className={[
                styles.beat,
                n === 5 ? styles.barBreak : '',
                isPlaying && beat === n ? styles.active : '',
                !isPlaying && n === 1 ? styles.ready : '',
              ]
                .filter(Boolean)
                .join(' ')}
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
            max={260}
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
            Sync Tempo
          </button>
          <button
            type="button"
            className={`${styles.chip} ${negrasMode ? styles.on : ''}`}
            onClick={() => setNegrasMode(!negrasMode)}
            title="Añade el click de las negras (1–8) encima del groove"
          >
            {negrasMode ? 'Negras ON' : 'Negras'}
          </button>
          <button
            type="button"
            className={`${styles.chip} ${muteAll ? styles.on : ''}`}
            onClick={() => setMuteAll(!muteAll)}
            title="Silencia todos los instrumentos (el click de Negras sigue si está ON)"
          >
            {muteAll ? 'Mute all ON' : 'Mute all'}
          </button>
        </div>
      </div>
    </header>
  )
}
