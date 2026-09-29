// "Gastos hormiga": small, frequent expenses, detected with simple rules (no AI).
// A group is the same shop (from the note) or, without a note, the same category.

import { expensesOfMonth, isActive, toArs } from './expenses'
import { monthKey, shiftMonth } from './dates'

const SETTINGS_KEY = 'puly:hormiga'
export const DEFAULT_SETTINGS = { maxAmount: 15000, minCount: 3 }

export function readAntSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveAntSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Settings just won't persist on this device.
  }
}

/** 'Café  Martínez!' -> 'cafe martinez' */
export function normalizeNote(note = '') {
  return note
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const keyOf = (e) => {
  const note = normalizeNote(e.note)
  return note ? `nota:${note}` : `cat:${e.categoryId}`
}

/** Small expenses of a month grouped by shop/category: Map key -> { items, total } */
function groupSmall(expenses, month, maxAmount) {
  const groups = new Map()
  for (const e of expensesOfMonth(expenses, month)) {
    if (!isActive(e) || e.installmentPlanId) continue
    const ars = toArs(e)
    if (ars > maxAmount) continue
    const key = keyOf(e)
    const g = groups.get(key) ?? { key, items: [], total: 0 }
    g.items.push(e)
    g.total += ars
    groups.set(key, g)
  }
  return groups
}

/** Most frequent way the user wrote the note (keeps their capitalization). */
function labelOf(group, getCategory) {
  if (group.key.startsWith('cat:')) return getCategory(group.key.slice(4)).name
  const counts = {}
  for (const e of group.items) counts[e.note.trim()] = (counts[e.note.trim()] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

/**
 * Ant expenses of `month`, biggest first:
 * [{ key, label, byCategory, categoryId, count, total, average, monthlyPace, yearly, previousTotal, growth }]
 */
export function detectAnts(expenses, month, { maxAmount, minCount }, getCategory, today = new Date()) {
  const current = monthKey(today)
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const daysElapsed = month === current ? today.getDate() : daysInMonth

  const previous = groupSmall(expenses, shiftMonth(month, -1), maxAmount)
  const ants = []
  for (const g of groupSmall(expenses, month, maxAmount).values()) {
    if (g.items.length < minCount) continue
    // In the month in progress, project what's left of the month at the same pace.
    const monthlyPace = month === current ? (g.total / daysElapsed) * daysInMonth : g.total
    const prev = previous.get(g.key)?.total ?? 0
    ants.push({
      key: g.key,
      label: labelOf(g, getCategory),
      byCategory: g.key.startsWith('cat:'),
      categoryId: g.items[0].categoryId,
      count: g.items.length,
      total: g.total,
      average: g.total / g.items.length,
      monthlyPace,
      yearly: monthlyPace * 12,
      previousTotal: prev,
      growth: prev > 0 ? (g.total / prev - 1) * 100 : null,
      items: g.items,
    })
  }
  return ants.sort((a, b) => b.total - a.total)
}

/**
 * A relatable comparison built from the user's own data (no made-up prices):
 * installments of a purchase, a whole category of this month, or dollars.
 */
export function equivalenceFor(ant, { plans, installmentsOf, categoryTotals, getCategory, blueRate }) {
  const yearly = ant.yearly
  // 1) Installments of one of their purchases.
  for (const plan of plans) {
    if (plan.status !== 'active') continue
    const first = installmentsOf(plan.id)[0]
    const cuota = first ? first.amount * (first.exchangeRate ?? 1) : 0
    const n = cuota > 0 ? Math.floor(yearly / cuota) : 0
    if (n >= 1 && n <= 60) {
      return `En un año equivale a ${n} ${n === 1 ? 'cuota' : 'cuotas'} de tu ${plan.note || getCategory(plan.categoryId).name}.`
    }
  }
  // 2) A whole category of the month (not the ant's own category).
  const other = categoryTotals.find((c) => c.categoryId !== ant.categoryId && c.amount > 0 && ant.monthlyPace >= c.amount * 0.5)
  if (other) {
    const times = ant.monthlyPace / other.amount
    return times >= 1
      ? `Por mes es más de lo que gastaste en ${getCategory(other.categoryId).name}.`
      : `Por mes es más de la mitad de lo que gastaste en ${getCategory(other.categoryId).name}.`
  }
  // 3) Dollars.
  if (blueRate) return `En un año son unos US$ ${Math.round(yearly / blueRate).toLocaleString('es-AR')} al blue de hoy.`
  return null
}
