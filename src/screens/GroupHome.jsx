import { motion } from 'framer-motion'
import { ArrowRight, ChevronDown, HandCoins, Plus, Ticket, Users, Clock, PartyPopper } from 'lucide-react'
import Amount from '../components/Amount'
import GroupAvatar from '../components/GroupAvatar'
import UserAvatar from '../components/UserAvatar'
import MovementRow from '../components/MovementRow'
import Pressable from '../components/Pressable'
import { useGroups } from '../store/GroupsStore'
import { useAuth } from '../store/AuthProvider'
import { formatWhen, monthKey, monthName } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { balancesByMember, groupExpenseArs, simplifyDebts } from '../lib/groupMath'
import { friendlyError } from '../lib/db'
import { listContainer, listItem } from '../lib/motion'

const MAX_AVATARS = 3
const RECENT = 30
const firstName = (m) => (m?.profile?.display_name || m?.profile?.username || 'Alguien').split(' ')[0]

export default function GroupHome({ onOpenPicker, onCreate, onJoin, onOpenExpense, onOpenSettlement, onSettle, onNotice }) {
  const groups = useGroups()
  const { user } = useAuth()

  if (groups.listStatus === 'loading') return <div className="screen-loading" aria-busy="true" />

  if (!groups.selected) {
    return <NoGroups invitations={groups.invitations.length} onOpenPicker={onOpenPicker} onCreate={onCreate} onJoin={onJoin} />
  }

  const { group } = groups.selected

  if (!groups.isActiveMember) {
    return (
      <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
        <GroupHeader group={group} onOpenPicker={onOpenPicker} />
        <motion.section variants={listItem} className="card glass empty-card">
          <span className="coming-soon-icon glass"><Clock size={26} strokeWidth={2} /></span>
          <p className="card-title">Esperando aprobación</p>
          <p className="muted-sm">Le avisamos a los admins de {group.name}. Vas a ver los gastos cuando te aprueben.</p>
          <Pressable
            className="btn btn-glass"
            onClick={async () => {
              try {
                await groups.leaveGroup(group.id)
                onNotice('Pedido cancelado')
              } catch (e) {
                onNotice(friendlyError(e))
              }
            }}
          >
            Cancelar pedido
          </Pressable>
        </motion.section>
      </motion.div>
    )
  }

  if (groups.status !== 'ready') return <div className="screen-loading" aria-busy="true" />

  const month = monthKey()
  const monthTotal = groups.expenses
    .filter((e) => e.status === 'active' && monthKey(e.spent_at) === month)
    .reduce((s, e) => s + groupExpenseArs(e), 0)
  const net = balancesByMember(groups.expenses, groups.settlements)
  const transfers = simplifyDebts(net)
  const myNet = (net[user.id] ?? 0) / 100

  const movements = [
    ...groups.expenses.map((e) => ({ kind: 'expense', at: e.spent_at, row: e })),
    ...groups.settlements.map((s) => ({ kind: 'settlement', at: s.created_at, row: s })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT)

  const visible = groups.activeMembers.slice(0, MAX_AVATARS)
  const extra = groups.activeMembers.length - visible.length

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.section variants={listItem} className="group-head">
        <div className="group-head-text">
          <button type="button" className="group-name-btn" onClick={onOpenPicker} aria-label={`Grupo ${group.name}. Cambiar de grupo`}>
            <span className="group-name">{group.name}</span>
            <ChevronDown size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <span className="online-pill glass">
            <span className="online-dot" aria-hidden="true" />
            {groups.online.size} en línea ahora
          </span>
        </div>
        <div className="avatar-row" aria-label={`${groups.activeMembers.length} integrantes`}>
          {visible.map((m) => (
            <span key={m.user_id} className="avatar-with-dot">
              <UserAvatar profile={m.profile} size={38} ring="#231F5C" />
              {groups.online.has(m.user_id) && <span className="presence-dot" aria-label="en línea" />}
            </span>
          ))}
          {extra > 0 && (
            <span className="avatar avatar-ring avatar-extra" style={{ width: 38, height: 38, borderColor: '#231F5C' }}>+{extra}</span>
          )}
        </div>
      </motion.section>

      <motion.section variants={listItem} className="hero-text">
        <span className="hero-label">Gasto total del grupo · {monthName(month)}</span>
        <Amount value={monthTotal} />
        <span className={`my-balance ${myNet > 0.5 ? 'is-up' : myNet < -0.5 ? 'is-down' : ''}`}>
          {myNet > 0.5 ? `Te deben ${formatMoney(myNet)}` : myNet < -0.5 ? `Debés ${formatMoney(-myNet)}` : 'Estás a mano'}
        </span>
      </motion.section>

      <motion.section variants={listItem} className="card glass debts-card" aria-labelledby="debts-title">
        <div className="debts-head">
          <h2 id="debts-title" className="card-title">Para quedar a mano</h2>
          {transfers.length > 0 && <span className="muted-sm">{transfers.length} {transfers.length === 1 ? 'transferencia' : 'transferencias'}</span>}
        </div>
        {transfers.length === 0 ? (
          <p className="all-square"><PartyPopper size={18} strokeWidth={2} aria-hidden="true" /> ¡Están todos a mano!</p>
        ) : transfers.map((t) => {
          const from = groups.memberById[t.from]
          const to = groups.memberById[t.to]
          const mine = t.from === user.id
          const canRegister = mine || groups.isAdmin
          return (
            <div key={`${t.from}-${t.to}`} className={`debt-row ${mine ? 'is-mine' : ''}`}>
              <UserAvatar profile={from?.profile} size={32} />
              <ArrowRight size={16} strokeWidth={2} className="debt-arrow" aria-label="le debe a" />
              <UserAvatar profile={to?.profile} size={32} />
              <span className="debt-text">
                <span className="debt-amount">{formatMoney(t.amount)}</span>
                <span className="muted-sm">{mine ? 'Vos' : firstName(from)} → {t.to === user.id ? 'vos' : firstName(to)}</span>
              </span>
              {canRegister && (
                <Pressable className={`btn ${mine ? 'btn-primary' : 'btn-glass'} debt-btn`} onClick={() => onSettle(t)}>
                  {mine ? 'Pagar' : 'Saldar'}
                </Pressable>
              )}
            </div>
          )
        })}
      </motion.section>

      <motion.section variants={listItem} aria-labelledby="group-movements">
        <div className="section-head">
          <h2 id="group-movements" className="section-title">Movimientos</h2>
          {groups.isAdmin && <span className="admin-badge">SOS ADMIN</span>}
        </div>
        {movements.length === 0 ? (
          <p className="empty-text">
            {groups.isAdmin ? 'Todavía no hay gastos. Tocá + para cargar el primero.' : 'Todavía no hay gastos. Los carga un admin.'}
          </p>
        ) : (
          <motion.ul className="movement-list" variants={listContainer} initial="hidden" animate="show">
            {movements.map((mv) => (mv.kind === 'expense'
              ? <GroupExpenseRow key={mv.row.id} expense={mv.row} onOpen={() => onOpenExpense(mv.row.id)} />
              : <SettlementRow key={mv.row.id} settlement={mv.row} onOpen={() => onOpenSettlement(mv.row.id)} />))}
          </motion.ul>
        )}
      </motion.section>
    </motion.div>
  )
}

function GroupHeader({ group, onOpenPicker }) {
  return (
    <motion.section variants={listItem} className="group-head">
      <button type="button" className="group-name-btn" onClick={onOpenPicker} aria-label={`Grupo ${group.name}. Cambiar de grupo`}>
        <GroupAvatar group={group} size={40} />
        <span className="group-name">{group.name}</span>
        <ChevronDown size={20} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </motion.section>
  )
}

function GroupExpenseRow({ expense, onOpen }) {
  const groups = useGroups()
  const payer = groups.memberById[expense.paid_by]
  const voider = groups.memberById[expense.voided_by]
  const count = expense.split_snapshot?.length ?? 0
  return (
    <MovementRow
      icon={<UserAvatar profile={payer?.profile} size={44} />}
      title={expense.note || 'Gasto'}
      detail={`Pagó ${firstName(payer)} · ${formatWhen(expense.spent_at)}${expense.receipt_path ? ' · con ticket' : ''}`}
      amount={groupExpenseArs(expense)}
      side={count ? `entre ${count}` : ''}
      voided={expense.status === 'voided'
        ? { by: voider ? `${firstName(voider)}${voider.role === 'admin' ? ' (admin)' : ''}` : null, when: formatWhen(expense.voided_at), reason: expense.void_reason }
        : null}
      onClick={onOpen}
    />
  )
}

function SettlementRow({ settlement, onOpen }) {
  const groups = useGroups()
  const from = groups.memberById[settlement.from_user]
  const to = groups.memberById[settlement.to_user]
  const voider = groups.memberById[settlement.voided_by]
  return (
    <MovementRow
      icon={<span className="cat-icon settle-icon" style={{ width: 44, height: 44 }}><HandCoins size={19} strokeWidth={2} /></span>}
      title={`${firstName(from)} le pagó a ${firstName(to)}`}
      detail={`Pago · ${formatWhen(settlement.created_at)}`}
      amount={Number(settlement.amount)}
      side="saldado"
      voided={settlement.status === 'voided'
        ? { by: voider ? firstName(voider) : null, when: formatWhen(settlement.voided_at), reason: settlement.void_reason }
        : null}
      onClick={onOpen}
    />
  )
}

function NoGroups({ invitations, onOpenPicker, onCreate, onJoin }) {
  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.section variants={listItem} className="card glass empty-card">
        <span className="coming-soon-icon glass"><Users size={26} strokeWidth={2} /></span>
        <p className="card-title">Compartí gastos con tu gente</p>
        <p className="muted-sm">Armá un grupo para el depto, un viaje o el asado. Todos ven los gastos al instante y Puly calcula quién le debe a quién.</p>
        {invitations > 0 && (
          <Pressable className="btn btn-glass" onClick={onOpenPicker}>
            Tenés {invitations} {invitations === 1 ? 'invitación' : 'invitaciones'} pendiente{invitations === 1 ? '' : 's'}
          </Pressable>
        )}
        <div className="detail-actions empty-actions">
          <Pressable className="btn btn-glass btn-lg" onClick={onJoin}><Ticket size={16} strokeWidth={2.2} /> Tengo un código</Pressable>
          <Pressable className="btn btn-primary btn-lg" onClick={onCreate}><Plus size={16} strokeWidth={2.6} /> Crear grupo</Pressable>
        </div>
      </motion.section>
    </motion.div>
  )
}
