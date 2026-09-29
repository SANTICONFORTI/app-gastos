import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Pause, Play, Repeat } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import PillToggle from './PillToggle'
import CategoryIcon from './CategoryIcon'
import { nextDueDate, useExtras } from '../store/ExtrasStore'
import { usePersonalStore } from '../store/PersonalStore'
import { formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { formatMoney } from '../lib/format'
import { friendlyError } from '../lib/db'
import { softSpring } from '../lib/motion'

const dayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
const money = (r) => (r.currency === 'USD' ? `US$ ${Number(r.amount).toLocaleString('es-AR')}` : formatMoney(Number(r.amount)))

export default function RecurringSheet({ open, onClose, onNotice }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="recurring-title" space="personal" tall>
      <Recurring onClose={onClose} onNotice={onNotice} />
    </Sheet>
  )
}

function Recurring({ onClose, onNotice }) {
  const extras = useExtras()
  const store = usePersonalStore()
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)

  async function toggle(r) {
    setBusyId(r.id)
    try {
      await extras.setRecurringActive(r.id, !r.active)
      onNotice(r.active ? 'Pausado: no se va a cargar más' : 'Reactivado')
    } catch (e) {
      onNotice(friendlyError(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="detail">
      <SheetHeader id="recurring-title" title="Gastos fijos" onClose={onClose} />
      <p className="muted-sm">Alquiler, expensas, suscripciones… Se cargan solos cada mes el día que elijas, y te recordamos unos días antes.</p>
      {extras.recurring.length === 0 && !creating && (
        <div className="card glass empty-card">
          <span className="coming-soon-icon glass"><Repeat size={24} strokeWidth={2} /></span>
          <p className="card-title">Sin gastos fijos todavía</p>
        </div>
      )}
      <ul className="ants-list">
        {extras.recurring.map((r) => {
          const c = store.getCategory(r.category_id)
          return (
            <li key={r.id} className={`ant-card glass ${r.active ? '' : 'is-paused'}`}>
              <div className="ant-head">
                <CategoryIcon color={c.color} Icon={c.Icon} size={38} />
                <span className="movement-main">
                  <span className="movement-title">{r.note}</span>
                  <span className="movement-detail">
                    Día {r.day_of_month} de cada mes · {r.active ? `próximo: ${dayFmt.format(nextDueDate(r)).replace(/\./g, '')}` : 'pausado'}
                  </span>
                </span>
                <span className="movement-amount">{money(r)}</span>
                <Pressable className="btn btn-glass btn-icon" aria-label={r.active ? `Pausar ${r.note}` : `Reactivar ${r.note}`} disabled={busyId === r.id} onClick={() => toggle(r)}>
                  {r.active ? <Pause size={16} strokeWidth={2.2} /> : <Play size={16} strokeWidth={2.2} />}
                </Pressable>
              </div>
            </li>
          )
        })}
      </ul>
      <AnimatePresence mode="wait" initial={false}>
        {creating ? (
          <NewRecurring key="new" onCancel={() => setCreating(false)} onDone={(count) => { setCreating(false); onNotice(count > 0 ? 'Guardado. Ya cargamos el de este mes' : 'Gasto fijo guardado') }} />
        ) : (
          <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Pressable className="btn btn-primary btn-lg full-btn" onClick={() => setCreating(true)}><Plus size={16} strokeWidth={2.6} /> Nuevo gasto fijo</Pressable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NewRecurring({ onCancel, onDone }) {
  const extras = useExtras()
  const store = usePersonalStore()
  const [note, setNote] = useState('')
  const [amountText, setAmountText] = useState('')
  const [currency, setCurrency] = useState('ARS')
  const [rateType, setRateType] = useState('tarjeta')
  const [categoryId, setCategoryId] = useState(store.categories.find((c) => c.name === 'Servicios')?.id ?? store.categories[0]?.id)
  const [day, setDay] = useState(String(new Date().getDate()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const amount = parseAmountInput(amountText)
    const d = Number(day)
    if (!note.trim()) return setError('Poné qué es (ej: Alquiler).')
    if (!(amount > 0)) return setError('Poné el monto.')
    if (!(d >= 1 && d <= 31)) return setError('El día tiene que estar entre 1 y 31.')
    setBusy(true)
    try {
      const count = await extras.createRecurring({
        note: note.trim(), amount, currency, rate_type: currency === 'USD' ? rateType : null, category_id: categoryId, day_of_month: d,
      })
      onDone(count)
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <motion.div className="void-form glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={softSpring}>
      <p className="card-title">Nuevo gasto fijo</p>
      <span className="input-wrap glass"><input value={note} maxLength={60} placeholder="Ej: Alquiler, Netflix" onChange={(e) => setNote(e.target.value)} aria-label="Qué es" /></span>
      <PillToggle label="Moneda" small options={[{ id: 'ARS', label: 'ARS' }, { id: 'USD', label: 'USD' }]} value={currency} onChange={setCurrency} layoutId="rec-currency" />
      {currency === 'USD' && (
        <PillToggle label="Tipo de dólar" small options={[{ id: 'tarjeta', label: 'Tarjeta' }, { id: 'blue', label: 'Blue' }]} value={rateType} onChange={setRateType} layoutId="rec-rate" />
      )}
      <span className="input-wrap glass"><span aria-hidden="true">{currency === 'USD' ? 'US$' : '$'}</span><input inputMode="decimal" placeholder="Monto" value={amountText} onChange={(e) => setAmountText(formatAmountInput(e.target.value, amountText))} aria-label="Monto" /></span>
      <label className="date-row glass">
        <span>Día del mes</span>
        <input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} className="day-input" />
      </label>
      <div className="guest-chips" role="radiogroup" aria-label="Categoría">
        {store.categories.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={categoryId === c.id} className={`filter-chip ${categoryId === c.id ? 'is-active' : ''}`} onClick={() => setCategoryId(c.id)}>
            <span className="legend-dot" style={{ background: c.color }} aria-hidden="true" /> {c.name}
          </button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="detail-actions">
        <Pressable className="btn btn-glass" onClick={onCancel}>Cancelar</Pressable>
        <Pressable className="btn btn-primary" disabled={busy} onClick={save}>Guardar</Pressable>
      </div>
    </motion.div>
  )
}
