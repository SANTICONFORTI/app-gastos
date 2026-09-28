import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

/** Segmented pill (radio group) with a gliding highlight. */
export default function PillToggle({ label, options, value, onChange, layoutId, small = false }) {
  return (
    <div className={`currency-toggle glass ${small ? 'is-small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`currency-option ${value === o.id ? 'is-active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {value === o.id && <motion.span layoutId={layoutId} className="currency-pill" transition={spring} />}
          <span className="switcher-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
