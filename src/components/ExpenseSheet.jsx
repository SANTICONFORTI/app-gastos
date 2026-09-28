import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { User, Users, Camera, Check, Plus, CalendarDays } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import { usePersonalStore } from '../store/PersonalStore'
import useDollarRates from '../hooks/useDollarRates'
import useReceiptUrl from '../hooks/useReceiptUrl'
import { amountToInput, formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { dateInputToIso, toDateInput } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { compressImage, saveReceipt } from '../lib/receipts'
import { newId } from '../lib/id'
import { softSpring, spring } from '../lib/motion'

const CUSTOM_COLORS = ['#38BDF8', '#F472B6', '#34D399', '#FBBF24', '#A3E635', '#FB923C', '#C084FC', '#94A3B8']

/**
 * Create or edit an expense. `expense` given = edit mode (personal only).
 * The chosen destination recolors the whole sheet.
 */
export default function ExpenseSheet({ open, expense, initialSpace, groupName, groupSize, onClose, onDone, onNotice }) {
  const [dest, setDest] = useState(initialSpace)

  useEffect(() => {
    if (open) setDest(expense ? 'personal' : initialSpace)
  }, [open, expense, initialSpace])

  return (
    <Sheet open={open} onClose={onClose} labelledBy="expense-sheet-title" space={dest} tall>
      <ExpenseForm
        expense={expense}
        dest={dest}
        setDest={setDest}
        groupName={groupName}
        groupSize={groupSize}
        onClose={onClose}
        onDone={onDone}
        onNotice={onNotice}
      />
    </Sheet>
  )
}

function ExpenseForm({ expense, dest, setDest, groupName, groupSize, onClose, onDone, onNotice }) {
  const store = usePersonalStore()
  const rates = useDollarRates()
  const editing = Boolean(expense)

  const [currency, setCurrency] = useState(expense?.currency ?? 'ARS')
  const [rateType, setRateType] = useState(expense?.rateType ?? 'blue')
  const [manualRate, setManualRate] = useState('')
  const [amountText, setAmountText] = useState(expense ? amountToInput(expense.amount) : '')
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? 'comida')
  const [date, setDate] = useState(toDateInput(expense?.spentAt ?? new Date()))
  const [note, setNote] = useState(expense?.note ?? '')
  const [receiptBlob, setReceiptBlob] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const fileRef = useRef(null)
  const existingReceiptUrl = useReceiptUrl(expense?.receiptId)

  const isGroup = dest === 'group'
  const amount = parseAmountInput(amountText)

  // Keep the quote saved with the expense unless the currency or quote type changes.
  const keepsSavedRate = editing && expense.currency === 'USD' && currency === 'USD' && expense.rateType === rateType
  const liveRate = rates.quote(rateType)
  const manualRateValue = parseAmountInput(manualRate)
  const rate = currency !== 'USD'
    ? null
    : keepsSavedRate
      ? expense.exchangeRate
      : liveRate ?? (manualRateValue > 0 ? manualRateValue : null)
  const needsManualRate = currency === 'USD' && !keepsSavedRate && liveRate == null

  useEffect(() => () => receiptPreview && URL.revokeObjectURL(receiptPreview), [receiptPreview])

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const blob = await compressImage(file)
      setReceiptBlob(blob)
      setReceiptPreview(URL.createObjectURL(blob))
    } catch {
      setError('No pudimos leer esa foto. Probá con otra.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (isGroup) {
      onNotice('Los gastos de grupo llegan en la etapa 6')
      return
    }
    if (!(amount > 0)) {
      setError('Ingresá un monto mayor a cero.')
      return
    }
    if (currency === 'USD' && !rate) {
      setError('Necesitamos la cotización del dólar para convertir el gasto.')
      return
    }

    setSaving(true)
    let receiptId = expense?.receiptId ?? null
    if (receiptBlob) {
      try {
        receiptId = newId()
        await saveReceipt(receiptId, receiptBlob)
      } catch {
        setSaving(false)
        setError('No pudimos guardar la foto del ticket. Probá de nuevo.')
        return
      }
    }

    const data = {
      amount,
      currency,
      exchangeRate: rate,
      rateType: currency === 'USD' ? rateType : null,
      categoryId,
      note: note.trim(),
      receiptId,
      spentAt: editing && toDateInput(expense.spentAt) === date
        ? expense.spentAt
        : dateInputToIso(date, editing ? expense.spentAt : new Date()),
    }

    if (editing) {
      const changed = store.editExpense(expense.id, data)
      onDone(changed ? 'Cambios guardados' : 'No hubo cambios')
    } else {
      store.addExpense(data)
      onDone('Gasto guardado')
    }
  }

  let conversion
  if (currency === 'USD') {
    conversion = rate
      ? `≈ ${formatMoney(amount > 0 ? amount * rate : 0)} · ${rateType} a ${formatMoney(rate)}${keepsSavedRate ? ' (guardada)' : ''}`
      : rates.status === 'loading' ? 'Buscando cotización…' : 'Sin conexión: cargá la cotización a mano'
  } else {
    const blue = rates.quote('blue')
    conversion = blue && amount > 0
      ? `≈ US$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount / blue)} al dólar blue`
      : 'Podés cargar en pesos o dólares'
  }

  const receiptThumb = receiptPreview ?? existingReceiptUrl
  const title = editing ? 'Editar gasto' : 'Nuevo gasto'

  return (
    <form className="expense-form" onSubmit={handleSubmit} noValidate>
      <SheetHeader id="expense-sheet-title" title={title} onClose={onClose} />

      {!editing && (
        <fieldset className="dest-grid">
          <legend className="sr-only">¿Dónde se guarda?</legend>
          <DestOption active={!isGroup} onClick={() => setDest('personal')} color="#5AC8FA" iconColor="#06121F" Icon={User} title="Personal" subtitle="Solo vos" />
          <DestOption active={isGroup} onClick={() => setDest('group')} color="#A78BFA" iconColor="#14092E" Icon={Users} title={groupName} subtitle={`Lo ven ${groupSize}`} />
        </fieldset>
      )}

      <div className="amount-field">
        <PillToggle
          label="Moneda"
          options={[{ id: 'ARS', label: 'ARS' }, { id: 'USD', label: 'USD' }]}
          value={currency}
          onChange={setCurrency}
          layoutId="currency-pill"
        />
        <label htmlFor="amount" className="amount-label">Monto</label>
        <div className="amount-input-row">
          <span className="amount-symbol">{currency === 'USD' ? 'US$' : '$'}</span>
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmountText(formatAmountInput(e.target.value, amountText))}
            className="amount-input"
            style={{ width: `${Math.max(amountText.length, 1) + 0.6}ch` }}
            aria-invalid={Boolean(error) && !(amount > 0)}
          />
        </div>

        <AnimatePresence initial={false}>
          {currency === 'USD' && (
            <motion.div
              className="rate-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={softSpring}
            >
              <PillToggle
                label="Tipo de dólar"
                small
                options={[{ id: 'blue', label: 'Blue' }, { id: 'tarjeta', label: 'Tarjeta' }]}
                value={rateType}
                onChange={setRateType}
                layoutId="rate-pill"
              />
              {needsManualRate && rates.status !== 'loading' && (
                <label className="manual-rate glass">
                  <span>Cotización $</span>
                  <input
                    inputMode="decimal"
                    placeholder="0"
                    value={manualRate}
                    onChange={(e) => setManualRate(formatAmountInput(e.target.value, manualRate))}
                    aria-label="Cotización manual en pesos por dólar"
                  />
                </label>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <span className="conversion-pill glass" aria-live="polite">{conversion}</span>
      </div>

      <label className="date-row glass">
        <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
        <span>Fecha</span>
        <input
          type="date"
          value={date}
          max={toDateInput(new Date(new Date().getFullYear() + 1, 11, 31))}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </label>

      <fieldset className="cat-section">
        <legend className="section-label">Categoría</legend>
        <div className="cat-grid">
          {store.categories.map(({ id, name, color, Icon }) => {
            const active = categoryId === id
            return (
              <motion.button
                key={id}
                type="button"
                className={`cat-option ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => setCategoryId(id)}
                whileTap={{ scale: 0.9 }}
                transition={spring}
              >
                <span className="cat-option-circle">
                  <Icon size={22} strokeWidth={2} color={color} />
                </span>
                <span className="cat-option-name">{name}</span>
              </motion.button>
            )
          })}
          <motion.button
            type="button"
            className="cat-option"
            onClick={() => setCreatingCategory((v) => !v)}
            aria-expanded={creatingCategory}
            whileTap={{ scale: 0.9 }}
            transition={spring}
          >
            <span className="cat-option-circle cat-option-new"><Plus size={22} strokeWidth={2} /></span>
            <span className="cat-option-name">Nueva</span>
          </motion.button>
        </div>
        <AnimatePresence initial={false}>
          {creatingCategory && (
            <CategoryCreator
              onCancel={() => setCreatingCategory(false)}
              onCreate={({ name, color }) => {
                const exists = store.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
                if (exists) return 'Ya tenés una categoría con ese nombre.'
                const created = store.addCategory({ name, color })
                setCategoryId(created.id)
                setCreatingCategory(false)
                return null
              }}
            />
          )}
        </AnimatePresence>
      </fieldset>

      <div className="note-row">
        <label htmlFor="note" className="sr-only">Nota</label>
        <input
          id="note"
          className="note-input glass"
          placeholder="Agregar una nota (ej: Coto, Netflix)"
          maxLength={80}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {receiptThumb ? (
          <span className="receipt-thumb" title="Ticket adjunto">
            <img src={receiptThumb} alt="Foto del ticket adjunta" />
          </span>
        ) : (
          <Pressable
            className="btn btn-glass btn-icon btn-lg-icon"
            aria-label="Adjuntar foto del ticket (opcional)"
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={20} strokeWidth={2} />
          </Pressable>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
      </div>
      <span className="note-hint">
        {receiptThumb
          ? 'Ticket adjunto. Queda como comprobante y no se puede reemplazar.'
          : 'Foto del ticket opcional, queda como comprobante'}
      </span>

      <div className="sheet-spacer" />

      <AnimatePresence>
        {error && (
          <motion.p
            className="form-error"
            role="alert"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Pressable type="submit" className="btn btn-primary sheet-save" disabled={saving}>
        <span className="sheet-save-check"><Check size={14} strokeWidth={3.2} /></span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${dest}-${editing}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={softSpring}
          >
            {editing ? 'Guardar cambios' : isGroup ? `Guardar en ${groupName}` : 'Guardar en Personal'}
          </motion.span>
        </AnimatePresence>
      </Pressable>
    </form>
  )
}

function PillToggle({ label, options, value, onChange, layoutId, small = false }) {
  return (
    <div className={`currency-toggle glass ${small ? 'is-small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`currency-option ${value === o.id ? 'is-active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {value === o.id && <motion.span layoutId={layoutId} className="currency-pill" transition={spring} />}
          <span className="switcher-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function CategoryCreator({ onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CUSTOM_COLORS[0])
  const [error, setError] = useState('')

  function create() {
    if (!name.trim()) {
      setError('Ponele un nombre.')
      return
    }
    const problem = onCreate({ name, color })
    if (problem) setError(problem)
  }

  return (
    <motion.div
      className="cat-creator glass"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={softSpring}
    >
      <div className="cat-creator-inner">
        <label htmlFor="new-cat-name" className="sr-only">Nombre de la categoría</label>
        <input
          id="new-cat-name"
          className="note-input glass"
          placeholder="Nombre (ej: Mascotas)"
          maxLength={20}
          value={name}
          autoFocus
          onChange={(e) => { setName(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }}
        />
        <div className="swatches" role="radiogroup" aria-label="Color">
          {CUSTOM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              className={`swatch ${color === c ? 'is-active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="cat-creator-actions">
          <Pressable className="btn btn-glass" onClick={onCancel}>Cancelar</Pressable>
          <Pressable className="btn btn-primary" onClick={create}>Crear categoría</Pressable>
        </div>
      </div>
    </motion.div>
  )
}

function DestOption({ active, onClick, color, iconColor, Icon, title, subtitle }) {
  return (
    <Pressable
      className={`dest-option ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
      style={{ '--dest-color': color }}
    >
      <span className="dest-icon" style={{ background: color, color: iconColor }}>
        <Icon size={18} strokeWidth={2.3} />
      </span>
      <span className="dest-text">
        <span>{title}</span>
        <span className="dest-sub">{subtitle}</span>
      </span>
    </Pressable>
  )
}
