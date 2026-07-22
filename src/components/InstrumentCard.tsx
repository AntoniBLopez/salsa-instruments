import { useEffect, useState } from 'react'
import {
  LEVEL_LABEL,
  getRhythm,
  type InstrumentConfig,
} from '../data/instruments'
import { useSessionStore } from '../store/sessionStore'
import styles from './InstrumentCard.module.css'

type Props = {
  instrument: InstrumentConfig
}

export function InstrumentCard({ instrument }: Props) {
  const { id, name, image, rhythms } = instrument
  const active = useSessionStore((s) => s.activeIds.includes(id))
  const muted = useSessionStore((s) => s.mutedIds.includes(id))
  const solo = useSessionStore((s) => s.soloId === id)
  const practiceMode = useSessionStore((s) => s.practiceMode)
  const rhythmId = useSessionStore(
    (s) => s.selectedRhythms[id] ?? rhythms[0]?.id,
  )
  const lastTriggeredAt = useSessionStore((s) => s.lastTriggeredAt[id] ?? 0)
  const setRhythm = useSessionStore((s) => s.setRhythm)
  const setActive = useSessionStore((s) => s.setActive)
  const toggleMute = useSessionStore((s) => s.toggleMute)
  const toggleSolo = useSessionStore((s) => s.toggleSolo)

  const rhythm = getRhythm(instrument, rhythmId)
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
        muted || practiceLocked ? styles.dimmed : '',
        pulse && active ? styles.pulse : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.media}>
        <img src={image} alt={name} />
        <div className={styles.pulseRing} />
        <div className={styles.mediaBadge}>
          {active ? 'En el groove' : 'Fuera'}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h2 className={styles.name}>{name}</h2>
          {solo ? <span className={styles.badge}>Solo</span> : null}
          {practiceLocked ? (
            <span className={styles.badge}>Practice</span>
          ) : null}
        </div>

        <div className={styles.rhythmBlock}>
          <div className={styles.rhythmLabel}>Ritmo</div>
          <div
            className={styles.rhythmList}
            role="listbox"
            aria-label={`Ritmos de ${name}`}
          >
            {rhythms.map((r) => {
              const selected = r.id === rhythmId
              const level = r.level ? LEVEL_LABEL[r.level] : null
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={level ? `${level}: ${r.description}` : r.description}
                  className={[
                    styles.rhythmChip,
                    selected ? styles.rhythmChipOn : '',
                    r.level === 'beginner' ? styles.lvl_beginner : '',
                    r.level === 'advanced' ? styles.lvl_advanced : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setRhythm(id, r.id)}
                >
                  {r.name}
                </button>
              )
            })}
          </div>
          <p className={styles.rhythmDesc}>
            {rhythm?.level ? (
              <span className={styles.levelTag}>
                {LEVEL_LABEL[rhythm.level]}
              </span>
            ) : null}
            {rhythm?.description}
            {rhythm?.vocalization ? (
              <span className={styles.vocalization}>
                {' '}
                · <em>{rhythm.vocalization}</em>
              </span>
            ) : null}
          </p>
        </div>

        <div className={styles.actions}>
          <label className={styles.switchRow}>
            <span>Capa</span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              className={`${styles.switch} ${active ? styles.switchOn : ''}`}
              onClick={() => setActive(id, !active)}
              disabled={practiceLocked}
            >
              <span className={styles.switchKnob} />
            </button>
          </label>

          <button
            type="button"
            className={`${styles.btn} ${muted ? styles.on : ''}`}
            onClick={() => toggleMute(id)}
            disabled={!active || practiceLocked}
          >
            Mute
          </button>
          <button
            type="button"
            className={`${styles.btn} ${solo ? styles.soloOn : ''}`}
            onClick={() => toggleSolo(id)}
            disabled={practiceLocked}
          >
            Solo
          </button>
        </div>
      </div>
    </article>
  )
}
