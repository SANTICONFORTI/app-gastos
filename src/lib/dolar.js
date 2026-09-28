// Dollar quotes from DolarApi (https://dolarapi.com), free and keyless.
// Cached in localStorage so the app keeps working offline with the last known quote.

const URL = 'https://dolarapi.com/v1/dolares'
const CACHE_KEY = 'gastos:dolar:v1'
export const CACHE_TTL_MS = 15 * 60 * 1000

export const RATE_TYPES = {
  blue: 'Dólar blue',
  tarjeta: 'Dólar tarjeta',
}

export function readCachedRates() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Returns { fetchedAt, quotes: { blue: { buy, sell, updatedAt }, tarjeta: {...}, ... } }. */
export async function fetchRates() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`DolarApi respondió ${res.status}`)
  const list = await res.json()
  const quotes = {}
  for (const q of list) {
    if (typeof q.venta === 'number') {
      quotes[q.casa] = { buy: q.compra, sell: q.venta, updatedAt: q.fechaActualizacion }
    }
  }
  if (!quotes.blue || !quotes.tarjeta) throw new Error('Faltan cotizaciones en la respuesta')
  const data = { fetchedAt: new Date().toISOString(), quotes }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked: the quote still works for this session.
  }
  return data
}
