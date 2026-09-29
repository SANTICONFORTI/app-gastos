import { useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import UserAvatar from './UserAvatar'
import { useEvents } from '../store/EventsStore'
import { useGroups } from '../store/GroupsStore'
import { useAuth } from '../store/AuthProvider'
import { friendlyError } from '../lib/db'
import { toDateInput } from '../lib/dates'

/** New event: inside the current group (`groupId`) or standalone. */
export default function EventFormSheet({ open, groupId, onClose, onCreated }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="event-form-title" space="group">
      <EventForm groupId={groupId} onClose={onClose} onCreated={onCreated} />
    </Sheet>
  )
}

function EventForm({ groupId, onClose, onCreated }) {
  const events = useEvents()
  const groups = useGroups()
  const { user } = useAuth()
  const members = groupId ? groups.activeMembers : []
  const [name, setName] = useState('')
  const [date, setDate] = useState(toDateInput(new Date()))
  const [memberIds, setMemberIds] = useState(members.map((m) => m.user_id))
  const [guests, setGuests] = useState([])
  const [guestName, setGuestName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function addGuest(e) {
    e?.preventDefault()
    const n = guestName.trim()
    if (!n) return
    if (guests.some((g) => g.toLowerCase() === n.toLowerCase())) return setError('Ya agregaste a alguien con ese nombre.')
    setGuests([...guests, n])
    setGuestName('')
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Ponele un nombre al evento.')
    setBusy(true)
    setError('')
    try {
      const ev = await events.createEvent({ name, date, groupId, memberIds, guests })
      onCreated(ev.id)
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={submit} noValidate>
      <SheetHeader id="event-form-title" title={groupId ? 'Nuevo evento del grupo' : 'Evento suelto'} onClose={onClose} />

      <label className="field">
        <span className="field-label">Nombre</span>
        <span className="input-wrap glass">
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ej: Asado del sábado, Juntada casa Roberto" />
        </span>
      </label>

      <label className="field">
        <span className="field-label">Fecha</span>
        <span className="input-wrap glass">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </span>
      </label>

      {members.length > 0 && (
        <fieldset className="split-section">
          <legend className="section-label">Del grupo, ¿quiénes van?</legend>
          <ul className="split-list">
            {members.map((m) => {
              const on = memberIds.includes(m.user_id) || m.user_id === user.id
              const isMe = m.user_id === user.id
              return (
                <li key={m.user_id} className={`split-row ${on ? 'is-on' : ''}`}>
                  <button
                    type="button"
                    className="split-toggle"
                    role="checkbox"
                    aria-checked={on}
                    disabled={isMe}
                    onClick={() => setMemberIds(on ? memberIds.filter((id) => id !== m.user_id) : [...memberIds, m.user_id])}
                  >
                    <span className={`split-check ${on ? 'is-on' : ''}`} aria-hidden="true">{on && <Check size={14} strokeWidth={3} />}</span>
                    <UserAvatar profile={m.profile} size={32} />
                    <span className="split-name">{m.profile?.display_name}{isMe ? ' (vos)' : ''}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </fieldset>
      )}

      <div className="field">
        <span className="field-label">Invitados sin cuenta (solo el nombre)</span>
        <div className="code-row">
          <span className="input-wrap glass code-field">
            <input
              value={guestName}
              maxLength={40}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGuest(e)}
              placeholder="Ej: Tío Carlos"
              aria-label="Nombre del invitado"
            />
          </span>
          <Pressable className="btn btn-glass btn-icon btn-lg-icon" aria-label="Agregar invitado" onClick={addGuest}>
            <UserPlus size={18} strokeWidth={2.2} />
          </Pressable>
        </div>
        {guests.length > 0 && (
          <div className="guest-chips">
            {guests.map((g) => (
              <span key={g} className="guest-chip glass">
                {g}
                <button type="button" aria-label={`Quitar a ${g}`} onClick={() => setGuests(guests.filter((x) => x !== g))}><X size={14} strokeWidth={2.4} /></button>
              </span>
            ))}
          </div>
        )}
        <span className="field-hint">Los invitados ven el evento con un link, sin crear cuenta.</span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <Pressable type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Creando…' : 'Crear evento'}</Pressable>
    </form>
  )
}
