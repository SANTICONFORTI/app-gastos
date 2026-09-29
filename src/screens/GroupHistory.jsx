import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Ban, HandCoins, Pencil, PlusCircle } from 'lucide-react'
import { useGroups } from '../store/GroupsStore'
import { usePersonalStore } from '../store/PersonalStore'
import { formatWhen } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { describeGroupChanges } from '../lib/groupHistory'
import { listContainer, listItem } from '../lib/motion'

/** Everything that happened in the group, newest first: expenses loaded, edited, voided and payments. */
export default function GroupHistory() {
  const groups = useGroups()
  const store = usePersonalStore()
  const [rows, setRows] = useState({ list: [], status: 'loading' })
  const version = groups.expenses.map((e) => `${e.id}${e.updated_at}`).join()

  useEffect(() => {
    if (!groups.groupId || !groups.isActiveMember) return
    let cancelled = false
    groups.fetchHistory(groups.groupId)
      .then((list) => !cancelled && setRows({ list, status: 'ready' }))
      .catch(() => !cancelled && setRows({ list: [], status: 'error' }))
    return () => { cancelled = true }
  }, [groups.groupId, groups.isActiveMember, version])

  if (!groups.selected || !groups.isActiveMember) {
    return <p className="empty-text">Elegí un grupo en Inicio para ver su historial.</p>
  }

  const nameOf = (id) => groups.memberById[id]?.profile?.display_name?.split(' ')[0] ?? 'Alguien'
  const title = (h) => h.after?.note || h.before?.note || 'un gasto'
  const amount = (row) => formatMoney(Number(row?.amount ?? 0) * (row?.currency === 'USD' ? Number(row.exchange_rate) : 1))

  const events = [
    ...rows.list.map((h) => ({ key: `e${h.id}`, at: h.changed_at, kind: h.action, h })),
    ...groups.settlements.flatMap((s) => [
      { key: `s${s.id}`, at: s.created_at, kind: 'payment', s },
      ...(s.status === 'voided' ? [{ key: `sv${s.id}`, at: s.voided_at, kind: 'payment-voided', s }] : []),
    ]),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.header variants={listItem} className="hero-text">
        <span className="hero-label">{groups.selected.group.name}</span>
        <h1 className="screen-title">Historial de cambios</h1>
        <span className="muted-sm">Nada se borra: todo queda registrado con quién lo hizo y cuándo.</span>
      </motion.header>

      {rows.status === 'loading' && <p className="muted-sm">Cargando…</p>}
      {rows.status === 'error' && <p className="muted-sm">No pudimos cargar el historial. Revisá tu conexión.</p>}
      {rows.status === 'ready' && events.length === 0 && <p className="empty-text">Todavía no pasó nada en este grupo.</p>}

      <motion.ol variants={listItem} className="timeline">
        {events.map((ev) => {
          if (ev.kind === 'payment' || ev.kind === 'payment-voided') {
            const s = ev.s
            const voided = ev.kind === 'payment-voided'
            return (
              <li key={ev.key} className={`timeline-item ${voided ? 'is-voided' : ''}`}>
                <span className="timeline-icon">{voided ? <Ban size={16} strokeWidth={2} /> : <HandCoins size={16} strokeWidth={2} />}</span>
                <span className="timeline-text">
                  {voided
                    ? <>{nameOf(s.voided_by)} anuló el pago de {nameOf(s.from_user)} a {nameOf(s.to_user)} · “{s.void_reason}”</>
                    : <>{nameOf(s.created_by)} registró que {nameOf(s.from_user)} le pagó {formatMoney(Number(s.amount))} a {nameOf(s.to_user)}</>}
                  <span className="muted-sm">{formatWhen(ev.at)}</span>
                </span>
              </li>
            )
          }
          const h = ev.h
          const who = nameOf(h.changed_by)
          if (h.action === 'created') {
            return (
              <li key={ev.key} className="timeline-item">
                <span className="timeline-icon"><PlusCircle size={16} strokeWidth={2} /></span>
                <span className="timeline-text">{who} cargó “{title(h)}” por {amount(h.after)}<span className="muted-sm">{formatWhen(ev.at)}</span></span>
              </li>
            )
          }
          if (h.action === 'voided') {
            return (
              <li key={ev.key} className="timeline-item is-voided">
                <span className="timeline-icon"><Ban size={16} strokeWidth={2} /></span>
                <span className="timeline-text">{who} anuló “{title(h)}” · “{h.after?.void_reason}”<span className="muted-sm">{formatWhen(ev.at)}</span></span>
              </li>
            )
          }
          const changes = describeGroupChanges(h.before, h.after, {
            nameOf: (id) => groups.memberById[id]?.profile?.display_name ?? 'Alguien',
            categoryName: (id) => store.getCategory(id).name,
          })
          if (changes.length === 0) return null
          return (
            <li key={ev.key} className="timeline-item">
              <span className="timeline-icon"><Pencil size={16} strokeWidth={2} /></span>
              <span className="timeline-text">
                {who} editó “{title(h)}”
                <ul className="history-changes">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
                <span className="muted-sm">{formatWhen(ev.at)}</span>
              </span>
            </li>
          )
        })}
      </motion.ol>
    </motion.div>
  )
}
