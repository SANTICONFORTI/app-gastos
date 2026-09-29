import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import UserAvatar from './UserAvatar'
import PillToggle from './PillToggle'
import { amountToInput, formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { equalSplit } from '../lib/groupMath'
import { formatMoney } from '../lib/format'
import { spring } from '../lib/motion'

const firstName = (m) => (m.profile?.display_name || m.profile?.username || '?').split(' ')[0]

/** Builds the split to send: [{ user_id, amount }] or null if it doesn't add up. */
export function buildSplits({ amount, participants, mode, custom }) {
  if (!(amount > 0) || participants.length === 0) return null
  if (mode === 'equal') return equalSplit(amount, participants)
  const splits = participants.map((id) => ({ user_id: id, amount: Math.round((parseAmountInput(custom[id]) || 0) * 100) / 100 }))
  const sum = splits.reduce((s, x) => s + Math.round(x.amount * 100), 0)
  return sum === Math.round(amount * 100) ? splits : null
}

/** Initial split state when editing an existing group expense. */
export function splitStateFrom(expenseRow) {
  const snapshot = expenseRow?.split_snapshot ?? []
  const participants = snapshot.map((s) => s.user_id)
  const equal = equalSplit(Number(expenseRow?.amount ?? 0), participants)
  const isEqual = snapshot.every((s) => equal.some((e) => e.user_id === s.user_id && Math.abs(e.amount - Number(s.amount)) < 0.005))
  return {
    participants,
    mode: isEqual ? 'equal' : 'custom',
    custom: Object.fromEntries(snapshot.map((s) => [s.user_id, amountToInput(Number(s.amount))])),
  }
}

/** "Who paid?" and "Split between" for a group expense. */
export default function GroupSplitFields({ members, amount, installments, currency, paidBy, setPaidBy, participants, setParticipants, mode, setMode, custom, setCustom }) {
  const symbol = currency === 'USD' ? 'US$' : '$'
  const fmt = (n) => (currency === 'USD' ? `US$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}` : formatMoney(n))

  function toggle(id) {
    setParticipants(participants.includes(id) ? participants.filter((p) => p !== id) : [...participants, id])
  }

  const equalParts = amount > 0 ? equalSplit(amount, participants) : []
  const assigned = participants.reduce((s, id) => s + Math.round((parseAmountInput(custom[id]) || 0) * 100), 0) / 100
  const missing = Math.round(((amount || 0) - assigned) * 100) / 100

  return (
    <div className="split-box glass">
      <fieldset className="split-section">
        <legend className="section-label">¿Quién pagó?</legend>
        <div className="member-chips" role="radiogroup" aria-label="Quién pagó">
          {members.map((m) => {
            const on = paidBy === m.user_id
            return (
              <motion.button
                key={m.user_id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`member-chip ${on ? 'is-active' : ''}`}
                onClick={() => setPaidBy(m.user_id)}
                whileTap={{ scale: 0.92 }}
                transition={spring}
              >
                <UserAvatar profile={m.profile} size={40} />
                <span className="member-chip-name">{firstName(m)}</span>
              </motion.button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="split-section">
        <legend className="section-label">¿Entre quiénes se divide?</legend>
        <PillToggle
          label="Cómo se divide"
          small
          options={[{ id: 'equal', label: 'Partes iguales' }, { id: 'custom', label: 'Montos distintos' }]}
          value={mode}
          onChange={setMode}
          layoutId="split-mode-pill"
        />
        <ul className="split-list">
          {members.map((m) => {
            const on = participants.includes(m.user_id)
            const share = equalParts.find((p) => p.user_id === m.user_id)?.amount
            return (
              <li key={m.user_id} className={`split-row ${on ? 'is-on' : ''}`}>
                <button type="button" className="split-toggle" role="checkbox" aria-checked={on} onClick={() => toggle(m.user_id)}>
                  <span className={`split-check ${on ? 'is-on' : ''}`} aria-hidden="true">{on && <Check size={14} strokeWidth={3} />}</span>
                  <UserAvatar profile={m.profile} size={32} />
                  <span className="split-name">{m.profile?.display_name ?? '?'}</span>
                </button>
                {on && mode === 'equal' && <span className="split-amount">{share !== undefined ? fmt(share) : '—'}</span>}
                {on && mode === 'custom' && (
                  <label className="split-input glass">
                    <span aria-hidden="true">{symbol}</span>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={custom[m.user_id] ?? ''}
                      onChange={(e) => setCustom({ ...custom, [m.user_id]: formatAmountInput(e.target.value, custom[m.user_id] ?? '') })}
                      aria-label={`Parte de ${m.profile?.display_name ?? 'integrante'}`}
                    />
                  </label>
                )}
              </li>
            )
          })}
        </ul>
        {installments && (
          <span className="field-hint">
            Dividís el total de la compra. Cada mes, cada uno debe su parte de la cuota de ese mes (se reparte en {installments} cuotas).
          </span>
        )}
        {mode === 'custom' && amount > 0 && participants.length > 0 && (
          <span className={`field-hint ${missing === 0 ? 'status-available' : 'status-taken'}`} aria-live="polite">
            {missing === 0 ? 'La división suma el total' : missing > 0 ? `Faltan ${fmt(missing)} por repartir` : `Te pasaste por ${fmt(-missing)}`}
          </span>
        )}
      </fieldset>
    </div>
  )
}
