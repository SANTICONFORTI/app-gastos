import { monthLabelWithYear, monthName } from './dates'

/** Human text for where a purchase stands (see planProgress). */
export function planStatusText(progress) {
  switch (progress.state) {
    case 'upcoming': return `Empieza en ${monthName(progress.startMonth ?? progress.endMonth)}`
    case 'last': return 'Última cuota este mes'
    case 'finished': return `Terminada en ${monthLabelWithYear(progress.endMonth).toLowerCase()}`
    case 'voided': return 'Compra anulada'
    default: {
      const remaining = progress.remaining === 1 ? 'falta 1' : `faltan ${progress.remaining}`
      return `Cuota ${progress.currentNumber} de ${progress.total} · ${remaining} · termina en ${monthLabelWithYear(progress.endMonth).toLowerCase()}`
    }
  }
}
