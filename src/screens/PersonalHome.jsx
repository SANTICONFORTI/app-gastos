import { motion } from 'framer-motion'
import { DollarSign, CreditCard, Plus, BarChart3, SlidersHorizontal, ChevronDown, Receipt } from 'lucide-react'
import Amount from '../components/Amount'
import ChipCard from '../components/ChipCard'
import CategoryIcon from '../components/CategoryIcon'
import DonutChart from '../components/DonutChart'
import PersonalMovementRow from '../components/PersonalMovementRow'
import Pressable from '../components/Pressable'
import { usePersonalStore } from '../store/PersonalStore'
import useDollarRates from '../hooks/useDollarRates'
import { monthKey, monthName, shiftMonth } from '../lib/dates'
import { expensesOfMonth, monthTotal, totalsByCategory } from '../lib/expenses'
import { formatMoney } from '../lib/format'
import { listContainer, listItem } from '../lib/motion'

const MAX_SEGMENTS = 5
const RECENT_COUNT = 5

export default function PersonalHome({ month, onPickMonth, onAdd, onOpenExpense, onSeeAll, onSoon, onNotice }) {
  const store = usePersonalStore()
  const rates = useDollarRates()

  const isCurrentMonth = month === monthKey()
  const total = monthTotal(store.expenses, month)
  const previousKey = shiftMonth(month, -1)
  const previousTotal = monthTotal(store.expenses, previousKey)
  const monthExpenses = expensesOfMonth(store.expenses, month)
  const recent = monthExpenses.slice(0, RECENT_COUNT)

  function rateChip(type, label, color, Icon) {
    const q = rates.data?.quotes?.[type]
    const title = q ? formatMoney(Math.round(q.sell)) :rates.status === 'loading' ? 'Cargando…' : 'Sin datos'
    const subtitle = rates.status === 'stale' ? `${label} (sin conexión)` : label
    return (
      <ChipCard
        icon={<CategoryIcon color={color} Icon={Icon} size={38} />}
        title={title}
        subtitle={subtitle}
        onClick={() => onNotice(q
          ? `${label}: compra ${formatMoney(q.buy)} · venta ${formatMoney(q.sell)}`
          : 'No pudimos traer la cotización. Revisá tu conexión.')}
      />
    )
  }

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.section variants={listItem} className="hero">
        <div className="hero-text">
          <span className="hero-label">{isCurrentMonth ? 'Gastaste este mes' : `Gastaste en ${monthName(month)}`}</span>
          <Amount value={total} />
        </div>
        <Pressable className="btn btn-glass month-btn" onClick={onPickMonth} aria-label={`Mes: ${monthName(month)}. Cambiar mes`}>
          {monthName(month, { capitalize: true, short: true })} <ChevronDown size={14} strokeWidth={2.5} />
        </Pressable>
      </motion.section>

      <motion.div variants={listItem} className="chip-grid">
        {rateChip('blue', 'Dólar blue', '#4ADE80', DollarSign)}
        {rateChip('tarjeta', 'Dólar tarjeta', '#FFB547', CreditCard)}
      </motion.div>

      <motion.div variants={listItem} className="action-row">
        <Pressable className="btn btn-primary btn-lg action-btn" onClick={onAdd}>
          <span className="btn-plus"><Plus size={13} strokeWidth={3.2} /></span>
          Agregar gasto
        </Pressable>
        <Pressable className="btn btn-glass btn-lg action-btn" onClick={() => onSoon('Análisis (etapa 4)')}>
          <BarChart3 size={16} strokeWidth={2.2} />
          Ver análisis
        </Pressable>
      </motion.div>

      {total > 0 ? (
        <CategorySummary
          month={month}
          total={total}
          previousKey={previousKey}
          previousTotal={previousTotal}
          count={monthExpenses.filter((e) => e.status === 'active').length}
        />
      ) : (
        <motion.section variants={listItem} className="card glass empty-card">
          <span className="coming-soon-icon glass"><Receipt size={26} strokeWidth={2} /></span>
          <p className="card-title">
            {isCurrentMonth ? 'Todavía no cargaste gastos este mes' : `No tenés gastos en ${monthName(month)}`}
          </p>
          <p className="muted-sm">Tocá “Agregar gasto” para empezar a llevar la cuenta.</p>
        </motion.section>
      )}

      {monthExpenses.length > 0 && (
        <motion.section variants={listItem} aria-labelledby="personal-movements">
          <div className="section-head">
            <h2 id="personal-movements" className="section-title">Últimos movimientos</h2>
            <Pressable className="btn btn-glass small-btn" onClick={onSeeAll}>
              <SlidersHorizontal size={13} strokeWidth={2.2} /> Todos ({monthExpenses.length})
            </Pressable>
          </div>
          <motion.ul className="movement-list" variants={listContainer} initial="hidden" animate="show">
            {recent.map((e) => <PersonalMovementRow key={e.id} expense={e} onOpen={onOpenExpense} />)}
          </motion.ul>
        </motion.section>
      )}
    </motion.div>
  )
}

function CategorySummary({ month, total, previousKey, previousTotal, count }) {
  const { expenses, getCategory } = usePersonalStore()
  const totals = totalsByCategory(expenses, month)

  // Keep the chart readable: top categories + the rest grouped.
  let rows = totals.map((t) => ({ key: t.categoryId, name: getCategory(t.categoryId).name, color: getCategory(t.categoryId).color, value: t.amount }))
  if (rows.length > MAX_SEGMENTS) {
    const rest = rows.slice(MAX_SEGMENTS - 1).reduce((sum, r) => sum + r.value, 0)
    rows = [...rows.slice(0, MAX_SEGMENTS - 1), { key: 'rest', name: 'Resto', color: '#6E7FA3', value: rest }]
  }

  const change = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null

  return (
    <motion.section variants={listItem} className="card glass donut-card" aria-label="Gastos por categoría">
      <DonutChart
        key={month}
        segments={rows}
        centerTop={change === null ? 'este mes' : `vs. ${monthName(previousKey)}`}
        centerBottom={change === null ? `${count} ${count === 1 ? 'gasto' : 'gastos'}` : `${change > 0 ? '+' : ''}${change}%`}
      />
      <ul className="legend">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="legend-name">
              <span className="legend-dot" style={{ background: r.color }} />
              <span className="legend-label">{r.name}</span>
            </span>
            <span className="legend-value">{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </motion.section>
  )
}
