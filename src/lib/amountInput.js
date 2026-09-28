// Argentine amount typing: dots group thousands, comma separates decimals.

/**
 * Normalizes what the user typed into '12.500,5'.
 * A '.' newly typed on keyboards without a comma is treated as the decimal comma
 * (our own thousand dots are told apart by comparing with the previous value).
 */
export function formatAmountInput(raw, previous = '') {
  let s = raw
  if (s.length === previous.length + 1 && !previous.includes(',')) {
    let i = 0
    while (i < previous.length && s[i] === previous[i]) i++
    if (s[i] === '.') s = `${s.slice(0, i)},${s.slice(i + 1)}`
  } else if (s.length > previous.length + 1 && !s.includes(',')) {
    // Pasted text like '12500.5': a last dot followed by 1-2 digits is a decimal point.
    s = s.replace(/\.(\d{1,2})$/, ',$1')
  }
  s = s.replace(/[^\d,]/g, '')
  const commaAt = s.indexOf(',')
  let integer = commaAt === -1 ? s : s.slice(0, commaAt)
  const decimals = commaAt === -1 ? null : s.slice(commaAt + 1).replace(/,/g, '').slice(0, 2)
  integer = integer.replace(/^0+(?=\d)/, '').slice(0, 12)
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimals === null ? grouped : `${grouped || '0'},${decimals}`
}

export function parseAmountInput(text) {
  if (!text) return NaN
  return Number(text.replace(/\./g, '').replace(',', '.'))
}

/** 12500.5 -> '12.500,5' (for prefilling the edit form). */
export function amountToInput(value) {
  const [integer, decimals] = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
    .format(value)
    .split(',')
  return decimals ? `${integer},${decimals}` : integer
}
