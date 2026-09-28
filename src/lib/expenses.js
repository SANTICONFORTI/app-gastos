import { monthKey } from './dates'

/** Amount in pesos, using the quote saved with the expense. */
export function toArs(expense) {
  return expense.currency === 'USD' ? expense.amount * (expense.exchangeRate ?? 0) : expense.amount
}

export const isActive = (e) => e.status === 'active'

export function expensesOfMonth(expenses, key) {
  return expenses
    .filter((e) => monthKey(e.spentAt) === key)
    .sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt))
}

export function monthTotal(expenses, key) {
  return expensesOfMonth(expenses, key)
    .filter(isActive)
    .reduce((sum, e) => sum + toArs(e), 0)
}

/** [{ categoryId, amount }] sorted from biggest to smallest (active only). */
export function totalsByCategory(expenses, key) {
  const totals = {}
  for (const e of expensesOfMonth(expenses, key)) {
    if (!isActive(e)) continue
    totals[e.categoryId] = (totals[e.categoryId] ?? 0) + toArs(e)
  }
  return Object.entries(totals)
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount)
}
