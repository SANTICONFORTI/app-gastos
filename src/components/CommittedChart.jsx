import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Bar } from 'react-chartjs-2'
import { CHART_COLORS, tooltipStyle } from '../lib/chartSetup'
import { monthName } from '../lib/dates'
import { formatMoney } from '../lib/format'

const ACCENT = CHART_COLORS.accent
const ACCENT_DIM = CHART_COLORS.accentDim
const TEXT_2 = CHART_COLORS.text2

/** Bars with what's committed in installments for each upcoming month. Tapping a bar selects it. */
export default function CommittedChart({ months, selected, onSelect }) {
  const reduceMotion = useReducedMotion()

  const data = useMemo(() => ({
    labels: months.map((m) => monthName(m.month, { capitalize: true }).slice(0, 3)),
    datasets: [{
      data: months.map((m) => m.total),
      backgroundColor: months.map((m) => (m.month === selected ? ACCENT : ACCENT_DIM)),
      hoverBackgroundColor: ACCENT,
      borderRadius: 999,
      borderSkipped: false,
      barPercentage: 0.62,
      categoryPercentage: 0.9,
      minBarLength: 4,
    }],
  }), [months, selected])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 900, easing: 'easeOutQuart' },
    onClick: (_, elements) => {
      if (elements[0]) onSelect(months[elements[0].index].month)
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle,
        callbacks: { label: (ctx) => formatMoney(Math.round(ctx.parsed.y)) },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: TEXT_2, font: { size: 10, weight: 600 }, maxRotation: 0, autoSkip: false },
      },
      y: { display: false, beginAtZero: true },
    },
  }), [months, onSelect, reduceMotion])

  const summary = months.map((m) => `${monthName(m.month)}: ${formatMoney(Math.round(m.total))}`).join(', ')

  return (
    <div className="committed-chart" role="img" aria-label={`Comprometido en cuotas por mes. ${summary}`}>
      <Bar data={data} options={options} />
    </div>
  )
}
