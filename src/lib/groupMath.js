// Group money math. All balances are in pesos: USD expenses use the quote saved with them.

import { monthKey } from './dates'

const toCents = (n) => Math.round(n * 100)

/** Installments of future months haven't been charged yet: they don't count in debts or lists. */
export const isCharged = (e, current = monthKey()) => !e.installment_plan_id || monthKey(e.spent_at) <= current

/** Splits `amount` between `userIds` in equal parts; the first ones absorb the leftover cents. */
export function equalSplit(amount, userIds) {
  if (userIds.length === 0) return []
  const total = toCents(amount)
  const base = Math.floor(total / userIds.length)
  let rest = total - base * userIds.length
  return userIds.map((userId) => {
    const cents = base + (rest > 0 ? 1 : 0)
    rest -= 1
    return { user_id: userId, amount: cents / 100 }
  })
}

const rateOf = (e) => (e.currency === 'USD' ? Number(e.exchange_rate ?? 0) : 1)

/**
 * Net balance per member, in cents: positive = the group owes them, negative = they owe.
 * Voided expenses and payments don't count.
 */
export function balancesByMember(expenses, settlements) {
  const net = {}
  const add = (id, cents) => { net[id] = (net[id] ?? 0) + cents }

  const current = monthKey()
  for (const e of expenses) {
    if (e.status !== 'active' || !e.split_snapshot || !isCharged(e, current)) continue
    const rate = rateOf(e)
    add(e.paid_by, toCents(Number(e.amount) * rate))
    for (const s of e.split_snapshot) add(s.user_id, -toCents(Number(s.amount) * rate))
  }
  for (const s of settlements) {
    if (s.status !== 'active') continue
    add(s.from_user, toCents(Number(s.amount)))
    add(s.to_user, -toCents(Number(s.amount)))
  }
  return net
}

/**
 * Fewest transfers to settle everything: repeatedly match the biggest debtor with the biggest
 * creditor. Returns [{ from, to, amount }] in pesos. Ignores differences under $1 (rounding).
 */
export function simplifyDebts(net) {
  const creditors = []
  const debtors = []
  for (const [id, cents] of Object.entries(net)) {
    if (cents >= 100) creditors.push({ id, cents })
    else if (cents <= -100) debtors.push({ id, cents: -cents })
  }
  const transfers = []
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.cents - a.cents)
    debtors.sort((a, b) => b.cents - a.cents)
    const c = creditors[0]
    const d = debtors[0]
    const cents = Math.min(c.cents, d.cents)
    transfers.push({ from: d.id, to: c.id, amount: cents / 100 })
    c.cents -= cents
    d.cents -= cents
    if (c.cents < 100) creditors.shift()
    if (d.cents < 100) debtors.shift()
  }
  return transfers
}

/** Expense amount in pesos. */
export const groupExpenseArs = (e) => Number(e.amount) * rateOf(e)
