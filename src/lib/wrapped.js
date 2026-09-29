// Wrapped: a story-style summary of a month or a year, built as a list of slides.
// Every slide is plain data so the same thing can be animated on screen and drawn as an image.

import { isActive, toArs, totalsByCategory } from './expenses'
import { monthKey, monthName, shiftMonth } from './dates'
import { detectAnts, equivalenceFor, readAntSettings } from './ants'
import { adjustmentFactor } from './inflation'
import { lastMonthOf } from './installments'
import { balancesByMember, groupExpenseArs, isCharged } from './groupMath'
import { eventExpenseArs } from './eventMath'
import { formatMoney } from './format'

const pct = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}%`
const money = (n) => formatMoney(Math.round(n))

/** Months (YYYY-MM) covered by a period. */
export function periodMonths(period) {
  if (period.type === 'month') return [period.key]
  return Array.from({ length: 12 }, (_, i) => `${period.year}-${String(i + 1).padStart(2, '0')}`)
}

export function periodLabel(period) {
  return period.type === 'month' ? `${monthName(period.key, { capitalize: true })} ${period.key.slice(0, 4)}` : `Tu ${period.year}`
}

const inPeriod = (iso, months) => months.includes(monthKey(iso))

/**
 * Personal slides. Returns [] if there's nothing to show.
 * slide: { id, kicker, title, value, lines: [], list?: [{ label, value, color }], accent }
 */
export function personalWrapped(period, store, { inflation, blueRate } = {}) {
  const months = periodMonths(period)
  const expenses = store.expenses.filter((e) => isActive(e) && inPeriod(e.spentAt, months) && isCharged2(e))
  if (expenses.length === 0) return []
  const total = expenses.reduce((s, e) => s + toArs(e), 0)
  const label = periodLabel(period)
  const slides = []

  slides.push({
    id: 'intro',
    kicker: 'Puly Wrapped',
    title: period.type === 'month' ? `Tu ${monthName(period.key)} en gastos` : `Tu ${period.year} en gastos`,
    value: null,
    lines: ['Tocá para ver cómo te fue.'],
    accent: '#5AC8FA',
  })

  slides.push({
    id: 'total',
    kicker: label,
    title: 'Gastaste en total',
    value: money(total),
    lines: [`En ${expenses.length} ${expenses.length === 1 ? 'gasto' : 'gastos'}.`, `Unos ${money(total / daysIn(period))} por día.`],
    accent: '#5AC8FA',
  })

  // Top category (+ ranking).
  const byCat = {}
  for (const e of expenses) byCat[e.categoryId] = (byCat[e.categoryId] ?? 0) + toArs(e)
  const ranking = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const [topId, topAmount] = ranking[0]
  const top = store.getCategory(topId)
  slides.push({
    id: 'category',
    kicker: 'Tu categoría top',
    title: top.name,
    value: money(topAmount),
    lines: [`El ${Math.round((topAmount / total) * 100)}% de todo lo que gastaste.`],
    list: ranking.slice(0, 4).map(([id, amount]) => ({ label: store.getCategory(id).name, value: `${Math.round((amount / total) * 100)}%`, color: store.getCategory(id).color })),
    accent: top.color,
  })

  // Ant champion.
  const settings = readAntSettings()
  const antTotals = new Map()
  for (const m of months) {
    for (const a of detectAnts(store.expenses, m, settings, store.getCategory, new Date(`${m}-28T12:00:00`))) {
      const cur = antTotals.get(a.key) ?? { ...a, total: 0, count: 0 }
      cur.total += a.total
      cur.count += a.count
      antTotals.set(a.key, cur)
    }
  }
  const champion = [...antTotals.values()].sort((a, b) => b.total - a.total)[0]
  if (champion) {
    const yearly = period.type === 'month' ? champion.total * 12 : champion.total
    const equivalence = equivalenceFor({ ...champion, yearly, monthlyPace: yearly / 12 }, {
      plans: store.plans,
      installmentsOf: store.installmentsOf,
      categoryTotals: period.type === 'month' ? totalsByCategory(store.expenses, period.key) : [],
      getCategory: store.getCategory,
      blueRate,
    })
    slides.push({
      id: 'ant',
      kicker: 'Tu gasto hormiga campeón',
      title: champion.label,
      value: money(champion.total),
      lines: [
        `${champion.count} veces, de a poquito.`,
        period.type === 'month' ? `A este ritmo son ${money(yearly)} al año.` : null,
        equivalence,
      ].filter(Boolean),
      accent: '#FFB547',
    })
  }

  // Biggest single expense.
  const biggest = [...expenses].sort((a, b) => toArs(b) - toArs(a))[0]
  slides.push({
    id: 'biggest',
    kicker: 'El gasto más grande',
    title: biggest.note || store.getCategory(biggest.categoryId).name,
    value: money(toArs(biggest)),
    lines: [new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date(biggest.spentAt))],
    accent: '#FF7A96',
  })

  // Year: most expensive month.
  if (period.type === 'year') {
    const byMonth = months.map((m) => ({ m, total: expenses.filter((e) => monthKey(e.spentAt) === m).reduce((s, e) => s + toArs(e), 0) }))
    const peak = [...byMonth].sort((a, b) => b.total - a.total)[0]
    slides.push({
      id: 'peak',
      kicker: 'Tu mes más gastador',
      title: monthName(peak.m, { capitalize: true }),
      value: money(peak.total),
      lines: ['Algo pasó ese mes…'],
      list: byMonth.filter((x) => x.total > 0).map((x) => ({ label: monthName(x.m, { capitalize: true }).slice(0, 3), value: money(x.total), bar: x.total / peak.total })),
      accent: '#8B93FF',
    })
  }

  // Inflation-adjusted comparison (month vs previous month; year vs previous year).
  if (inflation) {
    const prevMonths = period.type === 'month' ? [shiftMonth(period.key, -1)] : periodMonths({ type: 'year', year: period.year - 1 })
    const target = months.at(-1)
    let prevReal = 0
    for (const e of store.expenses) {
      if (!isActive(e) || !isCharged2(e) || !prevMonths.includes(monthKey(e.spentAt))) continue
      prevReal += toArs(e) * adjustmentFactor(inflation, monthKey(e.spentAt), target).factor
    }
    if (prevReal > 0) {
      const change = (total / prevReal - 1) * 100
      const prevLabel = period.type === 'month' ? monthName(prevMonths[0]) : String(period.year - 1)
      slides.push({
        id: 'inflation',
        kicker: 'Descontando la inflación',
        title: change > 1 ? 'Gastaste más' : change < -1 ? 'Gastaste menos' : 'Gastaste casi igual',
        value: pct(change),
        lines: [`Comparado con ${prevLabel}, en pesos de hoy.`, change < -1 ? '¡Bien ahí!' : null].filter(Boolean),
        accent: change > 1 ? '#FFB547' : '#4ADE80',
      })
    }
  }

  // Installments paid off in the period.
  const finished = store.plans.filter((p) => p.status === 'active' && months.includes(lastMonthOf(p)))
  if (finished.length) {
    slides.push({
      id: 'installments',
      kicker: 'Cuotas terminadas',
      title: finished.length === 1 ? 'Terminaste de pagar' : `Terminaste de pagar ${finished.length} compras`,
      value: finished.length === 1 ? (finished[0].note || store.getCategory(finished[0].categoryId).name) : null,
      lines: ['Una cuota menos para el mes que viene.'],
      list: finished.length > 1 ? finished.slice(0, 5).map((p) => ({ label: p.note || store.getCategory(p.categoryId).name, value: `${p.installmentCount} cuotas` })) : undefined,
      accent: '#4ADE80',
    })
  }

  slides.push({
    id: 'outro',
    kicker: label,
    title: 'Eso fue todo',
    value: money(total),
    lines: ['Llevá tus gastos y los de tus grupos con Puly. Gratis y sin publicidad.'],
    accent: '#5AC8FA',
  })
  return slides
}

/** Group slides. `data` = { group, expenses, settlements, memberById, events, extraTransfers }. */
export function groupWrapped(period, data) {
  const months = periodMonths(period)
  const expenses = data.expenses.filter((e) => e.status === 'active' && isCharged(e) && inPeriod(e.spent_at, months))
  if (expenses.length === 0) return []
  const name = (id) => data.memberById[id]?.profile?.display_name ?? 'Alguien'
  const total = expenses.reduce((s, e) => s + groupExpenseArs(e), 0)
  const label = periodLabel(period).replace(/^Tu /, '')
  const slides = []

  slides.push({ id: 'intro', kicker: 'Puly Wrapped', title: data.group.name, value: null, lines: [`El resumen de ${label.toLowerCase()}.`], accent: '#A78BFA' })
  slides.push({
    id: 'total', kicker: label, title: 'Gastaron entre todos', value: money(total),
    lines: [`${expenses.length} ${expenses.length === 1 ? 'gasto' : 'gastos'} compartidos.`], accent: '#A78BFA',
  })

  const paid = {}
  for (const e of expenses) paid[e.paid_by] = (paid[e.paid_by] ?? 0) + groupExpenseArs(e)
  const payers = Object.entries(paid).sort((a, b) => b[1] - a[1])
  slides.push({
    id: 'payer', kicker: 'Quién puso más', title: name(payers[0][0]), value: money(payers[0][1]),
    lines: [`El ${Math.round((payers[0][1] / total) * 100)}% de todo lo del grupo. ¡Gracias!`],
    list: payers.slice(0, 5).map(([id, v]) => ({ label: name(id), value: money(v), bar: v / payers[0][1] })),
    accent: '#4ADE80',
  })

  const net = balancesByMember(data.expenses, data.settlements, data.extraTransfers ?? [])
  const debtor = Object.entries(net).filter(([, c]) => c <= -100).sort((a, b) => a[1] - b[1])[0]
  if (debtor) {
    slides.push({
      id: 'debtor', kicker: 'Quién debe más (hoy)', title: name(debtor[0]), value: money(-debtor[1] / 100),
      lines: ['Nada que una transferencia no arregle.'], accent: '#FFB547',
    })
  }

  const events = (data.events ?? [])
    .filter((ev) => months.includes(ev.event_date.slice(0, 7)))
    .map((ev) => ({ ev, total: ev.expenses.filter((x) => x.status === 'active').reduce((s, x) => s + eventExpenseArs(x), 0) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
  if (events.length) {
    slides.push({
      id: 'event', kicker: 'El evento más caro', title: events[0].ev.name, value: money(events[0].total),
      lines: [`Con ${events[0].ev.participants.length} personas.`], accent: '#FF7A96',
    })
  }

  // The most unusual expense: the one furthest above the typical (median) group expense.
  if (expenses.length >= 3) {
    const sorted = expenses.map(groupExpenseArs).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const rare = [...expenses].sort((a, b) => groupExpenseArs(b) - groupExpenseArs(a))[0]
    const times = median > 0 ? groupExpenseArs(rare) / median : 0
    if (times >= 2) {
      slides.push({
        id: 'rare', kicker: 'El gasto más fuera de lo común', title: rare.note || 'Un gasto misterioso', value: money(groupExpenseArs(rare)),
        lines: [`${Math.round(times)} veces más que un gasto normal del grupo.`, `Lo pagó ${name(rare.paid_by)}.`], accent: '#8B93FF',
      })
    }
  }

  slides.push({ id: 'outro', kicker: data.group.name, title: 'Así fue', value: money(total), lines: ['Cuentas claras, amistades largas. Hecho con Puly.'], accent: '#A78BFA' })
  return slides
}

// Personal: future installments aren't spent yet.
function isCharged2(e) {
  return !e.installmentPlanId || monthKey(e.spentAt) <= monthKey()
}

function daysIn(period) {
  if (period.type === 'year') {
    const now = new Date()
    if (now.getFullYear() === period.year) {
      const start = new Date(period.year, 0, 1)
      return Math.max(1, Math.ceil((now - start) / 86400000))
    }
    return 365
  }
  const [y, m] = period.key.split('-').map(Number)
  const now = new Date()
  return monthKey(now) === period.key ? now.getDate() : new Date(y, m, 0).getDate()
}
