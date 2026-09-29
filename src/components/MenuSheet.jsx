import { ChevronRight } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import CategoryIcon from './CategoryIcon'

/** Extra tools: goals, budgets, recurring expenses, export, notifications, install… */
export default function MenuSheet({ open, items, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="menu-title" space="personal">
      <SheetHeader id="menu-title" title="Más" onClose={onClose} />
      <ul className="option-list">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="event-row" onClick={item.onClick}>
              <CategoryIcon color={item.color} Icon={item.Icon} size={40} />
              <span className="movement-main">
                <span className="movement-title">{item.title}</span>
                <span className="movement-detail">{item.subtitle}</span>
              </span>
              <ChevronRight size={16} strokeWidth={2.5} className="chip-arrow" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
