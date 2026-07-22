import { useEffect, useState } from 'react'
import {
  LEVEL_LABEL,
  CONGA_DEFAULT_ID,
  MAMBO_DEFAULT_ID,
  RUMBA_DEFAULT_ID,
  SON_DEFAULT_ID,
  getRhythm,
  patternHitMarks,
  resolvePattern,
  topLevelRhythms,
  type InstrumentConfig,
  type RhythmDef,
} from '../data/instruments'
import { useSessionStore } from '../store/sessionStore'
import styles from './InstrumentCard.module.css'

type Props = {
  instrument: InstrumentConfig
}

export function InstrumentCard({ instrument }: Props) {
  const { id, name, image, rhythms } = instrument
  const active = useSessionStore((s) => s.activeIds.includes(id))
  const solo = useSessionStore((s) => s.soloId === id)
  const muteAll = useSessionStore((s) => s.muteAll)
  const rhythmId = useSessionStore(
    (s) => s.selectedRhythms[id] ?? rhythms[0]?.id,
  )
  const lastTriggeredAt = useSessionStore((s) => s.lastTriggeredAt[id] ?? 0)
  const lastHitStep = useSessionStore((s) => s.lastHitStep[id])
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const setRhythm = useSessionStore((s) => s.setRhythm)
  const setActive = useSessionStore((s) => s.setActive)
  const toggleSolo = useSessionStore((s) => s.toggleSolo)
  const claveDirection = useSessionStore((s) => s.claveDirection)

  const rhythm = getRhythm(instrument, rhythmId)
  const pattern = resolvePattern(instrument, claveDirection, rhythmId)
  const hitMarks = patternHitMarks(pattern)
  const [pulse, setPulse] = useState(false)
  const [litStep, setLitStep] = useState<number | null>(null)
  /** Which rhythm group panel is open (e.g. "mambo", "son") */
  const [openGroup, setOpenGroup] = useState<string | null>(
    () => rhythm?.group ?? null,
  )

  useEffect(() => {
    if (!lastTriggeredAt) return
    setPulse(true)
    if (lastHitStep !== undefined) setLitStep(lastHitStep)
    const t = window.setTimeout(() => {
      setPulse(false)
      setLitStep(null)
    }, 160)
    return () => window.clearTimeout(t)
  }, [lastTriggeredAt, lastHitStep])

  useEffect(() => {
    if (!isPlaying) setLitStep(null)
  }, [isPlaying])

  // Keep the variations panel open while a grouped rhythm is selected
  useEffect(() => {
    if (rhythm?.group) setOpenGroup(rhythm.group)
  }, [rhythm?.group])

  const entries = topLevelRhythms(instrument)
  const activeGroup =
    openGroup &&
    entries.find((e) => e.kind === 'group' && e.group === openGroup)
  const variations =
    activeGroup && activeGroup.kind === 'group' ? activeGroup.members : null
  const variationLabel =
    activeGroup && activeGroup.kind === 'group' ? activeGroup.label : ''

  function selectRhythm(nextId: string) {
    setRhythm(id, nextId)
  }

  function onGroupClick(group: string, members: RhythmDef[]) {
    const alreadyOpen = openGroup === group
    const inGroup = members.some((m) => m.id === rhythmId)
    if (alreadyOpen && inGroup) {
      // Toggle closed only if already using a variation from this group
      setOpenGroup(null)
      return
    }
    setOpenGroup(group)
    if (!inGroup) {
      const preferred =
        members.find((m) => m.id === MAMBO_DEFAULT_ID) ??
        members.find((m) => m.id === SON_DEFAULT_ID) ??
        members.find((m) => m.id === RUMBA_DEFAULT_ID) ??
        members.find((m) => m.id === CONGA_DEFAULT_ID) ??
        members.find((m) => m.setsClaveDirection === claveDirection) ??
        members.find((m) => m.level === 'intermediate') ??
        members[0]
      if (preferred) selectRhythm(preferred.id)
    }
  }

  function chipClass(r: RhythmDef, selected: boolean) {
    return [
      styles.rhythmChip,
      selected ? styles.rhythmChipOn : '',
      r.level === 'beginner' ? styles.lvl_beginner : '',
      r.level === 'advanced' ? styles.lvl_advanced : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <article
      className={[
        styles.card,
        active ? styles.active : '',
        solo ? styles.solo : '',
        muteAll ? styles.dimmed : '',
        pulse && active && !muteAll ? styles.pulse : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.media}>
        <img src={image} alt={name} />
        <div className={styles.pulseRing} />
        <div className={styles.mediaActions}>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={`${active ? 'Quitar' : 'Añadir'} capa de ${name}`}
            title={active ? 'Quitar capa' : 'Añadir capa'}
            className={`${styles.switch} ${active ? styles.switchOn : ''}`}
            onClick={() => setActive(id, !active)}
          >
            <span className={styles.switchKnob} />
          </button>
          <button
            type="button"
            className={`${styles.btn} ${solo ? styles.soloOn : ''}`}
            onClick={() => toggleSolo(id)}
          >
            Solo
          </button>
        </div>
        <div className={styles.mediaBadge}>
          {active ? 'Groove' : 'Fuera'}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h2 className={styles.name}>{name}</h2>
          {solo ? <span className={styles.badge}>Solo</span> : null}
          {muteAll ? <span className={styles.badge}>Mute all</span> : null}
        </div>

        <div className={styles.rhythmBlock}>
          <div className={styles.rhythmLabel}>Ritmo</div>
          <div
            className={styles.rhythmList}
            role="listbox"
            aria-label={`Ritmos de ${name}`}
          >
            {entries.map((entry) => {
              if (entry.kind === 'rhythm') {
                const r = entry.rhythm
                const selected = r.id === rhythmId
                const level = r.level ? LEVEL_LABEL[r.level] : null
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={level ? `${level}: ${r.description}` : r.description}
                    className={chipClass(r, selected)}
                    onClick={() => {
                      setOpenGroup(null)
                      selectRhythm(r.id)
                    }}
                  >
                    {r.name}
                  </button>
                )
              }

              const { group, label, members } = entry
              const selected = members.some((m) => m.id === rhythmId)
              const expanded = openGroup === group
              return (
                <button
                  key={group}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-expanded={expanded}
                  title={`Variaciones de ${label}`}
                  className={[
                    styles.rhythmChip,
                    styles.groupChip,
                    selected ? styles.rhythmChipOn : '',
                    expanded ? styles.groupChipOpen : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onGroupClick(group, members)}
                >
                  {label}
                  <span className={styles.groupCaret} aria-hidden>
                    {expanded ? '▴' : '▾'}
                  </span>
                </button>
              )
            })}
          </div>

          {variations ? (
            <div className={styles.variationPanel}>
              <div className={styles.variationLabel}>
                Variación {variationLabel}
              </div>
              <div
                className={styles.rhythmList}
                role="listbox"
                aria-label={`Variaciones de ${variationLabel}`}
              >
                {variations.map((r) => {
                  const selected = r.id === rhythmId
                  const level = r.level ? LEVEL_LABEL[r.level] : null
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      title={
                        level ? `${level}: ${r.description}` : r.description
                      }
                      className={[
                        chipClass(r, selected),
                        styles.variationChip,
                      ].join(' ')}
                      onClick={() => selectRhythm(r.id)}
                    >
                      {r.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <p className={styles.rhythmDesc}>
            {rhythm?.level ? (
              <span className={styles.levelTag}>
                {LEVEL_LABEL[rhythm.level]}
              </span>
            ) : null}
            {rhythm?.group ? (
              <span className={styles.groupTag}>{rhythm.groupLabel} · </span>
            ) : null}
            {rhythm?.description}
            {rhythm?.vocalization ? (
              <span className={styles.vocalization}>
                {' '}
                · <em>{rhythm.vocalization}</em>
              </span>
            ) : null}
          </p>

          {hitMarks.length > 0 ? (
            <div
              className={styles.hitCounts}
              aria-label={`Golpes en: ${hitMarks.map((m) => m.display).join(', ')}`}
            >
              <span className={styles.hitCountsLabel}>Golpes</span>
              <div className={styles.hitCountsRow}>
                {hitMarks.map((mark) => {
                  const lit = litStep === mark.step
                  const kindClass =
                    mark.kind === 'mute'
                      ? styles.hit_mute
                      : mark.kind === 'slap'
                        ? styles.hit_slap
                        : ''
                  const noteTitle =
                    mark.display !== mark.label
                      ? `${mark.label} · ${mark.display.split('·')[1]} (${mark.kind})`
                      : `${mark.label} (${mark.kind})`
                  return (
                    <span
                      key={`${mark.step}-${mark.kind}-${mark.pitch}`}
                      className={[
                        styles.hitCount,
                        kindClass,
                        lit ? styles.hitCountLit : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={noteTitle}
                    >
                      {mark.display}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
