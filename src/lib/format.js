const arsFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Splits 684200 into { integer: '684.200', decimals: '00' } (es-AR format). */
export function splitAmount(value) {
  const [integer, decimals] = arsFormatter.format(value).split(',')
  return { integer, decimals }
}

/** Short amount: 58400 -> '$ 58.400'; shows cents only when there are any: '$ 12.500,50'. */
export function formatMoney(value, currency = 'ARS') {
  const symbol = currency === 'USD' ? 'US$' : '$'
  const rounded = Math.round(value * 100) / 100
  const digits = Number.isInteger(rounded) ? 0 : 2
  const n = new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(rounded)
  return `${symbol} ${n}`
}

/** Hex color + alpha -> rgba string, for tinted icon circles. */
export function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
