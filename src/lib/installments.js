import { monthKey, shiftMonth } from './dates'
import { isActive, toArs } from './expenses'

/**
 * Splits a total into `count` installments with cents; the last one absorbs the rounding.
 * 100 / 3 -> [33.33, 33.33, 33.34]
 */
export function splitInstallments(total, count) {
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / count)
  const amounts = Array.from({ length: count }, () => base / 100)
  amounts[count - 1] = (totalCents - base * (count - 1)) / 100
  return amounts
}

/** Same day of the purchase inside `key` month (clamped: 31 -> 30 in Nov), same time. */
export function installmentDate(purchaseIso, key) {
  const purchase = new Date(purchaseIso)
  const [y, m] = key.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return new Date(
    y, m - 1, Math.min(purchase.getDate(), lastDay),
    purchase.getHours(), purchase.getMinutes(), purchase.getSeconds(),
  ).toISOString()
}

export const lastMonthOf = (plan) => shiftMonth(plan.firstMonth, plan.installmentCount - 1)

/**
 * Where a plan stands this month.
 * state: 'upcoming' (starts later) | 'active' | 'last' (last installment this month) | 'finished' | 'voided'
 */
export function planProgress(plan, current = monthKey()) {
  const endMonth = lastMonthOf(plan)
  const monthsIn = monthsBetween(plan.firstMonth, current) // 0 = first installment is this month
  const currentNumber = Math.min(Math.max(monthsIn + 1, 0), plan.installmentCount)
  const remaining = plan.installmentCount - Math.max(currentNumber, 0)

  let state
  if (plan.status === 'voided') state = 'voided'
  else if (monthsIn < 0) state = 'upcoming'
  else if (current > endMonth) state = 'finished'
  else if (current === endMonth) state = 'last'
  else state = 'active'

  return {
    state,
    startMonth: plan.firstMonth,
    endMonth,
    total: plan.installmentCount,
    currentNumber: monthsIn < 0 ? 0 : currentNumber,
    remaining,
    ratio: Math.max(currentNumber, 0) / plan.installmentCount,
  }
}

export function monthsBetween(fromKey, toKey) {
  const [fy, fm] = fromKey.split('-').map(Number)
  const [ty, tm] = toKey.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/** [{ month, total, items: [expense] }] of active installments for `count` months starting at `fromKey`. */
export function committedByMonth(expenses, fromKey, count = 12) {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(fromKey, i))
  const byMonth = Object.fromEntries(months.map((k) => [k, { month: k, total: 0, items: [] }]))
  for (const e of expenses) {
    if (!e.installmentPlanId || !isActive(e)) continue
    const bucket = byMonth[monthKey(e.spentAt)]
    if (!bucket) continue
    bucket.total += toArs(e)
    bucket.items.push(e)
  }
  return months.map((k) => byMonth[k])
}
