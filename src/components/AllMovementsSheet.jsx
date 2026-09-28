import { useState } from 'react'
import { motion } from 'framer-motion'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import PersonalMovementRow from './PersonalMovementRow'
import { usePersonalStore } from '../store/PersonalStore'
import { monthName } from '../lib/dates'
import { expensesOfMonth } from '../lib/expenses'
import { listContainer } from '../lib/motion'

export default function AllMovementsSheet({ open, month, onClose, onOpenExpense }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="all-title" space="personal" tall>
      <AllMovements month={month} onClose={onClose} onOpenExpense={onOpenExpense} />
    </Sheet>
  )
}

function AllMovements({ month, onClose, onOpenExpense }) {
  const store = usePersonalStore()
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [showVoided, setShowVoided] = useState(true)

  const all = expensesOfMonth(store.expenses, month)
  const presentCategories = [...new Set(all.map((e) => e.categoryId))].map(store.getCategory)
  const list = all.filter((e) =>
    (!categoryFilter || e.categoryId === categoryFilter) && (showVoided || e.status === 'active'))

  return (
    <>
      <SheetHeader id="all-title" title={`Movimientos de ${monthName(month)}`} onClose={onClose} />

      {all.length > 0 && (
        <div className="filter-row" role="group" aria-label="Filtrar">
          <FilterChip active={!categoryFilter} onClick={() => setCategoryFilter(null)}>Todas</FilterChip>
          {presentCategories.map((c) => (
            <FilterChip key={c.id} active={categoryFilter === c.id} color={c.color} onClick={() => setCategoryFilter(c.id)}>
              {c.name}
            </FilterChip>
          ))}
          <FilterChip active={showVoided} onClick={() => setShowVoided((v) => !v)}>Ver anulados</FilterChip>
        </div>
      )}

      {list.length === 0 ? (
        <p className="empty-text">No hay movimientos para mostrar.</p>
      ) : (
        <motion.ul className="movement-list" variants={listContainer} initial="hidden" animate="show">
          {list.map((e) => <PersonalMovementRow key={e.id} expense={e} onOpen={onOpenExpense} />)}
        </motion.ul>
      )}
    </>
  )
}

function FilterChip({ active, color, onClick, children }) {
  return (
    <button type="button" className={`filter-chip ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={onClick}>
      {color && <span className="legend-dot" style={{ background: color }} aria-hidden="true" />}
      {children}
    </button>
  )
}
