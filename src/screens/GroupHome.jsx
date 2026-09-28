import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Amount from '../components/Amount'
import Avatar from '../components/Avatar'
import CategoryIcon from '../components/CategoryIcon'
import MovementRow from '../components/MovementRow'
import Pressable from '../components/Pressable'
import { demoGroup as data } from '../data/demo'
import { formatMoney } from '../lib/format'
import { listContainer, listItem } from '../lib/motion'

const memberById = Object.fromEntries(data.members.map((m) => [m.id, m]))

export default function GroupHome({ onSoon }) {
  const visibleMembers = data.members.slice(0, 3)
  const extra = data.members.length - visibleMembers.length

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.section variants={listItem} className="group-head">
        <div className="group-head-text">
          <h1 className="group-name">{data.name}</h1>
          <span className="online-pill glass">
            <span className="online-dot" aria-hidden="true" />
            {data.onlineCount} en línea ahora
          </span>
        </div>
        <div className="avatar-row" aria-label={`${data.members.length} integrantes`}>
          {visibleMembers.map((m) => (
            <Avatar key={m.id} initials={m.initials} color={m.color} label={m.name} ring="#231F5C" />
          ))}
          {extra > 0 && <Avatar initials={`+${extra}`} color="#2E2F66" label={`${extra} más`} ring="#231F5C" />}
        </div>
      </motion.section>

      <motion.section variants={listItem} className="hero-text">
        <span className="hero-label">Gasto total del grupo · {data.monthLabel}</span>
        <Amount value={data.total} />
      </motion.section>

      <motion.section variants={listItem} className="card glass debts-card" aria-labelledby="debts-title">
        <div className="debts-head">
          <h2 id="debts-title" className="card-title">Para quedar a mano</h2>
          <span className="muted-sm">{data.debts.length} transferencias</span>
        </div>
        {data.debts.map((d) => {
          const from = memberById[d.from]
          const to = memberById[d.to]
          const mine = d.from === 'me'
          return (
            <div key={`${d.from}-${d.to}`} className={`debt-row ${mine ? 'is-mine' : ''}`}>
              <Avatar initials={from.initials} color={from.color} size={32} label={from.name} />
              <ArrowRight size={16} strokeWidth={2} className="debt-arrow" aria-label="le debe a" />
              <Avatar initials={to.initials} color={to.color} size={32} label={to.name} />
              <span className="debt-amount">{formatMoney(d.amount)}</span>
              {mine ? (
                <Pressable className="btn btn-primary debt-btn" onClick={() => onSoon('Pagar')}>Pagar</Pressable>
              ) : (
                <Pressable className="btn btn-glass debt-btn" onClick={() => onSoon('Saldar')}>Saldar</Pressable>
              )}
            </div>
          )
        })}
      </motion.section>

      <motion.section variants={listItem} aria-labelledby="group-movements">
        <div className="section-head">
          <h2 id="group-movements" className="section-title">Movimientos</h2>
          {data.isAdmin && <span className="admin-badge">SOS ADMIN</span>}
        </div>
        <motion.ul className="movement-list" variants={listContainer} initial="hidden" animate="show">
          {data.movements.map((m) => {
            const payer = memberById[m.paidBy]
            return (
              <MovementRow
                key={m.id}
                icon={<CategoryIcon color={payer.color}>{payer.initials}</CategoryIcon>}
                title={m.title}
                detail={`Pagó ${payer.name} · ${m.detail}`}
                amount={m.amount}
                side={`entre ${m.splitCount}`}
                voided={m.voided}
              />
            )
          })}
        </motion.ul>
      </motion.section>
    </motion.div>
  )
}
