import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Plus, Share2, Lock, UserPlus, Ban, Check, Clock, PartyPopper } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import Amount from './Amount'
import UserAvatar from './UserAvatar'
import MovementRow from './MovementRow'
import { VoidForm } from './ExpenseDetailSheet'
import { asMember, participantName, useEvents } from '../store/EventsStore'
import { useGroups } from '../store/GroupsStore'
import { useAuth } from '../store/AuthProvider'
import { eventExpenseArs, eventTransfers } from '../lib/eventMath'
import { formatLongDate, formatWhen } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { friendlyError } from '../lib/db'
import { softSpring } from '../lib/motion'

export default function EventSheet({ eventId, onClose, onAddExpense, onShare, onNotice }) {
  return (
    <Sheet open={Boolean(eventId)} onClose={onClose} labelledBy="event-title" space="group" tall>
      {eventId && <EventDetail eventId={eventId} onClose={onClose} onAddExpense={onAddExpense} onShare={onShare} onNotice={onNotice} />}
    </Sheet>
  )
}

export function useIsEventAdmin(event) {
  const { user } = useAuth()
  const groups = useGroups()
  if (!event) return false
  if (event.created_by === user.id) return true
  const m = groups.memberships.find((x) => x.group.id === event.group_id)
  return Boolean(m && m.status === 'active' && m.role === 'admin')
}

function EventDetail({ eventId, onClose, onAddExpense, onShare, onNotice }) {
  const events = useEvents()
  const groups = useGroups()
  const { user } = useAuth()
  const ev = events.getEvent(eventId)
  const isAdmin = useIsEventAdmin(ev)
  const [guestName, setGuestName] = useState('')
  const [voiding, setVoiding] = useState(null) // { kind, id }
  const [reason, setReason] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!ev) return null
  const open = ev.status === 'open'
  const byId = Object.fromEntries(ev.participants.map((p) => [p.id, p]))
  const me = ev.participants.find((p) => p.user_id === user.id)
  const total = ev.expenses.filter((x) => x.status === 'active').reduce((s, x) => s + eventExpenseArs(x), 0)
  const transfers = eventTransfers(ev.expenses, ev.payments)
  const reported = ev.payments.filter((p) => p.status === 'reported')
  const groupName = ev.group_id ? groups.memberships.find((m) => m.group.id === ev.group_id)?.group.name : null
  const missingMembers = ev.group_id && groups.groupId === ev.group_id
    ? groups.activeMembers.filter((m) => !ev.participants.some((p) => p.user_id === m.user_id))
    : []

  async function run(fn, message) {
    setBusy(true)
    setError('')
    try {
      await fn()
      if (message) onNotice(message)
      return true
    } catch (e) {
      setError(friendlyError(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addGuest(e) {
    e?.preventDefault()
    if (!guestName.trim()) return
    if (await run(() => events.addParticipants(ev.id, { guests: [guestName] }), `${guestName.trim()} se sumó al evento`)) setGuestName('')
  }

  async function confirmVoid() {
    const ok = await run(
      () => (voiding.kind === 'expense' ? events.voidExpense(voiding.id, reason) : events.voidPayment(voiding.id, reason)),
      voiding.kind === 'expense' ? 'Gasto anulado' : 'Pago anulado',
    )
    if (ok) {
      setVoiding(null)
      setReason('')
    }
  }

  return (
    <div className="detail">
      <SheetHeader id="event-title" title={ev.name} onClose={onClose} />

      <section className="detail-hero">
        <span className="muted-sm">{formatLongDate(`${ev.event_date}T12:00:00`)} · {groupName ?? 'Evento suelto'}</span>
        <Amount value={total} className="detail-amount" />
        <span className="muted-sm">entre {ev.participants.length} {ev.participants.length === 1 ? 'persona' : 'personas'}</span>
        {!open && <span className="installment-badge"><Lock size={12} strokeWidth={2.4} aria-hidden="true" /> Evento cerrado</span>}
      </section>

      {!open && ev.group_id && (
        <p className="muted-sm detail-note">Las deudas entre integrantes del grupo se sumaron a “Para quedar a mano” del grupo. Las de invitados siguen acá.</p>
      )}

      <section aria-labelledby="ev-people">
        <h2 id="ev-people" className="card-title list-title">Participantes</h2>
        <div className="guest-chips">
          {ev.participants.map((p) => (
            <span key={p.id} className="person-chip glass">
              <UserAvatar profile={asMember(p).profile} size={24} />
              {participantName(p)}{p.user_id === user.id ? ' (vos)' : ''}
              {!p.user_id && <span className="guest-tag">invitado</span>}
            </span>
          ))}
        </div>
        {isAdmin && open && (
          <>
            <form className="code-row add-guest" onSubmit={addGuest}>
              <span className="input-wrap glass code-field">
                <input value={guestName} maxLength={40} onChange={(e) => setGuestName(e.target.value)} placeholder="Sumar invitado (nombre)" aria-label="Nombre del invitado" />
              </span>
              <Pressable type="submit" className="btn btn-glass btn-icon btn-lg-icon" aria-label="Sumar invitado" disabled={busy || !guestName.trim()}>
                <UserPlus size={18} strokeWidth={2.2} />
              </Pressable>
            </form>
            {missingMembers.length > 0 && (
              <div className="guest-chips">
                {missingMembers.map((m) => (
                  <Pressable
                    key={m.user_id}
                    className="btn btn-glass small-btn"
                    disabled={busy}
                    onClick={() => run(() => events.addParticipants(ev.id, { memberIds: [m.user_id] }), `${m.profile?.display_name} se sumó`)}
                  >
                    <Plus size={13} strokeWidth={2.6} /> {m.profile?.display_name?.split(' ')[0]}
                  </Pressable>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="card glass debts-card" aria-labelledby="ev-debts">
        <h2 id="ev-debts" className="card-title">Para quedar a mano</h2>
        {transfers.length === 0 ? (
          <p className="all-square"><PartyPopper size={18} strokeWidth={2} aria-hidden="true" /> {total > 0 ? '¡Están todos a mano!' : 'Todavía no hay gastos.'}</p>
        ) : transfers.map((t) => {
          const mine = me && t.from === me.id
          return (
            <div key={`${t.from}-${t.to}`} className={`debt-row ${mine ? 'is-mine' : ''}`}>
              <UserAvatar profile={asMember(byId[t.from]).profile} size={32} />
              <ArrowRight size={16} strokeWidth={2} className="debt-arrow" aria-label="le debe a" />
              <UserAvatar profile={asMember(byId[t.to]).profile} size={32} />
              <span className="debt-text">
                <span className="debt-amount">{formatMoney(t.amount)}</span>
                <span className="muted-sm">{participantName(byId[t.from]).split(' ')[0]} → {participantName(byId[t.to]).split(' ')[0]}</span>
              </span>
              {isAdmin ? (
                <Pressable className="btn btn-glass debt-btn" disabled={busy} onClick={() => run(() => events.addPayment(ev.id, { from: t.from, to: t.to, amount: t.amount, confirmed: true }), 'Pago registrado')}>
                  Registrar
                </Pressable>
              ) : mine ? (
                <Pressable className="btn btn-primary debt-btn" disabled={busy} onClick={() => run(() => events.addPayment(ev.id, { from: t.from, to: t.to, amount: t.amount, confirmed: false }), 'Avisamos que pagaste. Falta que lo confirmen')}>
                  Ya pagué
                </Pressable>
              ) : null}
            </div>
          )
        })}
      </section>

      {reported.length > 0 && (
        <section className="card glass member-card" aria-labelledby="ev-reported">
          <h2 id="ev-reported" className="card-title">Pagos informados</h2>
          {reported.map((p) => (
            <div key={p.id} className="member-row">
              <Clock size={18} strokeWidth={2} aria-hidden="true" className="reported-icon" />
              <span className="movement-main">
                <span className="movement-title">{participantName(byId[p.from_participant])} le pagó {formatMoney(Number(p.amount))} a {participantName(byId[p.to_participant])}</span>
                <span className="movement-detail">{p.reported_via === 'link' ? 'Avisó desde el link' : 'Avisó desde la app'} · {formatWhen(p.created_at)} · falta confirmar</span>
              </span>
              {isAdmin && (
                <div className="invite-row-actions">
                  <Pressable className="btn btn-glass btn-icon" aria-label="Anular aviso de pago" onClick={() => setVoiding({ kind: 'payment', id: p.id })}><Ban size={16} strokeWidth={2.2} /></Pressable>
                  <Pressable className="btn btn-primary btn-icon" aria-label="Confirmar pago" disabled={busy} onClick={() => run(() => events.confirmPayment(p.id), 'Pago confirmado')}><Check size={16} strokeWidth={2.6} /></Pressable>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="ev-expenses">
        <div className="section-head">
          <h2 id="ev-expenses" className="section-title">Gastos</h2>
        </div>
        {ev.expenses.length === 0 ? (
          <p className="empty-text">{isAdmin && open ? 'Cargá el primer gasto del evento.' : 'Todavía no hay gastos.'}</p>
        ) : (
          <ul className="movement-list">
            {ev.expenses.map((x) => (
              <MovementRow
                key={x.id}
                icon={<UserAvatar profile={asMember(byId[x.paid_by]).profile} size={44} />}
                title={x.note || 'Gasto'}
                detail={`Pagó ${participantName(byId[x.paid_by]).split(' ')[0]} · ${formatWhen(x.spent_at)}`}
                amount={eventExpenseArs(x)}
                side={`entre ${x.split_snapshot.length}`}
                voided={x.status === 'voided' ? { when: formatWhen(x.voided_at), reason: x.void_reason } : null}
                onClick={isAdmin && x.status === 'active' ? () => setVoiding({ kind: 'expense', id: x.id }) : undefined}
              />
            ))}
          </ul>
        )}
        {ev.payments.filter((p) => p.status !== 'reported').length > 0 && (
          <p className="muted-sm detail-note">
            Pagos confirmados: {ev.payments.filter((p) => p.status === 'confirmed').map((p) => `${participantName(byId[p.from_participant]).split(' ')[0]} → ${participantName(byId[p.to_participant]).split(' ')[0]} ${formatMoney(Number(p.amount))}`).join(' · ') || 'ninguno'}
          </p>
        )}
      </section>

      <AnimatePresence mode="wait" initial={false}>
        {voiding ? (
          <VoidForm
            key="void"
            title={voiding.kind === 'expense' ? '¿Anular este gasto?' : '¿Anular este aviso de pago?'}
            explanation="No se borra: queda registrado con tu nombre, la fecha y el motivo."
            confirmLabel="Anular"
            reason={reason}
            setReason={setReason}
            busy={busy}
            error={error}
            onCancel={() => { setVoiding(null); setReason('') }}
            onConfirm={confirmVoid}
          />
        ) : confirmClose ? (
          <motion.div key="close" className="void-form glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={softSpring}>
            <p className="card-title">¿Cerrar {ev.name}?</p>
            <p className="muted-sm">
              Queda archivado con su resumen y ya no se pueden cargar gastos.
              {ev.group_id ? ' Lo que se deben entre integrantes pasa a las deudas del grupo.' : ''}
            </p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="detail-actions">
              <Pressable className="btn btn-glass" onClick={() => setConfirmClose(false)}>Cancelar</Pressable>
              <Pressable className="btn btn-primary" disabled={busy} onClick={async () => { if (await run(() => events.closeEvent(ev.id), 'Evento cerrado')) setConfirmClose(false) }}>Cerrar evento</Pressable>
            </div>
          </motion.div>
        ) : (
          <motion.div key="actions" className="event-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {error && <p className="form-error" role="alert">{error}</p>}
            {isAdmin && open && (
              <Pressable className="btn btn-primary btn-lg full-btn" onClick={() => onAddExpense(ev)}><Plus size={16} strokeWidth={2.6} /> Cargar gasto</Pressable>
            )}
            <div className="detail-actions">
              {isAdmin && <Pressable className="btn btn-glass btn-lg" onClick={() => onShare(ev)}><Share2 size={16} strokeWidth={2.2} /> Link para invitados</Pressable>}
              {isAdmin && open && <Pressable className="btn btn-glass btn-lg" onClick={() => setConfirmClose(true)}><Lock size={16} strokeWidth={2.2} /> Cerrar</Pressable>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
