import { motion, useReducedMotion } from 'framer-motion'

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 9

/**
 * Category donut that draws itself on appear.
 * Placeholder built with SVG; stage 4 moves charts to Chart.js.
 */
export default function DonutChart({ segments, centerTop, centerBottom, size = 112 }) {
  const reduceMotion = useReducedMotion()
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  let offset = 0

  return (
    <svg width={size} height={size} viewBox="0 0 124 124" role="img" aria-label="Gastos por categoría">
      <g transform="rotate(-90 62 62)" fill="none" strokeWidth="13" strokeLinecap="round">
        <circle cx="62" cy="62" r={RADIUS} stroke="rgba(255,255,255,.06)" />
        {segments.map((s, i) => {
          const length = Math.max((s.value / total) * CIRCUMFERENCE - GAP, 1)
          const dashOffset = -offset
          offset += (s.value / total) * CIRCUMFERENCE
          return (
            <motion.circle
              key={s.key}
              cx="62"
              cy="62"
              r={RADIUS}
              stroke={s.color}
              strokeDashoffset={dashOffset}
              initial={reduceMotion ? false : { strokeDasharray: `0 ${CIRCUMFERENCE}` }}
              animate={{ strokeDasharray: `${length} ${CIRCUMFERENCE}` }}
              transition={{ duration: 0.9, delay: 0.25 + i * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
            />
          )
        })}
      </g>
      <text x="62" y="58" textAnchor="middle" fill="var(--text-2)" fontSize="11" fontWeight="600">
        {centerTop}
      </text>
      <text x="62" y="77" textAnchor="middle" fill="var(--text)" fontSize="19" fontWeight="800">
        {centerBottom}
      </text>
    </svg>
  )
}
