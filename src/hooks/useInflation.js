import { useEffect, useState } from 'react'
import { CACHE_TTL_MS, fetchInflation, readCachedInflation } from '../lib/inflation'

/** Monthly inflation data. status: 'loading' | 'ok' | 'stale' (offline, cached) | 'error'. */
export default function useInflation() {
  const [state, setState] = useState(() => {
    const cached = readCachedInflation()
    const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS
    return { data: cached, status: fresh ? 'ok' : 'loading' }
  })

  useEffect(() => {
    if (state.status === 'ok') return
    let cancelled = false
    fetchInflation()
      .then((data) => !cancelled && setState({ data, status: 'ok' }))
      .catch(() => !cancelled && setState((s) => ({ data: s.data, status: s.data ? 'stale' : 'error' })))
    return () => { cancelled = true }
  }, [state.status])

  return state
}
