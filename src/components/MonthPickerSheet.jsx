import { Check } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import { usePersonalStore } from '../store/PersonalStore'
import { monthKey, monthLabelWithYear, shiftMonth } from '../lib/dates'
import { monthTotal } from '../lib/expenses'
import { formatMoney } from '../lib/format'

const MONTHS_BACK = 12

export default function MonthPickerSheet({ open, value, onChange, onClose }) {
  const { expenses } = usePersonalStore()
  const current = monthKey()
  const months = Array.from({ length: MONTHS_BACK }, (_, i) => shiftMonth(current, -i))

  return (
    <Sheet open={open} onClose={onClose} labelledBy="month-title" space="personal">
      <SheetHeader id="month-title" title="Elegí el mes" onClose={onClose} />
      <ul className="option-list" role="listbox" aria-labelledby="month-title">
        {months.map((key) => {
          const total = monthTotal(expenses, key)
          const selected = key === value
          return (
            <li key={key}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`option-row ${selected ? 'is-active' : ''}`}
                onClick={() => { onChange(key); onClose() }}
              >
                <span className="option-main">{monthLabelWithYear(key)}</span>
                <span className="muted-sm">{total > 0 ? formatMoney(total) : 'Sin gastos'}</span>
                <span className="option-check" aria-hidden="true">{selected && <Check size={18} strokeWidth={2.6} />}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
