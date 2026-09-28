import { motion } from 'framer-motion'
import { softSpring } from '../lib/motion'

/** Placeholder for sections built in later stages. */
export default function ComingSoon({ Icon, title, stage }) {
  return (
    <motion.div
      className="coming-soon"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={softSpring}
    >
      <span className="coming-soon-icon glass">
        <Icon size={30} strokeWidth={2} />
      </span>
      <h1 className="coming-soon-title">{title}</h1>
      <p className="coming-soon-text">Esta sección llega en la {stage}.</p>
    </motion.div>
  )
}
