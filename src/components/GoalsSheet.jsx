import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Minus, Archive, Target } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import ProgressBar from './ProgressBar'
import { VoidForm } from './ExpenseDetailSheet'
import { goalSaved, useExtras } from '../store/ExtrasStore'
import { formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { formatLongDate, formatWhen } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { friendlyError } from '../lib/db'
import { softSpring } from '../lib/motion'

const COLORS = ['#4ADE80', '#5AC8FA', '#FFB547', '#FF7A96', '#A78BFA', '#E879F9']

export default function GoalsSheet({ open, onClose, onNotice }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="goals-title" space="personal" tall>
      <Goals onClose={onClose} onNotice={onNotice} />
    </Sheet>
  )
}

function Goals({ onClose, onNotice }) {
  const extras = useExtras()
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState(null)
  const goals = extras.goals.filter((g) => g.status === 'active')

  return (
    <div className="detail">
      <SheetHeader id="goals-title" title="Metas de ahorro" onClose={onClose} />
      {goals.length === 0 && !creating && (
        <div className="card glass empty-card">
          <span className="coming-soon-icon glass"><Target size={24} strokeWidth={2} /></span>
          <p className="card-title">Poné un objetivo</p>
          <p className="muted-sm">Vacaciones, un celu nuevo, el fondo de emergencia… Anotá lo que vas guardando y mirá cómo se llena la barra.</p>
        </div>
      )}
      <ul className="ants-list">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} open={openId === g.id} onToggle={() => setOpenId(openId === g.id ? null : g.id)} onNotice={onNotice} />
        ))}
      </ul>
      <AnimatePresence mode="wait" initial={false}>
        {creating ? (
          <NewGoal key="new" onCancel={() => setCreating(false)} onDone={() => { setCreating(false); onNotice('Meta creada') }} />
        ) : (
          <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Pressable className="btn btn-primary btn-lg full-btn" onClick={() => setCreating(true)}><Plus size={16} strokeWidth={2.6} /> Nueva meta</Pressable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GoalCard({ goal, open, onToggle, onNotice }) {
  const extras = useExtras()
  const saved = goalSaved(goal)
  const target = Number(goal.target_amount)
  const [amountText, setAmountText] = useState('')
  const [voidId, setVoidId] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const amount = parseAmountInput(amountText)

  async function run(fn, message) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onNotice(message)
      return true
    } catch (e) {
      setError(friendlyError(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="ant-card glass" style={{ '--goal-color': goal.color }}>
      <button type="button" className="goal-head" onClick={onToggle} aria-expanded={open}>
        <span className="movement-main">
          <span className="movement-title">{goal.name}</span>
          <span className="movement-detail">
            {formatMoney(Math.round(saved))} de {formatMoney(target)}{goal.deadline ? ` · para el ${formatLongDate(`${goal.deadline}T12:00:00`)}` : ''}
          </span>
        </span>
        <span className="goal-pct">{Math.min(100, Math.round((saved / target) * 100))}%</span>
      </button>
      <ProgressBar value={saved / target} label={`Avance de ${goal.name}`} />
      {saved >= target && <p className="all-square">¡Llegaste a la meta!</p>}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="installments-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={softSpring}>
            <div className="goal-body">
              <div className="code-row">
                <span className="input-wrap glass code-field">
                  <span aria-hidden="true">$</span>
                  <input inputMode="decimal" placeholder="Monto" value={amountText} onChange={(e) => setAmountText(formatAmountInput(e.target.value, amountText))} aria-label="Monto del aporte o retiro" />
                </span>
              </div>
              <div className="detail-actions">
                <Pressable className="btn btn-glass" disabled={busy || !(amount > 0)} onClick={async () => { if (await run(() => extras.addMovement(goal.id, -amount), 'Retiro anotado')) setAmountText('') }}>
                  <Minus size={14} strokeWidth={2.6} /> Retirar
                </Pressable>
                <Pressable className="btn btn-primary" disabled={busy || !(amount > 0)} onClick={async () => { if (await run(() => extras.addMovement(goal.id, amount), '¡Aporte anotado!')) setAmountText('') }}>
                  <Plus size={14} strokeWidth={2.6} /> Aportar
                </Pressable>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              {voidId ? (
                <VoidForm
                  title="¿Anular este movimiento?"
                  explanation="No se borra: queda tachado con el motivo."
                  confirmLabel="Anular"
                  reason={reason}
                  setReason={setReason}
                  busy={busy}
                  error=""
                  onCancel={() => { setVoidId(null); setReason('') }}
                  onConfirm={async () => { if (await run(() => extras.voidMovement(voidId, reason), 'Movimiento anulado')) { setVoidId(null); setReason('') } }}
                />
              ) : (
                <ul className="installment-list">
                  {goal.movements.map((m) => (
                    <li key={m.id}>
                      <button type="button" className={`installment-row ${m.status === 'voided' ? 'is-voided' : ''}`} disabled={m.status === 'voided'} onClick={() => setVoidId(m.id)} aria-label={`${Number(m.amount) > 0 ? 'Aporte' : 'Retiro'} de ${formatMoney(Math.abs(Number(m.amount)))}. Tocá para anular`}>
                        <span className="installment-month">{Number(m.amount) > 0 ? 'Aporte' : 'Retiro'} · {formatWhen(m.created_at)}</span>
                        <span className="installment-amount">{Number(m.amount) > 0 ? '+' : '−'} {formatMoney(Math.abs(Number(m.amount)))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Pressable className="btn btn-glass small-btn" disabled={busy} onClick={() => run(() => extras.archiveGoal(goal.id), 'Meta archivada')}>
                <Archive size={14} strokeWidth={2.2} /> Archivar meta
              </Pressable>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

function NewGoal({ onCancel, onDone }) {
  const extras = useExtras()
  const [name, setName] = useState('')
  const [targetText, setTargetText] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const target = parseAmountInput(targetText)
    if (!name.trim()) return setError('Ponele un nombre.')
    if (!(target > 0)) return setError('Poné cuánto querés juntar.')
    setBusy(true)
    try {
      await extras.createGoal({ name, target, deadline, color })
      onDone()
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <motion.div className="void-form glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={softSpring}>
      <p className="card-title">Nueva meta</p>
      <span className="input-wrap glass"><input value={name} maxLength={40} placeholder="Ej: Vacaciones" onChange={(e) => setName(e.target.value)} aria-label="Nombre de la meta" /></span>
      <span className="input-wrap glass"><span aria-hidden="true">$</span><input inputMode="decimal" placeholder="Objetivo" value={targetText} onChange={(e) => setTargetText(formatAmountInput(e.target.value, targetText))} aria-label="Monto objetivo" /></span>
      <label className="date-row glass"><span>Fecha límite (opcional)</span><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      <div className="swatches" role="radiogroup" aria-label="Color">
        {COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${c}`} className={`swatch ${color === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="detail-actions">
        <Pressable className="btn btn-glass" onClick={onCancel}>Cancelar</Pressable>
        <Pressable className="btn btn-primary" disabled={busy} onClick={save}>Crear meta</Pressable>
      </div>
    </motion.div>
  )
}
