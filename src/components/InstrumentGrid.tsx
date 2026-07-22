import { INSTRUMENTS } from '../data/instruments'
import { InstrumentCard } from './InstrumentCard'
import styles from './InstrumentGrid.module.css'

export function InstrumentGrid() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Instrumentos y ritmos</h2>
      <p className={styles.hint}>
        Elige el ritmo de cada instrumento; al seleccionarlo entra en la capa.
        En la Clave, abre Son o Rumba para elegir 2-3 / 3-2 (también mueve
        cáscara, mambo y otros ritmos clave-aware).
      </p>
      <div className={styles.grid}>
        {INSTRUMENTS.map((instrument) => (
          <InstrumentCard key={instrument.id} instrument={instrument} />
        ))}
      </div>
    </section>
  )
}
