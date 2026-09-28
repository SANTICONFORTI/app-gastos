import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { splitAmount } from '../lib/format'

/** Big, heavy amount with dimmed decimals. Counts up when the value changes. */
export default function Amount({ value, symbol = '$', className = '' }) {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(reduceMotion ? value : 0)
  const fromRef = useRef(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) {
      setShown(value)
      return
    }
    const controls = animate(fromRef.current, value, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(v),
    })
    fromRef.current = value
    return () => controls.stop()
  }, [value, reduceMotion])

  const { integer, decimals } = splitAmount(shown)
  const final = splitAmount(value)
  return (
    <span className={`amount ${className}`} aria-label={`${symbol} ${final.integer},${final.decimals}`}>
      <span aria-hidden="true">
        {symbol} {integer}
        <span className="amount-decimals">,{decimals}</span>
      </span>
    </span>
  )
}
