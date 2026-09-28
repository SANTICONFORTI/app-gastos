import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Ban, CreditCard, ChevronRight } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import CategoryIcon from './CategoryIcon'
import Amount from './Amount'
import HistoryList from './HistoryList'
import { usePersonalStore } from '../store/PersonalStore'
import useReceiptUrl from '../hooks/useReceiptUrl'
import { formatLongDate, formatWhen } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { toArs } from '../lib/expenses'
import { softSpring } from '../lib/motion'

export default function ExpenseDetailSheet({ expenseId, onClose, onEdit, onOpenPlan, onDone }) {
  return (
    <Sheet open={Boolean(expenseId)} onClose={onClose} labelledBy="detail-title" space="personal">
      {expenseId && <Detail expenseId={expenseId} onClose={onClose} onEdit={onEdit} onOpenPlan={onOpenPlan} onDone={onDone} />}
    </Sheet>
  )
}

function Detail({ expenseId, onClose, onEdit, onOpenPlan, onDone }) {
  const store = usePersonalStore()
  const expense = store.expenses.find((e) => e.id === expenseId)
  const plan = expense?.installmentPlanId ? store.getPlan(expense.installmentPlanId) : null
  const receiptUrl = useReceiptUrl(plan ? plan.receiptId : expense?.receiptId)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')

  if (!expense) return null
  const category = store.getCategory(expense.categoryId)
  const voided = expense.status === 'voided'

  function confirmVoid() {
    store.voidExpense(expense.id, reason)
    onDone('Gasto anulado')
  }

  return (
    <div className="detail">
      <SheetHeader id="detail-title" title={plan ? 'Detalle de la cuota' : 'Detalle del gasto'} onClose={onClose} />

      <section className={`detail-hero ${voided ? 'is-voided' : ''}`}>
        <CategoryIcon color={category.color} Icon={category.Icon} size={56} />
        <span className="detail-name">{expense.note || category.name}</span>
        <Amount value={toArs(expense)} className="detail-amount" />
        {plan && (
          <span className="installment-badge">Cuota {expense.installmentNumber} de {plan.installmentCount}</span>
        )}
        {expense.currency === 'USD' && (
          <span className="muted-sm">
            US$ {new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(expense.amount)} · dólar {expense.rateType} a {formatMoney(expense.exchangeRate)} (cotización guardada)
          </span>
        )}
      </section>

      {voided && (
        <div className="void-banner" role="note">
          <Ban size={18} strokeWidth={2} aria-hidden="true" />
          <span>
            Anulado · {formatWhen(expense.voidedAt)} · “{expense.voidReason}”. No suma en tus totales.
          </span>
        </div>
      )}

      {plan && (
        <Pressable className="chip glass plan-link" onClick={() => onOpenPlan(plan.id)}>
          <CategoryIcon color="#5AC8FA" Icon={CreditCard} size={38} />
          <span className="chip-text">
            <span className="chip-title">Ver la compra completa</span>
            <span className="chip-sub">
              Total {formatMoney(plan.totalAmount * (plan.exchangeRate ?? 1))}{plan.card ? ` · ${plan.card}` : ''}
            </span>
          </span>
          <ChevronRight size={16} strokeWidth={2.5} className="chip-arrow" aria-hidden="true" />
        </Pressable>
      )}

      <dl className="detail-list glass">
        <div><dt>Categoría</dt><dd>{category.name}</dd></div>
        <div><dt>{plan ? 'Mes de la cuota' : 'Fecha'}</dt><dd>{formatLongDate(expense.spentAt)}</dd></div>
        {expense.note && <div><dt>{plan ? 'Compra' : 'Nota'}</dt><dd>{expense.note}</dd></div>}
        <div><dt>Moneda</dt><dd>{expense.currency === 'USD' ? 'Dólares' : 'Pesos'}</dd></div>
      </dl>

      {receiptUrl && (
        <figure className="detail-receipt">
          <a href={receiptUrl} target="_blank" rel="noreferrer">
            <img src={receiptUrl} alt="Foto del ticket" />
          </a>
          <figcaption className="muted-sm">Ticket · tocá para verlo completo</figcaption>
        </figure>
      )}

      <HistoryList entries={store.historyOf(expense.id)} getCategory={store.getCategory} />

      {plan && !voided && (
        <p className="muted-sm detail-note">Para editar o anular, abrí la compra completa: los cambios se aplican a todas sus cuotas.</p>
      )}

      {!plan && !voided && (
        <AnimatePresence mode="wait" initial={false}>
          {voiding ? (
            <VoidForm
              key="void"
              title="¿Por qué lo anulás?"
              explanation="El gasto no se borra: queda tachado en tu historial con este motivo."
              confirmLabel="Anular gasto"
              reason={reason}
              setReason={setReason}
              onCancel={() => setVoiding(false)}
              onConfirm={confirmVoid}
            />
          ) : (
            <motion.div key="actions" className="detail-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Pressable className="btn btn-glass btn-lg" onClick={() => onEdit(expense)}>
                <Pencil size={16} strokeWidth={2.2} /> Editar
              </Pressable>
              <Pressable className="btn btn-danger-ghost btn-lg" onClick={() => setVoiding(true)}>
                <Ban size={16} strokeWidth={2.2} /> Anular
              </Pressable>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

/** Mandatory-reason confirmation used to void expenses and purchases. */
export function VoidForm({ title, explanation, confirmLabel, reason, setReason, onCancel, onConfirm }) {
  return (
    <motion.div
      className="void-form glass"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={softSpring}
    >
      <label htmlFor="void-reason" className="card-title">{title}</label>
      <p className="muted-sm">{explanation}</p>
      <textarea
        id="void-reason"
        className="void-textarea"
        rows={2}
        maxLength={120}
        placeholder="Ej: lo cargué dos veces"
        value={reason}
        autoFocus
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="detail-actions">
        <Pressable className="btn btn-glass" onClick={onCancel}>Cancelar</Pressable>
        <Pressable className="btn btn-danger" disabled={reason.trim().length < 3} onClick={onConfirm}>
          {confirmLabel}
        </Pressable>
      </div>
    </motion.div>
  )
}
