import { formatLongDate } from './dates'
import { formatMoney } from './format'

// Turns raw expense_history snapshots of group expenses into readable changes.

const money = (row, value) => (row?.currency === 'USD'
  ? `US$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)}`
  : formatMoney(Number(value)))

/** ['Monto: $ 900 → $ 1.000', 'División: entre 3 → entre 2', ...] */
export function describeGroupChanges(before, after, { nameOf, categoryName }) {
  if (!before || !after) return []
  const changes = []
  if (Number(before.amount) !== Number(after.amount) || before.currency !== after.currency) {
    changes.push(`Monto: ${money(before, before.amount)} → ${money(after, after.amount)}`)
  }
  if (before.paid_by !== after.paid_by) {
    changes.push(`Pagó: ${nameOf(before.paid_by)} → ${nameOf(after.paid_by)}`)
  }
  if ((before.note ?? '') !== (after.note ?? '')) {
    changes.push(`Nota: ${before.note || '—'} → ${after.note || '—'}`)
  }
  if (before.category_id !== after.category_id) {
    changes.push(`Categoría: ${categoryName(before.category_id)} → ${categoryName(after.category_id)}`)
  }
  if (Date.parse(before.spent_at) !== Date.parse(after.spent_at)) {
    changes.push(`Fecha: ${formatLongDate(before.spent_at)} → ${formatLongDate(after.spent_at)}`)
  }
  if (!before.receipt_path && after.receipt_path) changes.push('Se agregó el ticket')
  const splitKey = (s) => JSON.stringify((s ?? []).map((x) => [x.user_id, Number(x.amount)]))
  if (splitKey(before.split_snapshot) !== splitKey(after.split_snapshot)) {
    const describe = (s) => (s ?? []).map((x) => `${nameOf(x.user_id)} ${money(after, x.amount)}`).join(', ')
    changes.push(`División: ${describe(before.split_snapshot)} → ${describe(after.split_snapshot)}`)
  }
  return changes
}
