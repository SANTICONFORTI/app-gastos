import { motion } from 'framer-motion'

/** Thin progress bar in the accent color; grows with a spring when it appears. */
export default function ProgressBar({ value, label }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <motion.span
        className="progress-fill"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
      />
    </div>
  )
}
