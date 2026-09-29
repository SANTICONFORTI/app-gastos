import { motion } from 'framer-motion'
import { BellRing, AlertTriangle } from 'lucide-react'
import { nextDueDate, useExtras } from '../store/ExtrasStore'
import { usePersonalStore } from '../store/PersonalStore'
import { budgetStatus } from './BudgetsSheet'
import { formatMoney } from '../lib/format'
import { listItem } from '../lib/motion'

const REMIND_DAYS = 3

function whenText(date) {
  const today = new Date()
  const days = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
  return days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`
}

/** Upcoming recurring expenses (next 3 days) and budgets close to or over their limit. */
export default function RemindersCard({ onOpenRecurring, onOpenBudgets }) {
  const extras = useExtras()
  const store = usePersonalStore()
  if (extras.status !== 'ready') return null

  const today = new Date()
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() + REMIND_DAYS)
  const due = extras.recurring
    .filter((r) => r.active)
    .map((r) => ({ r, date: nextDueDate(r, today) }))
    .filter((x) => x.date <= limit)
    .sort((a, b) => a.date - b.date)
  const budgets = budgetStatus(store, extras.budgets).filter((b) => b.state !== 'ok')
  if (due.length === 0 && budgets.length === 0) return null

  return (
    <motion.section variants={listItem} className="card glass member-card reminders" aria-label="Avisos">
      {due.map(({ r, date }) => (
        <button key={r.id} type="button" className="reminder-row" onClick={onOpenRecurring}>
          <BellRing size={18} strokeWidth={2.2} aria-hidden="true" className="reminder-icon" />
          <span>Vence <strong>{whenText(date)}</strong>: {r.note} ({r.currency === 'USD' ? `US$ ${r.amount}` : formatMoney(Number(r.amount))})</span>
        </button>
      ))}
      {budgets.map((b) => {
        const c = store.getCategory(b.category_id)
        return (
          <button key={b.id} type="button" className={`reminder-row budget-${b.state}`} onClick={onOpenBudgets}>
            <AlertTriangle size={18} strokeWidth={2.2} aria-hidden="true" className="reminder-icon" />
            <span>
              {b.state === 'over'
                ? <>Te pasaste en <strong>{c.name}</strong>: {formatMoney(Math.round(b.used))} de {formatMoney(b.limit)}</>
                : <>Vas por el {Math.round(b.ratio * 100)}% de tu presupuesto de <strong>{c.name}</strong></>}
            </span>
          </button>
        )
      })}
    </motion.section>
  )
}
