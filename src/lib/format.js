const arsFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Splits 684200 into { integer: '684.200', decimals: '00' } (es-AR format). */
export function splitAmount(value) {
  const [integer, decimals] = arsFormatter.format(value).split(',')
  return { integer, decimals }
}

/** Short amount without decimals: 58400 -> '$ 58.400'. */
export function formatMoney(value, currency = 'ARS') {
  const symbol = currency === 'USD' ? 'US$' : '$'
  const n = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)
  return `${symbol} ${n}`
}

/** Hex color + alpha -> rgba string, for tinted icon circles. */
export function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
