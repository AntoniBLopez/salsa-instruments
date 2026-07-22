import { INSTRUMENTS } from '../data/instruments'
import { InstrumentCard } from './InstrumentCard'
import styles from './InstrumentGrid.module.css'

export function InstrumentGrid() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Instrumentos y ritmos</h2>
      <p className={styles.hint}>
        Elige el ritmo de cada instrumento; al seleccionarlo entra en la capa.
        Activa o silencia con Capa, Mute y Solo. La dirección de clave (2-3 /
        3-2) del transport afecta a los ritmos que dependen de ella.
      </p>
      <div className={styles.grid}>
        {INSTRUMENTS.map((instrument) => (
          <InstrumentCard key={instrument.id} instrument={instrument} />
        ))}
      </div>
    </section>
  )
}
