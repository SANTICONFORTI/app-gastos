import { AnimatePresence, motion } from 'framer-motion'
import { softSpring } from '../lib/motion'

/** Small floating message at the top of the screen. */
export default function Toast({ message }) {
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            className="toast glass"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={softSpring}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
