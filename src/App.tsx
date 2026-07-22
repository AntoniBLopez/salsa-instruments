import { TransportBar } from './components/TransportBar'
import { InstrumentGrid } from './components/InstrumentGrid'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <div className={styles.atmosphere} aria-hidden />
      <TransportBar />
      <main>
        <InstrumentGrid />
      </main>
      <footer className={styles.footer}>
        Sonidos sintéticos CC0 generados para esta app · Patrones de salsa / mambo
      </footer>
    </div>
  )
}
