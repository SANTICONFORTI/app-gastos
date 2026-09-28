import { motion } from 'framer-motion'
import Pressable from '../components/Pressable'
import { softSpring } from '../lib/motion'

/** Full-screen loading or error message. */
export default function StatusScreen({ loading = false, title, text, action, secondary }) {
  return (
    <main className="status-screen" aria-busy={loading}>
      {loading ? (
        <motion.span
          className="auth-logo status-logo"
          aria-label="Cargando"
          animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          $
        </motion.span>
      ) : (
        <motion.div className="status-box" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
          <h1 className="screen-title">{title}</h1>
          {text && <p className="muted-sm">{text}</p>}
          <div className="detail-actions">
            {secondary && <Pressable className="btn btn-glass btn-lg" onClick={secondary.onClick}>{secondary.label}</Pressable>}
            {action && <Pressable className="btn btn-primary btn-lg" onClick={action.onClick}>{action.label}</Pressable>}
          </div>
        </motion.div>
      )}
    </main>
  )
}
