import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Doughnut } from 'react-chartjs-2'
import { tooltipStyle } from '../lib/chartSetup'
import { formatMoney } from '../lib/format'
import Amount from './Amount'

/** Category doughnut (Chart.js) with the month total in the middle. Tapping a slice selects its category. */
export default function CategoryDoughnut({ rows, total, onSelect }) {
  const reduceMotion = useReducedMotion()

  const data = useMemo(() => ({
    labels: rows.map((r) => r.name),
    datasets: [{
      data: rows.map((r) => r.value),
      backgroundColor: rows.map((r) => r.color),
      borderColor: 'rgba(10, 20, 40, 1)',
      borderWidth: 3,
      borderRadius: 8,
      hoverOffset: 6,
    }],
  }), [rows])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    animation: reduceMotion ? false : { animateRotate: true, duration: 900, easing: 'easeOutQuart' },
    onClick: (_, elements) => {
      if (elements[0]) onSelect(rows[elements[0].index].key)
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          label: (ctx) => `${formatMoney(Math.round(ctx.parsed))} · ${Math.round((ctx.parsed / total) * 100)}%`,
        },
      },
    },
  }), [rows, total, onSelect, reduceMotion])

  return (
    <div className="doughnut-wrap">
      <div className="doughnut-canvas" role="img" aria-label={`Gastos por categoría: ${rows.map((r) => `${r.name} ${Math.round((r.value / total) * 100)}%`).join(', ')}`}>
        <Doughnut data={data} options={options} />
      </div>
      <div className="doughnut-center" aria-hidden="true">
        <span className="muted-sm">Total</span>
        <Amount value={total} className="doughnut-amount" />
      </div>
    </div>
  )
}
