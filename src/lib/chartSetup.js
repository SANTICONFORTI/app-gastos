// Registers only the Chart.js pieces we use (keeps the bundle small) and shared styling.
import {
  Chart as ChartJS, ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Filler,
} from 'chart.js'
import { formatMoney } from './format'

ChartJS.register(ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler)

ChartJS.defaults.font.family = "-apple-system, 'SF Pro Text', Manrope, system-ui, sans-serif"

export const CHART_COLORS = {
  accent: '#5AC8FA',
  accentDim: 'rgba(90, 200, 250, 0.32)',
  text2: '#A9B6CE',
  grid: 'rgba(255, 255, 255, 0.06)',
}

export const tooltipStyle = {
  displayColors: false,
  backgroundColor: 'rgba(20, 34, 62, 0.95)',
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 12,
  titleFont: { weight: 700 },
}

export const moneyTick = (value) => formatMoney(Math.round(value))

/** Compact axis labels: 1.250.000 -> '1,3 M', 45.000 -> '45 k'. */
export function compactMoney(value) {
  if (Math.abs(value) >= 1e6) return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value / 1e6)} M`
  if (Math.abs(value) >= 1e3) return `${Math.round(value / 1e3)} k`
  return String(Math.round(value))
}
