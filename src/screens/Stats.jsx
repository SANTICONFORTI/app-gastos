import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, BarChart3, Info } from 'lucide-react'
import '../lib/chartSetup'
import CategoryDoughnut from '../components/CategoryDoughnut'
import EvolutionChart from '../components/EvolutionChart'
import PillToggle from '../components/PillToggle'
import WrappedButtons from '../components/WrappedButtons'
import Pressable from '../components/Pressable'
import { usePersonalStore } from '../store/PersonalStore'
import useInflation from '../hooks/useInflation'
import { monthKey, monthName, shiftMonth } from '../lib/dates'
import { expensesOfMonth, isActive, monthTotal, toArs, totalsByCategory } from '../lib/expenses'
import { adjustmentFactor, monthInflation } from '../lib/inflation'
import { formatMoney } from '../lib/format'
import { listContainer, listItem } from '../lib/motion'

const pct = (n) => `${n > 0 ? '+' : ''}${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n)}%`
const MAX_CATEGORY_CHANGES = 6

export default function Stats({ month, onPickMonth, onChangeMonth, onOpenCategory, onOpenExpense, onWrapped }) {
  const store = usePersonalStore()
  const inflation = useInflation()
  const [range, setRange] = useState('6')
  const [mode, setMode] = useState('nominal')

  const current = monthKey()
  const inProgress = month === current
  const previous = shiftMonth(month, -1)
  const total = monthTotal(store.expenses, month)
  const previousTotal = monthTotal(store.expenses, previous)
  const active = expensesOfMonth(store.expenses, month).filter(isActive)

  const rows = totalsByCategory(store.expenses, month).map((t) => {
    const c = store.getCategory(t.categoryId)
    return { key: t.categoryId, name: c.name, color: c.color, value: t.amount, count: active.filter((e) => e.categoryId === t.categoryId).length }
  })

  const handleSelectCategory = useCallback((categoryId) => onOpenCategory(categoryId), [onOpenCategory])
  const handleSelectMonth = useCallback((key) => onChangeMonth(key), [onChangeMonth])

  // Summary
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const daysElapsed = inProgress ? new Date().getDate() : daysInMonth
  const biggest = [...active].sort((a, b) => toArs(b) - toArs(a))[0]

  // Inflation-adjusted comparison
  const inflationReady = Boolean(inflation.data)
  const monthInfl = monthInflation(inflation.data, month)
  const { factor: prevFactor, estimated: prevEstimated } = adjustmentFactor(inflation.data, previous, month)
  const nominalChange = previousTotal > 0 ? (total / previousTotal - 1) * 100 : null
  const realChange = previousTotal > 0 && inflationReady ? (total / (previousTotal * prevFactor) - 1) * 100 : null

  // Per-category changes vs previous month
  const prevRows = Object.fromEntries(totalsByCategory(store.expenses, previous).map((t) => [t.categoryId, t.amount]))
  const categoryIds = [...new Set([...rows.map((r) => r.key), ...Object.keys(prevRows)])]
  const categoryChanges = categoryIds
    .map((id) => {
      const now = rows.find((r) => r.key === id)?.value ?? 0
      const before = prevRows[id] ?? 0
      return { id, now, before, diff: now - before }
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, MAX_CATEGORY_CHANGES)

  // Evolution
  const count = Number(range)
  const adjusted = mode === 'real' && inflationReady
  let anyEstimated = false
  const points = Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1)).map((key) => {
    const nominal = monthTotal(store.expenses, key)
    if (!adjusted) return { month: key, value: nominal, nominal }
    const { factor, estimated } = adjustmentFactor(inflation.data, key, month)
    if (estimated && nominal > 0) anyEstimated = true
    return { month: key, value: nominal * factor, nominal }
  })
  const withData = points.filter((p) => p.value > 0)
  const average = withData.length ? withData.reduce((s, p) => s + p.value, 0) / withData.length : 0

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.header variants={listItem} className="hero">
        <div className="hero-text">
          <span className="hero-label">Análisis de {monthName(month)}</span>
          <h1 className="screen-title">Estadísticas</h1>
        </div>
        <Pressable className="btn btn-glass month-btn" onClick={onPickMonth} aria-label={`Mes: ${monthName(month)}. Cambiar mes`}>
          {monthName(month, { capitalize: true, short: true })} <ChevronDown size={14} strokeWidth={2.5} />
        </Pressable>
      </motion.header>

      {total > 0 && (
        <motion.div variants={listItem}>
          <WrappedButtons month={month} onWrapped={onWrapped} />
        </motion.div>
      )}

      {total === 0 ? (
        <motion.section variants={listItem} className="card glass empty-card">
          <span className="coming-soon-icon glass"><BarChart3 size={26} strokeWidth={2} /></span>
          <p className="card-title">No hay gastos en {monthName(month)}</p>
          <p className="muted-sm">Cuando cargues gastos, acá vas a ver en qué se te va la plata.</p>
        </motion.section>
      ) : (
        <>
          <motion.section variants={listItem} className="card glass stats-card" aria-labelledby="by-cat-title">
            <h2 id="by-cat-title" className="card-title">Por categoría</h2>
            <CategoryDoughnut key={month} rows={rows} total={total} onSelect={handleSelectCategory} />
            <ul className="cat-breakdown">
              {rows.map((r) => (
                <li key={r.key}>
                  <button type="button" className="cat-breakdown-row" onClick={() => onOpenCategory(r.key)}>
                    <span className="legend-dot" style={{ background: r.color }} aria-hidden="true" />
                    <span className="cat-breakdown-name">
                      <span>{r.name}</span>
                      <span className="muted-sm">{r.count} {r.count === 1 ? 'gasto' : 'gastos'}</span>
                    </span>
                    <span className="cat-breakdown-values">
                      <span className="movement-amount">{formatMoney(r.value)}</span>
                      <span className="muted-sm">{Math.round((r.value / total) * 100)}%</span>
                    </span>
                    <ChevronRight size={16} strokeWidth={2.5} className="chip-arrow" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.div variants={listItem} className="summary-grid">
            <div className="stat-tile glass">
              <span className="chip-sub">Gastos</span>
              <span className="chip-title">{active.length}</span>
            </div>
            <div className="stat-tile glass">
              <span className="chip-sub">Por día{inProgress ? ' (hasta hoy)' : ''}</span>
              <span className="chip-title">{formatMoney(Math.round(total / daysElapsed))}</span>
            </div>
            {biggest && (
              <button type="button" className="stat-tile glass stat-tile-wide" onClick={() => onOpenExpense(biggest.id)}>
                <span className="chip-sub">El gasto más grande</span>
                <span className="chip-title">
                  {formatMoney(Math.round(toArs(biggest)))} · {biggest.note || store.getCategory(biggest.categoryId).name}
                </span>
              </button>
            )}
          </motion.div>
        </>
      )}

      <motion.section variants={listItem} className="card glass stats-card" aria-labelledby="compare-title">
        <h2 id="compare-title" className="card-title">Comparado con {monthName(previous)}</h2>
        {nominalChange === null ? (
          <p className="muted-sm">No tenés gastos en {monthName(previous)} para comparar.</p>
        ) : (
          <>
            <div className="compare-grid">
              <ChangeTile label="En pesos" value={nominalChange} detail={`${formatMoney(Math.round(previousTotal))} → ${formatMoney(Math.round(total))}`} />
              {realChange !== null ? (
                <ChangeTile
                  label="Descontando inflación"
                  value={realChange}
                  detail={`${monthName(previous)} en pesos de ${monthName(month)}: ${formatMoney(Math.round(previousTotal * prevFactor))}`}
                />
              ) : (
                <div className="change-tile glass">
                  <span className="chip-sub">Descontando inflación</span>
                  <span className="muted-sm">{inflation.status === 'loading' ? 'Buscando datos…' : 'Sin datos de inflación'}</span>
                </div>
              )}
            </div>
            {realChange !== null && (
              <p className="compare-text">
                {realChange > 0.5
                  ? `En términos reales gastaste ${pct(realChange).replace('+', '')} más que en ${monthName(previous)}.`
                  : realChange < -0.5
                    ? `En términos reales gastaste ${pct(Math.abs(realChange)).replace('+', '')} menos que en ${monthName(previous)}. ¡Bien!`
                    : `En términos reales gastaste casi lo mismo que en ${monthName(previous)}.`}
                {monthInfl && ` La inflación de ${monthName(month)} fue ${new Intl.NumberFormat('es-AR').format(monthInfl.rate)}%${monthInfl.estimated || prevEstimated ? ' (estimada con el último dato publicado)' : ''}.`}
              </p>
            )}
            {inProgress && (
              <p className="muted-sm info-line">
                <Info size={14} strokeWidth={2} aria-hidden="true" /> {monthName(month, { capitalize: true })} todavía no terminó: la comparación puede cambiar.
              </p>
            )}

            <ul className="change-list" aria-label="Cambios por categoría">
              {categoryChanges.map((c) => {
                const cat = store.getCategory(c.id)
                const change = c.before > 0 ? (c.now / c.before - 1) * 100 : null
                const up = c.diff > 0
                return (
                  <li key={c.id} className="change-row">
                    <span className="legend-dot" style={{ background: cat.color }} aria-hidden="true" />
                    <span className="change-name">{cat.name}</span>
                    <span className="muted-sm">{formatMoney(c.now)}</span>
                    <span className={`change-badge ${up ? 'is-up' : 'is-down'}`}>
                      {up ? <TrendingUp size={13} strokeWidth={2.4} aria-hidden="true" /> : <TrendingDown size={13} strokeWidth={2.4} aria-hidden="true" />}
                      {change === null ? 'Nuevo' : pct(change)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </motion.section>

      <motion.section variants={listItem} className="card glass stats-card" aria-labelledby="evolution-title">
        <div className="debts-head">
          <h2 id="evolution-title" className="card-title">Evolución</h2>
          <PillToggle
            label="Período"
            small
            options={[{ id: '6', label: '6 meses' }, { id: '12', label: '12 meses' }]}
            value={range}
            onChange={setRange}
            layoutId="range-pill"
          />
        </div>
        <EvolutionChart points={points} selected={month} adjusted={adjusted} onSelect={handleSelectMonth} />
        <div className="evolution-footer">
          <PillToggle
            label="Cómo ver los montos"
            small
            options={[{ id: 'nominal', label: 'Nominal' }, { id: 'real', label: 'Sin inflación' }]}
            value={mode}
            onChange={setMode}
            layoutId="mode-pill"
          />
          <span className="muted-sm">Promedio {formatMoney(Math.round(average))}/mes</span>
        </div>
        <p className="muted-sm">
          {mode === 'real'
            ? inflationReady
              ? `Todos los meses expresados en pesos de ${monthName(month)}, para comparar lo que realmente gastaste.${anyEstimated ? ' Los meses sin dato oficial usan una inflación estimada.' : ''}`
              : 'No pudimos traer los datos de inflación. Revisá tu conexión.'
            : 'Montos tal como los pagaste. Tocá una barra para ver ese mes.'}
        </p>
        <p className="source-note">Inflación: INDEC, vía ArgentinaDatos.</p>
      </motion.section>
    </motion.div>
  )
}

function ChangeTile({ label, value, detail }) {
  const up = value > 0
  return (
    <div className="change-tile glass">
      <span className="chip-sub">{label}</span>
      <span className={`change-value ${up ? 'is-up' : 'is-down'}`}>
        {up ? <TrendingUp size={18} strokeWidth={2.4} aria-hidden="true" /> : <TrendingDown size={18} strokeWidth={2.4} aria-hidden="true" />}
        {pct(value)}
      </span>
      <span className="muted-sm">{detail}</span>
    </div>
  )
}
