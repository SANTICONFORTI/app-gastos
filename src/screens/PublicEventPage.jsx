import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Copy, Check, Clock, Lock, UserCheck } from 'lucide-react'
import Amount from '../components/Amount'
import Avatar from '../components/Avatar'
import Pressable from '../components/Pressable'
import Toast from '../components/Toast'
import MovementRow from '../components/MovementRow'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthProvider'
import { eventExpenseArs, eventTransfers, participantShares } from '../lib/eventMath'
import { avatarColor, initialsOf } from '../lib/profile'
import { formatLongDate, formatWhen } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { friendlyError } from '../lib/db'
import { listContainer, listItem } from '../lib/motion'

/** What guests see with the event link: no account needed. */
export default function PublicEventPage({ token }) {
  const { status: authStatus } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [me, setMe] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    document.documentElement.dataset.space = 'group'
  }, [])

  const notice = (m) => {
    setToast(m)
    setTimeout(() => setToast(null), 3200)
  }

  const load = useCallback(async () => {
    const { data: ev, error: err } = await supabase.rpc('get_public_event', { p_token: token })
    if (err) setError(friendlyError(err))
    else setData(ev)
  }, [token])

  useEffect(() => {
    load()
    const timer = setInterval(load, 20000) // keep it fresh while it's open
    return () => clearInterval(timer)
  }, [load])

  if (error) {
    return (
      <main className="status-screen">
        <div className="status-box">
          <h1 className="screen-title">No encontramos el evento</h1>
          <p className="muted-sm">{error.replace(/\.?$/, '.')} Pedile a quien lo organizó un link nuevo.</p>
          <a className="btn btn-primary btn-lg" href="/">Ir a Puly</a>
        </div>
      </main>
    )
  }
  if (!data) return <main className="status-screen" aria-busy="true"><span className="auth-logo status-logo">$</span></main>

  const byId = Object.fromEntries(data.participants.map((p) => [p.id, p]))
  const expenses = data.expenses.map((x) => ({ ...x, split_snapshot: x.split }))
  const payments = data.payments.map((p) => ({ ...p, from_participant: p.from, to_participant: p.to }))
  const transfers = eventTransfers(expenses, payments)
  const shares = participantShares(expenses)
  const total = expenses.filter((x) => x.status === 'active').reduce((s, x) => s + eventExpenseArs(x), 0)
  const myTransfers = me ? transfers.filter((t) => t.from === me) : []
  const owedToMe = me ? transfers.filter((t) => t.to === me) : []
  const reportedFromMe = me ? payments.filter((p) => p.from === me && p.status === 'reported') : []
  const meP = me ? byId[me] : null

  async function report(t) {
    setBusy(true)
    try {
      await supabase.rpc('report_guest_payment', { p_token: token, p_from: t.from, p_to: t.to, p_amount: t.amount }).then(({ error: err }) => { if (err) throw err })
      notice('¡Listo! Le avisamos que pagaste. Falta que lo confirme.')
      await load()
    } catch (e) {
      notice(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    setBusy(true)
    const { error: err } = await supabase.rpc('claim_event_guest', { p_token: token, p_participant: me })
    setBusy(false)
    if (err) return notice(friendlyError(err))
    notice('¡Listo! Ya está vinculado a tu cuenta')
    setTimeout(() => { window.location.href = '/' }, 1200)
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
      notice('Alias copiado: pegalo en tu banco o billetera')
    } catch {
      notice('No se pudo copiar')
    }
  }

  const avatarOf = (p, size) => (
    <Avatar src={p?.avatar_url || undefined} initials={initialsOf(p?.name ?? '?')} color={avatarColor(p?.id)} size={size} label={p?.name} />
  )

  return (
    <motion.main className="public-event" variants={listContainer} initial="hidden" animate="show">
      <motion.header variants={listItem} className="public-brand">
        <span className="public-logo" aria-hidden="true">$</span> Puly
      </motion.header>

      <motion.section variants={listItem} className="detail-hero">
        <h1 className="screen-title">{data.name}</h1>
        <span className="muted-sm">{formatLongDate(`${data.date}T12:00:00`)}{data.group_name ? ` · ${data.group_name}` : ''}</span>
        <Amount value={total} className="detail-amount" />
        <span className="muted-sm">entre {data.participants.length} personas</span>
        {data.status === 'closed' && <span className="installment-badge"><Lock size={12} strokeWidth={2.4} aria-hidden="true" /> Evento cerrado</span>}
      </motion.section>

      <motion.section variants={listItem} className="card glass member-card" aria-labelledby="who-title">
        <h2 id="who-title" className="card-title">¿Quién sos?</h2>
        <div className="guest-chips">
          {data.participants.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`person-chip glass ${me === p.id ? 'is-active' : ''}`}
              aria-pressed={me === p.id}
              onClick={() => setMe(p.id)}
            >
              {avatarOf(p, 24)} {p.name}
            </button>
          ))}
        </div>
      </motion.section>

      {meP && (
        <motion.section variants={listItem} className="card glass debts-card" aria-labelledby="mine-title">
          <h2 id="mine-title" className="card-title">Hola, {meP.name.split(' ')[0]}</h2>
          <p className="muted-sm">Tu parte del evento: <strong>{formatMoney(Math.round(shares[me] ?? 0))}</strong></p>
          {myTransfers.length === 0 && owedToMe.length === 0 && <p className="all-square"><Check size={18} strokeWidth={2.4} aria-hidden="true" /> Estás a mano</p>}
          {myTransfers.map((t) => {
            const to = byId[t.to]
            const already = reportedFromMe.some((p) => p.to === t.to)
            return (
              <div key={t.to} className="public-pay glass">
                <span className="public-pay-line">Le tenés que pasar <strong>{formatMoney(t.amount)}</strong> a {to.name}</span>
                {to.alias ? (
                  <button type="button" className="alias-copy" onClick={() => copy(to.alias)} aria-label={`Copiar alias ${to.alias}`}>
                    <span>{to.alias}</span> <Copy size={18} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="muted-sm">{to.name} no cargó su alias: pedíselo.</span>
                )}
                {already ? (
                  <span className="form-notice"><Clock size={14} strokeWidth={2.2} aria-hidden="true" /> Avisaste que pagaste · falta que lo confirme</span>
                ) : meP.is_guest ? (
                  <Pressable className="btn btn-primary btn-lg" disabled={busy} onClick={() => report(t)}>Ya pagué</Pressable>
                ) : (
                  <span className="muted-sm">Avisá tu pago desde la app de Puly.</span>
                )}
              </div>
            )
          })}
          {owedToMe.map((t) => (
            <p key={t.from} className="muted-sm">{byId[t.from].name} te tiene que pasar {formatMoney(t.amount)}.</p>
          ))}
          {meP.is_guest && authStatus === 'signed-in' && (
            <Pressable className="btn btn-glass btn-lg" disabled={busy} onClick={claim}>
              <UserCheck size={16} strokeWidth={2.2} /> Soy yo: vincular a mi cuenta
            </Pressable>
          )}
        </motion.section>
      )}

      <motion.section variants={listItem} className="card glass debts-card" aria-labelledby="all-debts">
        <h2 id="all-debts" className="card-title">Para quedar a mano</h2>
        {transfers.length === 0 ? <p className="all-square">¡Están todos a mano!</p> : transfers.map((t) => (
          <div key={`${t.from}-${t.to}`} className="debt-row">
            {avatarOf(byId[t.from], 32)}
            <ArrowRight size={16} strokeWidth={2} className="debt-arrow" aria-label="le debe a" />
            {avatarOf(byId[t.to], 32)}
            <span className="debt-text">
              <span className="debt-amount">{formatMoney(t.amount)}</span>
              <span className="muted-sm">{byId[t.from].name.split(' ')[0]} → {byId[t.to].name.split(' ')[0]}</span>
            </span>
          </div>
        ))}
      </motion.section>

      <motion.section variants={listItem} aria-labelledby="pub-expenses">
        <h2 id="pub-expenses" className="section-title list-title">Gastos</h2>
        <ul className="movement-list">
          {[...expenses].reverse().map((x) => (
            <MovementRow
              key={x.id}
              icon={avatarOf(byId[x.paid_by], 44)}
              title={x.note || 'Gasto'}
              detail={`Pagó ${byId[x.paid_by]?.name.split(' ')[0]} · ${formatWhen(x.spent_at)}`}
              amount={eventExpenseArs(x)}
              side={`entre ${x.split.length}`}
              voided={x.status === 'voided' ? { when: '', reason: x.void_reason } : null}
            />
          ))}
        </ul>
      </motion.section>

      <motion.footer variants={listItem} className="public-footer">
        <p className="muted-sm">¿Querés llevar tus gastos y los de tu grupo? Puly es gratis y sin publicidad.</p>
        <a className="btn btn-glass btn-lg" href="/">Probar Puly</a>
      </motion.footer>
      <Toast message={toast} />
    </motion.main>
  )
}
