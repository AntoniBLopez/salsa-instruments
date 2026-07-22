import { INSTRUMENTS } from '../data/instruments'
import { InstrumentCard } from './InstrumentCard'
import styles from './InstrumentGrid.module.css'

export function InstrumentGrid() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Instrumentos</h2>
      <p className={styles.hint}>
        Añade capas, deja un Solo o silencia con Mute. En modo Practice solo suena la
        clave y el conteo.
      </p>
      <div className={styles.grid}>
        {INSTRUMENTS.map((instrument) => (
          <InstrumentCard key={instrument.id} instrument={instrument} />
        ))}
      </div>
    </section>
  )
}
