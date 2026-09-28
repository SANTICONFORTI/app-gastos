// Translation between database rows (snake_case) and the app's objects (camelCase),
// plus turning raw history snapshots into "what changed" entries.

const num = (v) => (v === null || v === undefined ? null : Number(v))

export function fromExpenseRow(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    exchangeRate: num(row.exchange_rate),
    rateType: row.rate_type,
    categoryId: row.category_id,
    note: row.note ?? '',
    receiptId: row.receipt_path,
    spentAt: row.spent_at,
    status: row.status,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    installmentPlanId: row.installment_plan_id,
    installmentNumber: row.installment_number,
  }
}

/** App fields -> expense columns (only the ones present in `data`). */
export function toExpenseRow(data) {
  const map = {
    amount: 'amount',
    currency: 'currency',
    exchangeRate: 'exchange_rate',
    rateType: 'rate_type',
    categoryId: 'category_id',
    note: 'note',
    receiptId: 'receipt_path',
    spentAt: 'spent_at',
  }
  const row = {}
  for (const [key, column] of Object.entries(map)) {
    if (key in data) row[column] = key === 'note' ? (data.note?.trim() || null) : data[key]
  }
  return row
}

export function fromPlanRow(row) {
  return {
    id: row.id,
    totalAmount: Number(row.total_amount),
    installmentCount: row.installment_count,
    firstMonth: row.first_month.slice(0, 7),
    card: row.card,
    currency: row.currency,
    exchangeRate: num(row.exchange_rate),
    rateType: row.rate_type,
    categoryId: row.category_id,
    note: row.note ?? '',
    receiptId: row.receipt_path,
    purchasedAt: row.purchased_at,
    status: row.status,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
  }
}

export function fromCategoryRow(row) {
  return { id: row.id, name: row.name, color: row.color, icon: row.icon, custom: row.owner_id !== null, sortOrder: row.sort_order }
}

const EXPENSE_TRACKED = {
  amount: 'amount',
  currency: 'currency',
  exchange_rate: 'exchangeRate',
  rate_type: 'rateType',
  category_id: 'categoryId',
  note: 'note',
  spent_at: 'spentAt',
  receipt_path: 'receiptId',
}

const PLAN_TRACKED = { category_id: 'categoryId', note: 'note', card: 'card' }

const NUMERIC = new Set(['amount', 'exchange_rate'])
const TIMESTAMP = new Set(['spent_at'])

function same(column, a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (NUMERIC.has(column)) return Number(a) === Number(b)
  if (TIMESTAMP.has(column)) return Date.parse(a) === Date.parse(b)
  return false
}

function diff(before, after, tracked) {
  const b = {}
  const a = {}
  for (const [column, key] of Object.entries(tracked)) {
    if (!same(column, before?.[column] ?? null, after?.[column] ?? null)) {
      b[key] = before?.[column] ?? null
      a[key] = after?.[column] ?? null
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null
}

/** expense_history rows -> [{ id, action, changedAt, before, after }] with only the changed fields. */
export function normalizeExpenseHistory(rows) {
  const out = []
  for (const row of rows) {
    const base = { id: `e-${row.id}`, expenseId: row.expense_id, action: row.action, changedAt: row.changed_at }
    if (row.action === 'created') out.push({ ...base, before: null, after: {} })
    else if (row.action === 'voided') out.push({ ...base, before: {}, after: { voidReason: row.after?.void_reason } })
    else {
      const d = diff(row.before, row.after, EXPENSE_TRACKED)
      if (d) out.push({ ...base, ...d })
    }
  }
  return out
}

/** installment_plan_history rows -> entries HistoryList understands (planId set). */
export function normalizePlanHistory(rows, voidedInstallments = 0) {
  const out = []
  for (const row of rows) {
    const base = { id: `p-${row.id}`, planId: row.plan_id, action: row.action, changedAt: row.changed_at }
    if (row.action === 'created') {
      out.push({ ...base, before: null, after: { installmentCount: row.after?.installment_count, firstMonth: row.after?.first_month?.slice(0, 7) } })
    } else if (row.action === 'voided') {
      out.push({ ...base, before: {}, after: { voidReason: row.after?.void_reason, voidedInstallments } })
    } else {
      const d = diff(row.before, row.after, PLAN_TRACKED)
      if (d) out.push({ ...base, ...d })
    }
  }
  return out
}

/** Spanish message for errors coming from Supabase (auth, database, storage). */
export function friendlyError(error) {
  const msg = error?.message ?? String(error ?? '')
  const known = [
    [/Invalid login credentials/i, 'Mail o contraseña incorrectos.'],
    [/User already registered/i, 'Ya hay una cuenta con ese mail. Probá entrar.'],
    [/Email not confirmed/i, 'Todavía no confirmaste tu mail. Revisá tu bandeja de entrada.'],
    [/Password should be at least/i, 'La contraseña tiene que tener al menos 6 caracteres.'],
    [/Unable to validate email address|invalid format/i, 'Ese mail no parece válido.'],
    [/rate limit|too many/i, 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.'],
    [/provider is not enabled|Unsupported provider/i, 'El inicio con Google todavía no está activado.'],
    [/Failed to fetch|NetworkError|Load failed/i, 'No hay conexión. Revisá tu internet y probá de nuevo.'],
    [/duplicate key.*username|profiles_username_key/i, 'Ese @usuario ya está en uso.'],
    [/JWT expired|invalid JWT/i, 'Tu sesión venció. Volvé a entrar.'],
    [/The resource already exists/i, 'Ese archivo ya existe.'],
  ]
  for (const [re, text] of known) if (re.test(msg)) return text
  // Our own database exceptions are already written in Spanish.
  return msg || 'Algo salió mal. Probá de nuevo.'
}
