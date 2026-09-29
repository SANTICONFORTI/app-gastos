import { useState } from 'react'
import { Check, Plus, Ticket, Clock } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import GroupAvatar from './GroupAvatar'
import EventsCard from './EventsCard'
import { useGroups } from '../store/GroupsStore'
import { useEvents } from '../store/EventsStore'
import { friendlyError } from '../lib/db'

/** Switch groups, answer invitations, create or join a group. */
export default function GroupPickerSheet({ open, onClose, onCreate, onJoin, onNewStandaloneEvent, onOpenEvent, onNotice }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="group-picker-title" space="group">
      <Picker onClose={onClose} onCreate={onCreate} onJoin={onJoin} onNewStandaloneEvent={onNewStandaloneEvent} onOpenEvent={onOpenEvent} onNotice={onNotice} />
    </Sheet>
  )
}

function Picker({ onClose, onCreate, onJoin, onNewStandaloneEvent, onOpenEvent, onNotice }) {
  const groups = useGroups()
  const events = useEvents()
  const [busyId, setBusyId] = useState(null)
  const mine = groups.memberships.filter((m) => m.status !== 'invited')

  async function respond(gid, accept) {
    setBusyId(gid)
    try {
      await groups.respondInvite(gid, accept)
      onNotice(accept ? '¡Entraste al grupo!' : 'Invitación rechazada')
      if (accept) onClose()
    } catch (e) {
      onNotice(friendlyError(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <SheetHeader id="group-picker-title" title="Tus grupos" onClose={onClose} />

      {groups.invitations.length > 0 && (
        <section aria-labelledby="invitations-title" className="picker-section">
          <h2 id="invitations-title" className="card-title">Te invitaron</h2>
          {groups.invitations.map((m) => (
            <div key={m.group.id} className="invite-row glass">
              <GroupAvatar group={m.group} size={44} />
              <span className="movement-main"><span className="movement-title">{m.group.name}</span></span>
              <div className="invite-row-actions">
                <Pressable className="btn btn-glass small-btn" disabled={busyId === m.group.id} onClick={() => respond(m.group.id, false)}>No</Pressable>
                <Pressable className="btn btn-primary small-btn" disabled={busyId === m.group.id} onClick={() => respond(m.group.id, true)}>Entrar</Pressable>
              </div>
            </div>
          ))}
        </section>
      )}

      {mine.length > 0 && (
        <ul className="option-list" aria-label="Elegí un grupo">
          {mine.map((m) => {
            const active = groups.groupId === m.group.id
            return (
              <li key={m.group.id}>
                <button
                  type="button"
                  className={`option-row group-option ${active ? 'is-active' : ''}`}
                  aria-current={active}
                  onClick={() => { groups.selectGroup(m.group.id); onClose() }}
                >
                  <GroupAvatar group={m.group} size={40} />
                  <span className="option-main">
                    {m.group.name}
                    <span className="muted-sm option-sub">
                      {m.status === 'pending' ? <><Clock size={12} strokeWidth={2.4} aria-hidden="true" /> Esperando aprobación</> : m.role === 'admin' ? 'Sos admin' : 'Integrante'}
                    </span>
                  </span>
                  <span className="option-check" aria-hidden="true">{active && <Check size={18} strokeWidth={2.6} />}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <EventsCard
        title="Eventos sueltos"
        events={events.standaloneEvents}
        canCreate
        onCreate={onNewStandaloneEvent}
        onOpen={onOpenEvent}
        emptyText="Para una juntada puntual sin armar un grupo: en segundos, con invitados sin cuenta."
      />

      <div className="detail-actions">
        <Pressable className="btn btn-glass btn-lg" onClick={onJoin}>
          <Ticket size={16} strokeWidth={2.2} /> Unirme con código
        </Pressable>
        <Pressable className="btn btn-primary btn-lg" onClick={onCreate}>
          <Plus size={16} strokeWidth={2.6} /> Crear grupo
        </Pressable>
      </div>
    </>
  )
}
