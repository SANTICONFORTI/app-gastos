import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Pencil, PartyPopper } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import CategoryIcon from './CategoryIcon'
import Amount from './Amount'
import HistoryList from './HistoryList'
import CategoryPicker from './CategoryPicker'
import ProgressBar from './ProgressBar'
import { VoidForm } from './ExpenseDetailSheet'
import { usePersonalStore } from '../store/PersonalStore'
import useReceiptUrl from '../hooks/useReceiptUrl'
import useHistory from '../hooks/useHistory'
import { friendlyError } from '../lib/db'
import { formatLongDate, monthKey, monthLabelWithYear } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { toArs } from '../lib/expenses'
import { planProgress } from '../lib/installments'
import { planStatusText } from '../lib/planText'
import { softSpring } from '../lib/motion'

export default function PlanDetailSheet({ planId, onClose, onOpenExpense, onDone }) {
  return (
    <Sheet open={Boolean(planId)} onClose={onClose} labelledBy="plan-title" space="personal">
      {planId && <PlanDetail planId={planId} onClose={onClose} onOpenExpense={onOpenExpense} onDone={onDone} />}
    </Sheet>
  )
}

function PlanDetail({ planId, onClose, onOpenExpense, onDone }) {
  const store = usePersonalStore()
  const plan = store.getPlan(planId)
  const receiptUrl = useReceiptUrl(plan?.receiptId)
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'void'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const history = useHistory(
    () => store.fetchPlanHistory(planId),
    `${planId}-${plan?.status}-${plan?.categoryId}-${plan?.note}-${plan?.card}`,
  )

  if (!plan) return null
  const category = store.getCategory(plan.categoryId)
  const installments = store.installmentsOf(plan.id)
  const progress = planProgress(plan)
  const current = monthKey()
  const rate = plan.exchangeRate ?? 1
  const futureActive = installments.filter((e) => e.status === 'active' && monthKey(e.spentAt) > current).length
  const voided = plan.status === 'voided'

  async function confirmVoid() {
    setBusy(true)
    setError('')
    try {
      await store.voidInstallmentPlan(plan.id, reason)
      onDone('Compra anulada')
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="detail">
      <SheetHeader id="plan-title" title="Compra en cuotas" onClose={onClose} />

      <section className={`detail-hero ${voided ? 'is-voided' : ''}`}>
        <CategoryIcon color={category.color} Icon={category.Icon} size={56} />
        <span className="detail-name">{plan.note || category.name}</span>
        <Amount value={plan.totalAmount * rate} className="detail-amount" />
        <span className="muted-sm">
          {plan.installmentCount} cuotas de {formatMoney(toArs(installments[0] ?? { amount: 0 }))}
          {plan.currency === 'USD' ? ` (US$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(plan.totalAmount)} al dólar ${plan.rateType})` : ''}
        </span>
      </section>

      {progress.state === 'last' && (
        <div className="finish-banner" role="status">
          <PartyPopper size={18} strokeWidth={2} aria-hidden="true" />
          <span>Este mes pagás la última cuota. ¡Terminás de pagar esta compra!</span>
        </div>
      )}

      {voided ? (
        <div className="void-banner" role="note">
          <Ban size={18} strokeWidth={2} aria-hidden="true" />
          <span>Compra anulada · “{plan.voidReason}”. Las cuotas de los meses siguientes a la anulación no suman.</span>
        </div>
      ) : (
        <div className="plan-progress glass">
          <span className="plan-progress-text">{planStatusText(progress)}</span>
          <ProgressBar value={progress.ratio} label="Cuotas pagadas" />
        </div>
      )}

      <dl className="detail-list glass">
        <div><dt>Categoría</dt><dd>{category.name}</dd></div>
        <div><dt>Comprada el</dt><dd>{formatLongDate(plan.purchasedAt)}</dd></div>
        <div><dt>Primera cuota</dt><dd>{monthLabelWithYear(plan.firstMonth)}</dd></div>
        <div><dt>Última cuota</dt><dd>{monthLabelWithYear(progress.endMonth)}</dd></div>
        {plan.card && <div><dt>Tarjeta</dt><dd>{plan.card}</dd></div>}
      </dl>

      <section aria-labelledby="installments-title">
        <h2 id="installments-title" className="card-title list-title">Cuotas</h2>
        <ul className="installment-list">
          {installments.map((e) => {
            const key = monthKey(e.spentAt)
            const status = e.status === 'voided' ? 'Anulada' : key < current ? 'Pagada' : key === current ? 'Este mes' : 'Pendiente'
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className={`installment-row ${e.status === 'voided' ? 'is-voided' : ''} ${key === current ? 'is-current' : ''}`}
                  onClick={() => onOpenExpense(e.id)}
                >
                  <span className="installment-number">{e.installmentNumber}</span>
                  <span className="installment-month">{monthLabelWithYear(key)}</span>
                  <span className={`installment-status status-${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
                  <span className="installment-amount">{formatMoney(toArs(e))}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {receiptUrl && (
        <figure className="detail-receipt">
          <a href={receiptUrl} target="_blank" rel="noreferrer">
            <img src={receiptUrl} alt="Foto del ticket" />
          </a>
          <figcaption className="muted-sm">Ticket · tocá para verlo completo</figcaption>
        </figure>
      )}

      <HistoryList entries={history.entries} status={history.status} getCategory={store.getCategory} />

      {!voided && (
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'void' && (
            <VoidForm
              key="void"
              title="¿Por qué anulás la compra?"
              explanation={futureActive > 0
                ? `Se anulan las ${futureActive} cuotas de los próximos meses. Las de este mes y las anteriores quedan, porque ya se cobraron.`
                : 'No quedan cuotas futuras: las ya cobradas quedan en tu historial.'}
              confirmLabel="Anular compra"
              reason={reason}
              setReason={setReason}
              busy={busy}
              error={error}
              onCancel={() => setMode('view')}
              onConfirm={confirmVoid}
            />
          )}
          {mode === 'edit' && (
            <PlanEditForm key="edit" plan={plan} onCancel={() => setMode('view')} onDone={onDone} />
          )}
          {mode === 'view' && (
            <motion.div key="actions" className="detail-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Pressable className="btn btn-glass btn-lg" onClick={() => setMode('edit')}>
                <Pencil size={16} strokeWidth={2.2} /> Editar
              </Pressable>
              <Pressable className="btn btn-danger-ghost btn-lg" onClick={() => setMode('void')}>
                <Ban size={16} strokeWidth={2.2} /> Anular compra
              </Pressable>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

function PlanEditForm({ plan, onCancel, onDone }) {
  const store = usePersonalStore()
  const [categoryId, setCategoryId] = useState(plan.categoryId)
  const [note, setNote] = useState(plan.note ?? '')
  const [card, setCard] = useState(plan.card ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    try {
      const changed = await store.editInstallmentPlan(plan.id, { categoryId, note: note.trim(), card: card.trim() })
      onDone(changed ? 'Cambios guardados en todas las cuotas' : 'No hubo cambios')
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="void-form glass"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={softSpring}
    >
      <p className="card-title">Editar compra</p>
      <p className="muted-sm">
        Los cambios se aplican a todas las cuotas. Para cambiar el monto o la cantidad de cuotas, anulá la compra y cargala de nuevo.
      </p>
      <label className="sr-only" htmlFor="plan-note">Qué compraste</label>
      <input id="plan-note" className="note-input glass" placeholder="¿Qué compraste?" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="sr-only" htmlFor="plan-card">Tarjeta</label>
      <input
        id="plan-card"
        className="note-input glass"
        placeholder="Tarjeta (opcional)"
        maxLength={30}
        list="plan-known-cards"
        value={card}
        onChange={(e) => setCard(e.target.value)}
      />
      <datalist id="plan-known-cards">
        {store.cards.map((c) => <option key={c} value={c} />)}
      </datalist>
      <CategoryPicker value={categoryId} onChange={setCategoryId} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="detail-actions">
        <Pressable className="btn btn-glass" onClick={onCancel} disabled={busy}>Cancelar</Pressable>
        <Pressable className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Pressable>
      </div>
    </motion.div>
  )
}
