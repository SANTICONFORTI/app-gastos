import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, Plus, BarChart3, SlidersHorizontal, ChevronDown } from 'lucide-react'
import Amount from '../components/Amount'
import ChipCard from '../components/ChipCard'
import CategoryIcon from '../components/CategoryIcon'
import DonutChart from '../components/DonutChart'
import MovementRow from '../components/MovementRow'
import Pressable from '../components/Pressable'
import { categoryById } from '../data/categories'
import { demoPersonal as data } from '../data/demo'
import { formatMoney } from '../lib/format'
import { listContainer, listItem } from '../lib/motion'

export default function PersonalHome({ onAdd, onSoon }) {
  const total = data.byCategory.reduce((sum, c) => sum + c.amount, 0)
  const change = Math.round(((data.total - data.previousTotal) / data.previousTotal) * 100)
  const segments = data.byCategory.map((c) => ({
    key: c.categoryId,
    value: c.amount,
    color: categoryById[c.categoryId].color,
  }))

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.section variants={listItem} className="hero">
        <div className="hero-text">
          <span className="hero-label">Gastaste este mes</span>
          <Amount value={data.total} />
        </div>
        <Pressable className="btn btn-glass month-btn" onClick={() => onSoon('Elegir mes')}>
          Sep <ChevronDown size={14} strokeWidth={2.5} />
        </Pressable>
      </motion.section>

      <motion.div variants={listItem} className="chip-grid">
        <ChipCard
          icon={<CategoryIcon color="#4ADE80" Icon={DollarSign} size={42} />}
          title={formatMoney(data.blueRate)}
          subtitle="Dólar blue"
          onClick={() => onSoon('Cotizaciones del dólar')}
        />
        <ChipCard
          icon={<CategoryIcon color="#FFB547" Icon={TrendingUp} size={42} />}
          title={formatMoney(data.antTotal)}
          subtitle="Gastos hormiga"
          onClick={() => onSoon('Gastos hormiga')}
        />
      </motion.div>

      <motion.div variants={listItem} className="action-row">
        <Pressable className="btn btn-primary btn-lg action-btn" onClick={onAdd}>
          <span className="btn-plus"><Plus size={13} strokeWidth={3.2} /></span>
          Agregar gasto
        </Pressable>
        <Pressable className="btn btn-glass btn-lg action-btn" onClick={() => onSoon('Análisis')}>
          <BarChart3 size={16} strokeWidth={2.2} />
          Ver análisis
        </Pressable>
      </motion.div>

      <motion.section variants={listItem} className="card glass donut-card" aria-label="Gastos por categoría">
        <DonutChart
          segments={segments}
          centerTop="vs. agosto"
          centerBottom={`${change > 0 ? '+' : ''}${change}%`}
        />
        <ul className="legend">
          {data.byCategory.map((c) => {
            const cat = categoryById[c.categoryId]
            return (
              <li key={c.categoryId}>
                <span className="legend-name">
                  <span className="legend-dot" style={{ background: cat.color }} />
                  {cat.name}
                </span>
                <span className="legend-value">{Math.round((c.amount / total) * 100)}%</span>
              </li>
            )
          })}
        </ul>
      </motion.section>

      <motion.section variants={listItem} aria-labelledby="personal-movements">
        <div className="section-head">
          <h2 id="personal-movements" className="section-title">Últimos movimientos</h2>
          <Pressable className="btn btn-glass small-btn" onClick={() => onSoon('Todos los movimientos')}>
            <SlidersHorizontal size={13} strokeWidth={2.2} /> Todos
          </Pressable>
        </div>
        <motion.ul className="movement-list" variants={listContainer} initial="hidden" animate="show">
          {data.movements.map((m) => {
            const cat = categoryById[m.categoryId]
            return (
              <MovementRow
                key={m.id}
                icon={<CategoryIcon color={cat.color} Icon={cat.Icon} />}
                title={m.title}
                detail={m.detail}
                amount={m.amount}
                side={cat.name}
              />
            )
          })}
        </motion.ul>
      </motion.section>
    </motion.div>
  )
}
