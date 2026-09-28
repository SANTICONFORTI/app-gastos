import { Ban, Pencil, PlusCircle, History } from 'lucide-react'
import { formatLongDate, formatWhen, monthLabelWithYear } from '../lib/dates'
import { formatMoney } from '../lib/format'

const FIELD_LABELS = {
  amount: 'Monto',
  currency: 'Moneda',
  exchangeRate: 'Cotización',
  rateType: 'Tipo de dólar',
  categoryId: 'Categoría',
  note: 'Nota',
  spentAt: 'Fecha',
  receiptId: 'Ticket',
  card: 'Tarjeta',
}

function describe(field, value, getCategory) {
  if (value === null || value === undefined || value === '') return '—'
  switch (field) {
    case 'amount': return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)
    case 'exchangeRate': return formatMoney(value)
    case 'categoryId': return getCategory(value).name
    case 'spentAt': return formatLongDate(value)
    case 'receiptId': return 'adjunto'
    default: return String(value)
  }
}

/** Timeline of created / edited / voided entries for an expense or an installment purchase. */
export default function HistoryList({ entries, getCategory }) {
  return (
    <section aria-labelledby="history-title" className="history">
      <h2 id="history-title" className="card-title history-title">
        <History size={16} strokeWidth={2} aria-hidden="true" /> Historial
      </h2>
      <ol className="history-list">
        {entries.map((h) => <HistoryItem key={h.id} entry={h} getCategory={getCategory} />)}
      </ol>
    </section>
  )
}

function HistoryItem({ entry, getCategory }) {
  const when = formatWhen(entry.changedAt)
  const isPlan = Boolean(entry.planId)

  if (entry.action === 'created') {
    return (
      <li className="history-item">
        <PlusCircle size={16} strokeWidth={2} aria-hidden="true" />
        <span>
          {isPlan
            ? `Compra en ${entry.after.installmentCount} cuotas cargada (desde ${monthLabelWithYear(entry.after.firstMonth).toLowerCase()})`
            : 'Cargado'} · {when}
        </span>
      </li>
    )
  }
  if (entry.action === 'voided') {
    const extra = isPlan
      ? ` · se anularon ${entry.after.voidedInstallments} ${entry.after.voidedInstallments === 1 ? 'cuota futura' : 'cuotas futuras'}`
      : ''
    return (
      <li className="history-item is-voided">
        <Ban size={16} strokeWidth={2} aria-hidden="true" />
        <span>{isPlan ? 'Compra anulada' : 'Anulado'} · {when} · “{entry.after.voidReason}”{extra}</span>
      </li>
    )
  }
  return (
    <li className="history-item">
      <Pencil size={16} strokeWidth={2} aria-hidden="true" />
      <span>
        {isPlan ? 'Compra editada' : 'Editado'} · {when}
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
