import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

const OPTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'group', label: 'Grupos' },
]

/** Personal / Grupos pill selector; the active option lights up and glides between positions. */
export default function SpaceSwitcher({ space, onChange }) {
  return (
    <div className="switcher glass" role="tablist" aria-label="Espacio">
      {OPTIONS.map((o) => {
        const active = o.id === space
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            className={`switcher-option ${active ? 'is-active' : ''}`}
            onClick={() => onChange(o.id)}
          >
            {active && <motion.span layoutId="switcher-pill" className="switcher-pill" transition={spring} />}
            <span className="switcher-label">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
