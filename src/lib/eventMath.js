import { simplifyDebts } from './groupMath'

// Event balances are per participant (members and guests). Amounts in pesos.

const toCents = (n) => Math.round(n * 100)
const rateOf = (x) => (x.currency === 'USD' ? Number(x.exchange_rate ?? 0) : 1)

export const eventExpenseArs = (x) => Number(x.amount) * rateOf(x)

/** Net per participant id, in cents (positive = they're owed). Only confirmed payments count. */
export function participantNets(expenses, payments) {
  const net = {}
  const add = (id, cents) => { net[id] = (net[id] ?? 0) + cents }
  for (const x of expenses) {
    if (x.status !== 'active') continue
    const rate = rateOf(x)
    add(x.paid_by, toCents(Number(x.amount) * rate))
    for (const s of x.split_snapshot ?? x.split ?? []) add(s.participant_id, -toCents(Number(s.amount) * rate))
  }
  for (const p of payments) {
    if (p.status !== 'confirmed') continue
    add(p.from_participant ?? p.from, toCents(Number(p.amount)))
    add(p.to_participant ?? p.to, -toCents(Number(p.amount)))
  }
  return net
}

/** What each participant consumed (their share of all active expenses), in pesos. */
export function participantShares(expenses) {
  const share = {}
  for (const x of expenses) {
    if (x.status !== 'active') continue
    const rate = rateOf(x)
    for (const s of x.split_snapshot ?? x.split ?? []) share[s.participant_id] = (share[s.participant_id] ?? 0) + Number(s.amount) * rate
  }
  return share
}

export const eventTransfers = (expenses, payments) => simplifyDebts(participantNets(expenses, payments))

/**
 * When a group event is closed, its pending debts between people with an account
 * are added to the group's balance: [{ from: userId, to: userId, amount }].
 * Debts involving guests stay in the event.
 */
export function closedEventTransfersForGroup(events) {
  const out = []
  for (const ev of events) {
    if (ev.status !== 'closed') continue
    const userOf = Object.fromEntries(ev.participants.map((p) => [p.id, p.user_id]))
    for (const t of eventTransfers(ev.expenses, ev.payments)) {
      if (userOf[t.from] && userOf[t.to]) out.push({ from: userOf[t.from], to: userOf[t.to], amount: t.amount })
    }
  }
  return out
}
