import { useState } from 'react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import GroupSplitFields, { buildSplits } from './GroupSplitFields'
import { asMember, useEvents } from '../store/EventsStore'
import { useAuth } from '../store/AuthProvider'
import { formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { friendlyError } from '../lib/db'

/** Add an expense to an event (in pesos), with who paid and how it's split. */
export default function EventExpenseSheet({ event, onClose, onDone }) {
  return (
    <Sheet open={Boolean(event)} onClose={onClose} labelledBy="event-expense-title" space="group" tall>
      {event && <Form event={event} onClose={onClose} onDone={onDone} />}
    </Sheet>
  )
}

function Form({ event, onClose, onDone }) {
  const events = useEvents()
  const { user } = useAuth()
  const members = event.participants.map(asMember)
  const me = event.participants.find((p) => p.user_id === user.id)
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')
  const [paidBy, setPaidBy] = useState(me?.id ?? members[0]?.user_id)
  const [participants, setParticipants] = useState(members.map((m) => m.user_id))
  const [mode, setMode] = useState('equal')
  const [custom, setCustom] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const amount = parseAmountInput(amountText)

  async function submit(e) {
    e.preventDefault()
    if (!(amount > 0)) return setError('Ingresá un monto mayor a cero.')
    const splits = buildSplits({ amount, participants, mode, custom })
    if (!splits) return setError(participants.length ? 'La división no suma el total.' : 'Elegí entre quiénes se divide.')
    setBusy(true)
    setError('')
    try {
      await events.addExpense(event.id, { paidBy, amount, note, splits })
      onDone('Gasto cargado en el evento')
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <form className="expense-form" onSubmit={submit} noValidate>
      <SheetHeader id="event-expense-title" title={`Gasto en ${event.name}`} onClose={onClose} />
      <div className="amount-field">
        <label htmlFor="event-amount" className="amount-label">Monto</label>
        <div className="amount-input-row">
          <span className="amount-symbol">$</span>
          <input
            id="event-amount"
            inputMode="decimal"
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmountText(formatAmountInput(e.target.value, amountText))}
            className="amount-input"
            style={{ width: `${Math.max(amountText.length, 1) + 0.6}ch` }}
          />
        </div>
      </div>
      <label className="sr-only" htmlFor="event-note">Qué se compró</label>
      <input id="event-note" className="note-input glass" maxLength={80} placeholder="¿Qué se compró? (ej: Carne, Bebida)" value={note} onChange={(e) => setNote(e.target.value)} />
      <GroupSplitFields
        members={members}
        amount={amount}
        currency="ARS"
        paidBy={paidBy}
        setPaidBy={setPaidBy}
        participants={participants}
        setParticipants={setParticipants}
        mode={mode}
        setMode={setMode}
        custom={custom}
        setCustom={setCustom}
      />
      <div className="sheet-spacer" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Pressable type="submit" className="btn btn-primary sheet-save" disabled={busy}>{busy ? 'Guardando…' : 'Guardar gasto'}</Pressable>
    </form>
  )
}
