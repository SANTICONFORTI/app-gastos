const pad = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM' key for the month a date belongs to (local time). */
export function monthKey(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

/** 'septiembre' / 'Septiembre' / 'sep' for a month key. */
export function monthName(key, { capitalize = false, short = false } = {}) {
  const [y, m] = key.split('-').map(Number)
  let name = new Intl.DateTimeFormat('es-AR', { month: short ? 'short' : 'long' })
    .format(new Date(y, m - 1, 1))
    .replace('.', '')
  if (capitalize) name = name[0].toUpperCase() + name.slice(1)
  return name
}

export function monthLabelWithYear(key) {
  const [y] = key.split('-')
  const current = String(new Date().getFullYear()) === y
  return current ? monthName(key, { capitalize: true }) : `${monthName(key, { capitalize: true })} ${y}`
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
const dayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
const fullFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

/** 'Hoy, 18:32' · 'Ayer, 09:10' · 'lun 22 sep, 11:05' */
export function formatWhen(iso) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const time = timeFmt.format(d)
  if (sameDay(d, now)) return `Hoy, ${time}`
  if (sameDay(d, yesterday)) return `Ayer, ${time}`
  return `${dayFmt.format(d).replace(/\./g, '').replace(',', '')}, ${time}`
}

/** '22 de septiembre de 2026' */
export function formatLongDate(iso) {
  return fullFmt.format(new Date(iso))
}

/** Value for <input type="date"> (local). */
export function toDateInput(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO string for the given 'YYYY-MM-DD' at the time of `timeSource` (defaults to now). */
export function dateInputToIso(value, timeSource = new Date()) {
  const [y, m, d] = value.split('-').map(Number)
  const t = new Date(timeSource)
  return new Date(y, m - 1, d, t.getHours(), t.getMinutes(), t.getSeconds()).toISOString()
}
