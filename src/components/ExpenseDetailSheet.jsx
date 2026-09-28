import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Ban, PlusCircle, History } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import CategoryIcon from './CategoryIcon'
import Amount from './Amount'
import { usePersonalStore } from '../store/PersonalStore'
import useReceiptUrl from '../hooks/useReceiptUrl'
import { formatLongDate, formatWhen } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { toArs } from '../lib/expenses'
import { softSpring } from '../lib/motion'

export default function ExpenseDetailSheet({ expenseId, onClose, onEdit, onDone }) {
  return (
    <Sheet open={Boolean(expenseId)} onClose={onClose} labelledBy="detail-title" space="personal">
      {expenseId && <Detail expenseId={expenseId} onClose={onClose} onEdit={onEdit} onDone={onDone} />}
    </Sheet>
  )
}

function Detail({ expenseId, onClose, onEdit, onDone }) {
  const store = usePersonalStore()
  const expense = store.expenses.find((e) => e.id === expenseId)
  const receiptUrl = useReceiptUrl(expense?.receiptId)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')

  if (!expense) return null
  const category = store.getCategory(expense.categoryId)
  const voided = expense.status === 'voided'
  const history = store.historyOf(expense.id)

  function confirmVoid() {
    store.voidExpense(expense.id, reason)
    onDone('Gasto anulado')
  }

  return (
    <div className="detail">
      <SheetHeader id="detail-title" title="Detalle del gasto" onClose={onClose} />

      <section className={`detail-hero ${voided ? 'is-voided' : ''}`}>
        <CategoryIcon color={category.color} Icon={category.Icon} size={56} />
        <span className="detail-name">{expense.note || category.name}</span>
        <Amount value={toArs(expense)} className="detail-amount" />
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

      <dl className="detail-list glass">
        <div><dt>Categoría</dt><dd>{category.name}</dd></div>
        <div><dt>Fecha</dt><dd>{formatLongDate(expense.spentAt)}</dd></div>
        {expense.note && <div><dt>Nota</dt><dd>{expense.note}</dd></div>}
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

      <section aria-labelledby="history-title" className="history">
        <h2 id="history-title" className="card-title history-title">
          <History size={16} strokeWidth={2} aria-hidden="true" /> Historial
        </h2>
        <ol className="history-list">
          {history.map((h) => <HistoryItem key={h.id} entry={h} getCategory={store.getCategory} />)}
        </ol>
      </section>

      {!voided && (
        <AnimatePresence mode="wait" initial={false}>
          {voiding ? (
            <motion.div
              key="void"
              className="void-form glass"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={softSpring}
            >
              <label htmlFor="void-reason" className="card-title">¿Por qué lo anulás?</label>
              <p className="muted-sm">El gasto no se borra: queda tachado en tu historial con este motivo.</p>
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
                <Pressable className="btn btn-glass" onClick={() => setVoiding(false)}>Cancelar</Pressable>
                <Pressable className="btn btn-danger" disabled={reason.trim().length < 3} onClick={confirmVoid}>
                  Anular gasto
                </Pressable>
              </div>
            </motion.div>
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

const FIELD_LABELS = {
  amount: 'Monto',
  currency: 'Moneda',
  exchangeRate: 'Cotización',
  rateType: 'Tipo de dólar',
  categoryId: 'Categoría',
  note: 'Nota',
  spentAt: 'Fecha',
  receiptId: 'Ticket',
}

function describe(field, value, getCategory) {
  if (value === null || value === '') return '—'
  switch (field) {
    case 'amount': return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)
    case 'exchangeRate': return formatMoney(value)
    case 'categoryId': return getCategory(value).name
    case 'spentAt': return formatLongDate(value)
    case 'receiptId': return 'adjunto'
    case 'currency': return value === 'USD' ? 'USD' : 'ARS'
    default: return String(value)
  }
}

function HistoryItem({ entry, getCategory }) {
  const when = formatWhen(entry.changedAt)
  if (entry.action === 'created') {
    return (
      <li className="history-item">
        <PlusCircle size={16} strokeWidth={2} aria-hidden="true" />
        <span>Cargado · {when}</span>
      </li>
    )
  }
  if (entry.action === 'voided') {
    return (
      <li className="history-item is-voided">
        <Ban size={16} strokeWidth={2} aria-hidden="true" />
        <span>Anulado · {when} · “{entry.after.voidReason}”</span>
      </li>
    )
  }
  return (
    <li className="history-item">
      <Pencil size={16} strokeWidth={2} aria-hidden="true" />
      <span>
        Editado · {when}
        <ul className="history-changes">
          {Object.keys(entry.after).map((field) => (
            <li key={field}>
              {FIELD_LABELS[field] ?? field}: {describe(field, entry.before[field], getCategory)} → {describe(field, entry.after[field], getCategory)}
            </li>
          ))}
        </ul>
      </span>
    </li>
  )
}
