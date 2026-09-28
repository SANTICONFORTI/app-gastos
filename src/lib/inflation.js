// Monthly inflation (INDEC CPI) from ArgentinaDatos — free, keyless, CORS enabled.
// https://api.argentinadatos.com/v1/finanzas/indices/inflacion -> [{ fecha: '2026-08-31', valor: 1.7 }, ...]

import { shiftMonth } from './dates'

const URL = 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion'
const CACHE_KEY = 'gastos:inflacion:v1'
export const CACHE_TTL_MS = 12 * 60 * 60 * 1000

export function readCachedInflation() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Returns { fetchedAt, lastMonth, rates: { 'YYYY-MM': percent } }. */
export async function fetchInflation() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`ArgentinaDatos respondió ${res.status}`)
  const list = await res.json()
  const rates = {}
  for (const item of list) {
    if (typeof item.valor === 'number' && typeof item.fecha === 'string') {
      rates[item.fecha.slice(0, 7)] = item.valor
    }
  }
  const months = Object.keys(rates).sort()
  if (months.length === 0) throw new Error('Respuesta vacía')
  const data = { fetchedAt: new Date().toISOString(), lastMonth: months.at(-1), rates }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Storage full: still usable for this session.
  }
  return data
}

/**
 * Factor to express pesos of `fromKey` in pesos of `toKey` (toKey later than fromKey):
 * compounds inflation of every month after `fromKey` up to `toKey`.
 * Months not yet published use the last known value and mark the result as estimated.
 */
export function adjustmentFactor(data, fromKey, toKey) {
  if (!data || fromKey >= toKey) return { factor: 1, estimated: false }
  let factor = 1
  let estimated = false
  let month = shiftMonth(fromKey, 1)
  while (month <= toKey) {
    let rate = data.rates[month]
    if (rate === undefined) {
      rate = data.rates[data.lastMonth]
      estimated = true
    }
    factor *= 1 + rate / 100
    month = shiftMonth(month, 1)
  }
  return { factor, estimated }
}

/** Inflation of a single month, or the last known one (estimated). */
export function monthInflation(data, key) {
  if (!data) return null
  if (data.rates[key] !== undefined) return { rate: data.rates[key], estimated: false }
  return { rate: data.rates[data.lastMonth], estimated: true }
}
