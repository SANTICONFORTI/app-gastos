import { motion } from 'framer-motion'
import { Ban } from 'lucide-react'
import { listItem } from '../lib/motion'
import { formatMoney } from '../lib/format'

/** One movement in a list. Voided movements stay visible: struck through, dimmed, dashed border. */
export default function MovementRow({ icon, title, detail, amount, side, voided }) {
  if (voided) {
    return (
      <motion.li variants={listItem} className="movement movement-voided">
        <span className="movement-voided-icon" aria-hidden="true">
          <Ban size={19} strokeWidth={2} />
        </span>
        <span className="movement-main">
          <span className="movement-voided-line">
            <s>{title}</s>
            <s>{formatMoney(amount)}</s>
          </span>
          <span className="movement-voided-detail">
            Anulado por {voided.by} · {voided.when} · “{voided.reason}”
          </span>
        </span>
      </motion.li>
    )
  }

  return (
    <motion.li variants={listItem} className="movement">
      {icon}
      <span className="movement-main">
        <span className="movement-title">{title}</span>
        <span className="movement-detail">{detail}</span>
      </span>
      <span className="movement-side">
        <span className="movement-amount">{formatMoney(amount)}</span>
        <span className="movement-detail">{side}</span>
      </span>
    </motion.li>
  )
}
