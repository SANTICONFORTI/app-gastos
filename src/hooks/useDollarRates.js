import { useEffect, useState } from 'react'
import { CACHE_TTL_MS, fetchRates, readCachedRates } from '../lib/dolar'

/**
 * Current dollar quotes. status: 'loading' | 'ok' | 'stale' (offline, showing cached) | 'error' (nothing available).
 * Shared across components through a module-level promise so we only hit the API once.
 */
let inflight = null

export default function useDollarRates() {
  const [state, setState] = useState(() => {
    const cached = readCachedRates()
    const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS
    return { data: cached, status: fresh ? 'ok' : 'loading' }
  })

  useEffect(() => {
    if (state.status === 'ok') return
    let cancelled = false
    inflight ??= fetchRates().finally(() => {
      setTimeout(() => { inflight = null }, 1000)
    })
    inflight
      .then((data) => !cancelled && setState({ data, status: 'ok' }))
      .catch(() => !cancelled && setState((s) => ({ data: s.data, status: s.data ? 'stale' : 'error' })))
    return () => { cancelled = true }
  }, [state.status])

  const quote = (type) => state.data?.quotes?.[type]?.sell ?? null
  return { ...state, quote }
}
