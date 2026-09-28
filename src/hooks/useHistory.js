import { useEffect, useState } from 'react'

/**
 * Loads history entries with `fetcher` and reloads when `version` changes
 * (pass something that changes after edits, like updatedAt/status).
 */
export default function useHistory(fetcher, version) {
  const [state, setState] = useState({ entries: [], status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    fetcher()
      .then((entries) => !cancelled && setState({ entries, status: 'ready' }))
      .catch(() => !cancelled && setState({ entries: [], status: 'error' }))
    return () => { cancelled = true }
  }, [version])

  return state
}
