import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Ban, PlusCircle, History } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import CategoryIcon from './CategoryIcon'
import UserAvatar from './UserAvatar'
import Amount from './Amount'
import { VoidForm } from './ExpenseDetailSheet'
import { useGroups } from '../store/GroupsStore'
import { usePersonalStore } from '../store/PersonalStore'
import useReceiptUrl from '../hooks/useReceiptUrl'
import { formatLongDate, formatWhen } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { groupExpenseArs } from '../lib/groupMath'
import { describeGroupChanges } from '../lib/groupHistory'
import { friendlyError } from '../lib/db'

export default function GroupExpenseDetailSheet({ expenseId, onClose, onEdit, onDone }) {
  return (
    <Sheet open={Boolean(expenseId)} onClose={onClose} labelledBy="group-detail-title" space="group">
      {expenseId && <Detail expenseId={expenseId} onClose={onClose} onEdit={onEdit} onDone={onDone} />}
    </Sheet>
  )
}

function Detail({ expenseId, onClose, onEdit, onDone }) {
  const groups = useGroups()
  const store = usePersonalStore()
  const expense = groups.expenses.find((e) => e.id === expenseId)
  const receiptUrl = useReceiptUrl(expense?.receipt_path)
  const [history, setHistory] = useState({ rows: [], status: 'loading' })
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    groups.fetchExpenseHistory(expenseId)
      .then((rows) => !cancelled && setHistory({ rows, status: 'ready' }))
      .catch(() => !cancelled && setHistory({ rows: [], status: 'error' }))
    return () => { cancelled = true }
  }, [expenseId, expense?.updated_at, expense?.status])

  if (!expense) return null
  const category = store.getCategory(expense.category_id)
  const payer = groups.memberById[expense.paid_by]
  const voided = expense.status === 'voided'
  const nameOf = (id) => groups.memberById[id]?.profile?.display_name ?? 'Alguien'
  const rate = expense.currency === 'USD' ? Number(expense.exchange_rate) : 1

  async function confirmVoid() {
    setBusy(true)
    setError('')
    try {
      await groups.voidExpense(expense.id, reason)
      onDone('Gasto anulado. Queda en el historial del grupo')
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="detail">
      <SheetHeader id="group-detail-title" title="Gasto del grupo" onClose={onClose} />

      <section className={`detail-hero ${voided ? 'is-voided' : ''}`}>
        <CategoryIcon color={category.color} Icon={category.Icon} size={56} />
        <span className="detail-name">{expense.note || category.name}</span>
        <Amount value={groupExpenseArs(expense)} className="detail-amount" />
        {expense.currency === 'USD' && (
          <span className="muted-sm">
            US$ {new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(expense.amount)} · dólar {expense.rate_type} a {formatMoney(rate)}
          </span>
        )}
      </section>

      {voided && (
        <div className="void-banner" role="note">
          <Ban size={18} strokeWidth={2} aria-hidden="true" />
          <span>Anulado por {nameOf(expense.voided_by)} · {formatWhen(expense.voided_at)} · “{expense.void_reason}”. No cuenta en las deudas.</span>
        </div>
      )}

      <dl className="detail-list glass">
        <div>
          <dt>Pagó</dt>
          <dd className="dd-person"><UserAvatar profile={payer?.profile} size={24} /> {nameOf(expense.paid_by)}</dd>
        </div>
        <div><dt>Fecha</dt><dd>{formatLongDate(expense.spent_at)}</dd></div>
        <div><dt>Categoría</dt><dd>{category.name}</dd></div>
      </dl>

      <section aria-labelledby="split-title">
        <h2 id="split-title" className="card-title list-title">Se divide entre {expense.split_snapshot?.length ?? 0}</h2>
        <ul className="split-detail">
          {(expense.split_snapshot ?? []).map((s) => (
            <li key={s.user_id}>
              <UserAvatar profile={groups.memberById[s.user_id]?.profile} size={32} />
              <span className="split-name">{nameOf(s.user_id)}</span>
              <span className="split-amount">{formatMoney(Number(s.amount) * rate)}</span>
            </li>
          ))}
        </ul>
      </section>

      {receiptUrl && (
        <figure className="detail-receipt">
          <a href={receiptUrl} target="_blank" rel="noreferrer"><img src={receiptUrl} alt="Foto del ticket" /></a>
          <figcaption className="muted-sm">Ticket · tocá para verlo completo</figcaption>
        </figure>
      )}

      <section aria-labelledby="gh-title" className="history">
        <h2 id="gh-title" className="card-title history-title"><History size={16} strokeWidth={2} aria-hidden="true" /> Historial</h2>
        {history.status === 'loading' && <p className="muted-sm">Cargando historial…</p>}
        {history.status === 'error' && <p className="muted-sm">No pudimos cargar el historial.</p>}
        <ol className="history-list">
          {history.rows.map((h) => {
            const who = nameOf(h.changed_by)
            if (h.action === 'created') {
              return <li key={h.id} className="history-item"><PlusCircle size={16} strokeWidth={2} aria-hidden="true" /><span>{who} lo cargó · {formatWhen(h.changed_at)}</span></li>
            }
            if (h.action === 'voided') {
              return <li key={h.id} className="history-item is-voided"><Ban size={16} strokeWidth={2} aria-hidden="true" /><span>{who} lo anuló · {formatWhen(h.changed_at)} · “{h.after?.void_reason}”</span></li>
            }
            const changes = describeGroupChanges(h.before, h.after, { nameOf, categoryName: (id) => store.getCategory(id).name })
            if (changes.length === 0) return null
            return (
              <li key={h.id} className="history-item">
                <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  {who} lo editó · {formatWhen(h.changed_at)}
                  <ul className="history-changes">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
                </span>
              </li>
            )
          })}
        </ol>
      </section>

      {groups.isAdmin && !voided && (
        <AnimatePresence mode="wait" initial={false}>
          {voiding ? (
            <VoidForm
              key="void"
              title="¿Por qué lo anulás?"
              explanation="No se borra: queda tachado para todos, con tu nombre, la fecha y este motivo."
              confirmLabel="Anular gasto"
              reason={reason}
              setReason={setReason}
              busy={busy}
              error={error}
              onCancel={() => setVoiding(false)}
              onConfirm={confirmVoid}
            />
          ) : (
            <motion.div key="actions" className="detail-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Pressable className="btn btn-glass btn-lg" onClick={() => onEdit(expense)}><Pencil size={16} strokeWidth={2.2} /> Editar</Pressable>
              <Pressable className="btn btn-danger-ghost btn-lg" onClick={() => setVoiding(true)}><Ban size={16} strokeWidth={2.2} /> Anular</Pressable>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      {!groups.isAdmin && !voided && <p className="muted-sm detail-note">Solo los admins pueden editar o anular gastos.</p>}
    </div>
  )
}
