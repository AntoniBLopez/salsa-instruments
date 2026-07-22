import { useEffect, useState } from 'react'
import type { InstrumentConfig } from '../data/instruments'
import { useSessionStore } from '../store/sessionStore'
import styles from './InstrumentCard.module.css'

type Props = {
  instrument: InstrumentConfig
}

export function InstrumentCard({ instrument }: Props) {
  const { id, name, description, image } = instrument
  const active = useSessionStore((s) => s.activeIds.includes(id))
  const muted = useSessionStore((s) => s.mutedIds.includes(id))
  const solo = useSessionStore((s) => s.soloId === id)
  const practiceMode = useSessionStore((s) => s.practiceMode)
  const lastTriggeredAt = useSessionStore((s) => s.lastTriggeredAt[id] ?? 0)
  const toggleActive = useSessionStore((s) => s.toggleActive)
  const toggleMute = useSessionStore((s) => s.toggleMute)
  const toggleSolo = useSessionStore((s) => s.toggleSolo)

  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!lastTriggeredAt) return
    setPulse(true)
    const t = window.setTimeout(() => setPulse(false), 140)
    return () => window.clearTimeout(t)
  }, [lastTriggeredAt])

  const practiceLocked = practiceMode && id !== 'clave'

  return (
    <article
      className={[
        styles.card,
        active ? styles.active : '',
        solo ? styles.solo : '',
        muted || practiceLocked ? styles.muted : '',
        pulse && active ? styles.pulse : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.media}>
        <img src={image} alt={name} />
        <div className={styles.pulseRing} />
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h2 className={styles.name}>{name}</h2>
          {solo ? <span className={styles.badge}>Solo</span> : null}
          {practiceLocked ? <span className={styles.badge}>Practice</span> : null}
        </div>
        <p className={styles.desc}>{description}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${active ? styles.on : ''}`}
            onClick={() => toggleActive(id)}
          >
            {active ? 'En capa' : 'Añadir'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${muted ? styles.on : ''}`}
            onClick={() => toggleMute(id)}
            disabled={!active}
          >
            Mute
          </button>
          <button
            type="button"
            className={`${styles.btn} ${solo ? styles.soloOn : ''}`}
            onClick={() => toggleSolo(id)}
          >
            Solo
          </button>
        </div>
      </div>
    </article>
  )
}
