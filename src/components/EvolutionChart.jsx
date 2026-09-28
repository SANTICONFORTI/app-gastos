import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Bar } from 'react-chartjs-2'
import { CHART_COLORS, compactMoney, tooltipStyle } from '../lib/chartSetup'
import { monthLabelWithYear, monthName } from '../lib/dates'
import { formatMoney } from '../lib/format'

/**
 * Monthly totals as bars; the selected month is highlighted.
 * points: [{ month, value, nominal }] — `value` may be inflation adjusted.
 */
export default function EvolutionChart({ points, selected, adjusted, onSelect }) {
  const reduceMotion = useReducedMotion()
  const average = points.reduce((s, p) => s + p.value, 0) / (points.filter((p) => p.value > 0).length || 1)

  const data = useMemo(() => ({
    labels: points.map((p) => monthName(p.month, { capitalize: true }).slice(0, 3)),
    datasets: [{
      data: points.map((p) => p.value),
      backgroundColor: points.map((p) => (p.month === selected ? CHART_COLORS.accent : CHART_COLORS.accentDim)),
      hoverBackgroundColor: CHART_COLORS.accent,
      borderRadius: 10,
      borderSkipped: false,
      barPercentage: 0.66,
      minBarLength: 3,
    }],
  }), [points, selected])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 800, easing: 'easeOutQuart' },
    onClick: (_, elements) => {
      if (elements[0]) onSelect(points[elements[0].index].month)
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          title: (items) => monthLabelWithYear(points[items[0].dataIndex].month),
          label: (ctx) => {
            const p = points[ctx.dataIndex]
            return adjusted && p.nominal !== p.value
              ? [`${formatMoney(Math.round(p.value))} en pesos de ${monthName(selected)}`, `${formatMoney(Math.round(p.nominal))} en su momento`]
              : formatMoney(Math.round(p.value))
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: CHART_COLORS.text2, font: { size: 10, weight: 600 }, maxRotation: 0, autoSkip: false },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: CHART_COLORS.grid },
        ticks: { color: CHART_COLORS.text2, font: { size: 10 }, maxTicksLimit: 4, callback: compactMoney },
      },
    },
  }), [points, selected, adjusted, onSelect, reduceMotion])

  const summary = points.map((p) => `${monthName(p.month)} ${formatMoney(Math.round(p.value))}`).join(', ')

  return (
    <div className="evolution-chart" role="img" aria-label={`Evolución mensual${adjusted ? ' ajustada por inflación' : ''}: ${summary}. Promedio ${formatMoney(Math.round(average))}.`}>
      <Bar data={data} options={options} />
    </div>
  )
}
