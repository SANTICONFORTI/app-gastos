import { CalendarHeart, ChevronRight, Plus } from 'lucide-react'
import Pressable from './Pressable'
import { useEvents } from '../store/EventsStore'
import { eventExpenseArs } from '../lib/eventMath'
import { formatMoney } from '../lib/format'

const dateFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

/** List of events (of a group, or standalone) with a "new event" button. */
export default function EventsCard({ title, events, canCreate, onCreate, onOpen, emptyText }) {
  const store = useEvents()
  if (store.status !== 'ready') return null
  const sorted = [...events].sort((a, b) => (a.status === b.status ? b.event_date.localeCompare(a.event_date) : a.status === 'open' ? -1 : 1))

  return (
    <section className="card glass member-card" aria-label={title}>
      <div className="debts-head">
        <h2 className="card-title">{title}</h2>
        {canCreate && (
          <Pressable className="btn btn-glass small-btn" onClick={onCreate}><Plus size={14} strokeWidth={2.6} /> Nuevo</Pressable>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="muted-sm">{emptyText}</p>
      ) : (
        <ul className="option-list">
          {sorted.map((ev) => {
            const total = ev.expenses.filter((x) => x.status === 'active').reduce((s, x) => s + eventExpenseArs(x), 0)
            const pending = ev.payments.filter((p) => p.status === 'reported').length
            return (
              <li key={ev.id}>
                <button type="button" className={`event-row ${ev.status === 'closed' ? 'is-closed' : ''}`} onClick={() => onOpen(ev.id)}>
                  <span className="cat-icon event-icon" style={{ width: 40, height: 40 }}><CalendarHeart size={18} strokeWidth={2} /></span>
                  <span className="movement-main">
                    <span className="movement-title">{ev.name}</span>
                    <span className="movement-detail">
                      {dateFmt.format(new Date(`${ev.event_date}T12:00:00`)).replace('.', '')} · {ev.participants.length} personas
                      {ev.status === 'closed' ? ' · cerrado' : ''}{pending ? ` · ${pending} pago${pending === 1 ? '' : 's'} por confirmar` : ''}
                    </span>
                  </span>
                  <span className="movement-amount">{formatMoney(Math.round(total))}</span>
                  <ChevronRight size={16} strokeWidth={2.5} className="chip-arrow" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
