import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CreditCard, PartyPopper, Plus } from 'lucide-react'
import Amount from '../components/Amount'
import CategoryIcon from '../components/CategoryIcon'
import CommittedChart from '../components/CommittedChart'
import ProgressBar from '../components/ProgressBar'
import Pressable from '../components/Pressable'
import { usePersonalStore } from '../store/PersonalStore'
import { monthKey, monthLabelWithYear, monthName, shiftMonth } from '../lib/dates'
import { toArs } from '../lib/expenses'
import { formatMoney } from '../lib/format'
import { committedByMonth, planProgress } from '../lib/installments'
import { planStatusText } from '../lib/planText'
import { listContainer, listItem } from '../lib/motion'

const MONTHS_AHEAD = 12
const ONGOING = ['upcoming', 'active', 'last']

export default function Installments({ onAddInstallments, onOpenPlan, onOpenExpense }) {
  const store = usePersonalStore()
  const current = monthKey()
  const [selected, setSelected] = useState(shiftMonth(current, 1))

  const months = committedByMonth(store.expenses, current, MONTHS_AHEAD)
  const selectedMonth = months.find((m) => m.month === selected) ?? months[0]
  const remaining = months.slice(1).reduce((sum, m) => sum + m.total, 0)
  const pendingAfterWindow = store.expenses.filter((e) =>
    e.installmentPlanId && e.status === 'active' && monthKey(e.spentAt) > shiftMonth(current, MONTHS_AHEAD - 1))
  const totalPending = remaining + pendingAfterWindow.reduce((sum, e) => sum + toArs(e), 0)

  const plans = store.plans
    .map((plan) => ({ plan, progress: planProgress(plan, current) }))
    .sort((a, b) => b.plan.createdAt.localeCompare(a.plan.createdAt))
  const ongoing = plans.filter((p) => ONGOING.includes(p.progress.state))
  const past = plans.filter((p) => !ONGOING.includes(p.progress.state))
  const finishing = ongoing.filter((p) => p.progress.state === 'last')

  if (plans.length === 0) {
    return (
      <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
        <motion.h1 variants={listItem} className="screen-title">Cuotas</motion.h1>
        <motion.section variants={listItem} className="card glass empty-card">
          <span className="coming-soon-icon glass"><CreditCard size={26} strokeWidth={2} /></span>
          <p className="card-title">Todavía no cargaste compras en cuotas</p>
          <p className="muted-sm">
            Cada cuota se cuenta en su mes, y acá vas a ver cuánto tenés comprometido en los próximos meses.
          </p>
          <Pressable className="btn btn-primary btn-lg" onClick={onAddInstallments}>
            <Plus size={16} strokeWidth={2.6} /> Cargar compra en cuotas
          </Pressable>
        </motion.section>
      </motion.div>
    )
  }

  const selectedIndex = months.indexOf(selectedMonth)

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.section variants={listItem} className="hero">
        <div className="hero-text">
          <span className="hero-label">Comprometido en cuotas · {monthName(shiftMonth(current, 1))}</span>
          <Amount value={months[1].total} />
        </div>
      </motion.section>

      <motion.div variants={listItem} className="chip-grid">
        <div className="stat-tile glass">
          <span className="chip-sub">Este mes pagás</span>
          <span className="chip-title">{formatMoney(Math.round(months[0].total))}</span>
        </div>
        <div className="stat-tile glass">
          <span className="chip-sub">Total que falta</span>
          <span className="chip-title">{formatMoney(Math.round(totalPending))}</span>
        </div>
      </motion.div>

      {finishing.map(({ plan }) => (
        <motion.button
          key={plan.id}
          variants={listItem}
          type="button"
          className="finish-banner finish-banner-btn"
          onClick={() => onOpenPlan(plan.id)}
        >
          <PartyPopper size={18} strokeWidth={2} aria-hidden="true" />
          <span>Este mes pagás la última cuota de <strong>{plan.note || store.getCategory(plan.categoryId).name}</strong>.</span>
        </motion.button>
      ))}

      <motion.section variants={listItem} className="card glass committed-card" aria-labelledby="committed-title">
        <div className="debts-head">
          <h2 id="committed-title" className="card-title">Comprometido a futuro</h2>
          <span className="muted-sm">próximos {MONTHS_AHEAD} meses</span>
        </div>
        <CommittedChart months={months} selected={selectedMonth.month} onSelect={setSelected} />

        <div className="month-nav">
          <Pressable
            className="btn btn-glass btn-icon"
            aria-label="Mes anterior"
            disabled={selectedIndex <= 0}
            onClick={() => setSelected(months[selectedIndex - 1].month)}
          >
            <ChevronLeft size={18} strokeWidth={2.4} />
          </Pressable>
          <div className="month-nav-text" aria-live="polite">
            <span className="card-title">{monthLabelWithYear(selectedMonth.month)}</span>
            <span className="muted-sm">{formatMoney(Math.round(selectedMonth.total))} en {selectedMonth.items.length} {selectedMonth.items.length === 1 ? 'cuota' : 'cuotas'}</span>
          </div>
          <Pressable
            className="btn btn-glass btn-icon"
            aria-label="Mes siguiente"
            disabled={selectedIndex >= months.length - 1}
            onClick={() => setSelected(months[selectedIndex + 1].month)}
          >
            <ChevronRight size={18} strokeWidth={2.4} />
          </Pressable>
        </div>

        {selectedMonth.items.length > 0 ? (
          <ul className="committed-items">
            {selectedMonth.items.map((e) => {
              const plan = store.getPlan(e.installmentPlanId)
              const category = store.getCategory(e.categoryId)
              return (
                <li key={e.id}>
                  <button type="button" className="committed-item" onClick={() => onOpenExpense(e.id)}>
                    <span className="legend-dot" style={{ background: category.color }} aria-hidden="true" />
                    <span className="committed-item-name">{e.note || category.name}</span>
                    <span className="muted-sm">{e.installmentNumber}/{plan?.installmentCount}</span>
                    <span className="committed-item-amount">{formatMoney(toArs(e))}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted-sm committed-empty">No tenés cuotas en este mes.</p>
        )}
      </motion.section>

      {ongoing.length > 0 && (
        <PlanSection title="En curso" items={ongoing} onOpenPlan={onOpenPlan} />
      )}
      {past.length > 0 && (
        <PlanSection title="Terminadas y anuladas" items={past} onOpenPlan={onOpenPlan} dimmed />
      )}
    </motion.div>
  )
}

function PlanSection({ title, items, onOpenPlan, dimmed = false }) {
  const store = usePersonalStore()
  const id = `plans-${title.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <motion.section variants={listItem} aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id} className="section-title">{title}</h2>
      </div>
      <ul className={`plan-list ${dimmed ? 'is-dimmed' : ''}`}>
        {items.map(({ plan, progress }) => {
          const category = store.getCategory(plan.categoryId)
          const first = store.installmentsOf(plan.id)[0]
          return (
            <li key={plan.id}>
              <button type="button" className={`plan-card glass ${plan.status === 'voided' ? 'is-voided' : ''}`} onClick={() => onOpenPlan(plan.id)}>
                <span className="plan-card-top">
                  <CategoryIcon color={category.color} Icon={category.Icon} size={42} />
                  <span className="movement-main">
                    <span className="movement-title">{plan.note || category.name}</span>
                    <span className="movement-detail">{planStatusText(progress)}</span>
                  </span>
                  <span className="movement-side">
                    <span className="movement-amount">{first ? formatMoney(toArs(first)) : ''}</span>
                    <span className="movement-detail">{plan.card || 'por mes'}</span>
                  </span>
                </span>
                {plan.status !== 'voided' && <ProgressBar value={progress.ratio} label={`Avance de ${plan.note || category.name}`} />}
              </button>
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}
