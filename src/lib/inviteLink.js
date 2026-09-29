// Invitation links look like https://puly.vercel.app/?unirse=ABC-1234.
// The code is saved as soon as the page opens, so it survives logging in
// (Google sends you back to the app without the query string).

const KEY = 'puly:unirse'

/** Call once at startup: moves ?unirse=CODE into storage and cleans the address bar. */
export function capturePendingInviteCode() {
  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('unirse')
    if (!code) return
    localStorage.setItem(KEY, code)
    url.searchParams.delete('unirse')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch {
    // Ignore: worst case the person types the code.
  }
}

/** Returns the pending code (once) and forgets it. */
export function takePendingInviteCode() {
  try {
    const code = localStorage.getItem(KEY)
    if (code) localStorage.removeItem(KEY)
    return code
  } catch {
    return null
  }
}
