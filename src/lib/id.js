/** Random unique id. crypto.randomUUID only exists on https/localhost, so fall back otherwise. */
export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
