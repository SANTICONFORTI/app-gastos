import { motion } from 'framer-motion'
import { spring, tap } from '../lib/motion'

/** A real <button> that shrinks slightly when pressed (spring). */
export default function Pressable({ className = '', type = 'button', children, ...props }) {
  return (
    <motion.button type={type} className={className} whileTap={tap} transition={spring} {...props}>
      {children}
    </motion.button>
  )
}
