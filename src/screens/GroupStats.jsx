import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Amount from '../components/Amount'
import Pressable from '../components/Pressable'
import ProgressBar from '../components/ProgressBar'
import UserAvatar from '../components/UserAvatar'
import { useGroups } from '../store/GroupsStore'
import { usePersonalStore } from '../store/PersonalStore'
import { monthKey, monthLabelWithYear, shiftMonth } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { groupExpenseArs } from '../lib/groupMath'
import { listContainer, listItem } from '../lib/motion'

/** Month summary for the group: by category, who paid, and each one's share. */
export default function GroupStats() {
  const groups = useGroups()
  const store = usePersonalStore()
  const [month, setMonth] = useState(monthKey())

  if (!groups.selected || !groups.isActiveMember) {
    return <p className="empty-text">Elegí un grupo en Inicio para ver sus estadísticas.</p>
  }

  const expenses = groups.expenses.filter((e) => e.status === 'active' && monthKey(e.spent_at) === month)
  const total = expenses.reduce((s, e) => s + groupExpenseArs(e), 0)

  const byCategory = {}
  const paid = {}
  const share = {}
  for (const e of expenses) {
    const ars = groupExpenseArs(e)
    const rate = e.currency === 'USD' ? Number(e.exchange_rate) : 1
    byCategory[e.category_id] = (byCategory[e.category_id] ?? 0) + ars
    paid[e.paid_by] = (paid[e.paid_by] ?? 0) + ars
    for (const s of e.split_snapshot ?? []) share[s.user_id] = (share[s.user_id] ?? 0) + Number(s.amount) * rate
  }
  const sorted = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])
  const maxPaid = Math.max(1, ...Object.values(paid))
  const name = (id) => groups.memberById[id]?.profile?.display_name ?? 'Alguien'

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.header variants={listItem} className="hero">
        <div className="hero-text">
          <span className="hero-label">{groups.selected.group.name}</span>
          <h1 className="screen-title">Estadísticas</h1>
        </div>
      </motion.header>

      <motion.div variants={listItem} className="month-nav glass stats-month">
        <Pressable className="btn btn-glass btn-icon" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={18} strokeWidth={2.4} />
        </Pressable>
        <div className="month-nav-text" aria-live="polite">
          <span className="card-title">{monthLabelWithYear(month)}</span>
          <Amount value={total} className="stats-total" />
        </div>
        <Pressable className="btn btn-glass btn-icon" aria-label="Mes siguiente" disabled={month >= monthKey()} onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight size={18} strokeWidth={2.4} />
        </Pressable>
      </motion.div>

      {total === 0 ? (
        <motion.p variants={listItem} className="empty-text">No hay gastos del grupo en este mes.</motion.p>
      ) : (
        <>
          <motion.section variants={listItem} className="card glass stats-card" aria-labelledby="gcat-title">
            <h2 id="gcat-title" className="card-title">Por categoría</h2>
            <ul className="bar-list">
              {sorted(byCategory).map(([id, value]) => {
                const cat = store.getCategory(id)
                return (
                  <li key={id}>
                    <span className="bar-label"><span className="legend-dot" style={{ background: cat.color }} aria-hidden="true" />{cat.name}</span>
                    <span className="bar-value">{formatMoney(Math.round(value))} · {Math.round((value / total) * 100)}%</span>
                    <ProgressBar value={value / total} label={`${cat.name}: ${Math.round((value / total) * 100)}%`} />
                  </li>
                )
              })}
            </ul>
          </motion.section>

          <motion.section variants={listItem} className="card glass stats-card" aria-labelledby="gpaid-title">
            <h2 id="gpaid-title" className="card-title">Quién puso la plata</h2>
            <ul className="bar-list">
              {sorted(paid).map(([id, value]) => (
                <li key={id}>
                  <span className="bar-label"><UserAvatar profile={groups.memberById[id]?.profile} size={24} />{name(id)}</span>
                  <span className="bar-value">{formatMoney(Math.round(value))}</span>
                  <ProgressBar value={value / maxPaid} label={`${name(id)} pagó ${formatMoney(Math.round(value))}`} />
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section variants={listItem} className="card glass stats-card" aria-labelledby="gshare-title">
            <h2 id="gshare-title" className="card-title">Cuánto le tocó a cada uno</h2>
            <ul className="change-list">
              {sorted(share).map(([id, value]) => (
                <li key={id} className="change-row">
                  <UserAvatar profile={groups.memberById[id]?.profile} size={28} />
                  <span className="change-name">{name(id)}</span>
                  <span className="movement-amount">{formatMoney(Math.round(value))}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      )}
    </motion.div>
  )
}
