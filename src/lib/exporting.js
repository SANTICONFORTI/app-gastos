// Export personal expenses without libraries:
// - "Excel": CSV with ; separators, decimal commas and a UTF-8 BOM (opens right in Excel in Spanish).
// - PDF: a print-styled report the browser saves with "Guardar como PDF".

import { monthKey } from './dates'
import { toArs } from './expenses'
import { download } from './wrappedImage'

const num = (n) => (n === null || n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','))
const esc = (v) => {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const dateFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function periodExpenses(store, months) {
  return store.expenses
    .filter((e) => months.includes(monthKey(e.spentAt)))
    .sort((a, b) => a.spentAt.localeCompare(b.spentAt))
}

export function exportCsv(store, months, fileName) {
  const header = ['Fecha', 'Descripción', 'Categoría', 'Moneda', 'Monto', 'Cotización', 'Monto en pesos', 'Estado', 'Motivo de anulación', 'Cuota']
  const rows = periodExpenses(store, months).map((e) => {
    const plan = e.installmentPlanId ? store.getPlan(e.installmentPlanId) : null
    return [
      dateFmt.format(new Date(e.spentAt)),
      e.note || '',
      store.getCategory(e.categoryId).name,
      e.currency,
      num(e.amount),
      e.currency === 'USD' ? num(e.exchangeRate) : '',
      num(toArs(e)),
      e.status === 'voided' ? 'Anulado' : 'Activo',
      e.voidReason ?? '',
      plan ? `${e.installmentNumber} de ${plan.installmentCount}` : '',
    ]
  })
  const csv = [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
  download(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `${fileName}.csv`)
  return rows.length
}
