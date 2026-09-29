import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { User, Users, Camera, Check, CalendarDays, CreditCard, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import PillToggle from './PillToggle'
import CategoryPicker from './CategoryPicker'
import GroupSplitFields, { buildSplits, splitStateFrom } from './GroupSplitFields'
import { usePersonalStore } from '../store/PersonalStore'
import { useGroups } from '../store/GroupsStore'
import { useAuth } from '../store/AuthProvider'
import useDollarRates from '../hooks/useDollarRates'
import useReceiptUrl from '../hooks/useReceiptUrl'
import { amountToInput, formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { dateInputToIso, monthKey, monthLabelWithYear, shiftMonth, toDateInput } from '../lib/dates'
import { formatMoney } from '../lib/format'
import { splitInstallments } from '../lib/installments'
import { compressImage } from '../lib/receipts'
import { friendlyError } from '../lib/db'
import { softSpring } from '../lib/motion'

const QUICK_COUNTS = [3, 6, 12, 18, 24]
const MIN_COUNT = 2
const MAX_COUNT = 60
const round2 = (n) => Math.round(n * 100) / 100
const fmtNumber = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)

/** A group expense row (snake_case) in the shape the form uses for personal expenses. */
function fromGroupRow(row) {
  if (!row) return null
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    rateType: row.rate_type,
    exchangeRate: row.exchange_rate == null ? null : Number(row.exchange_rate),
    categoryId: row.category_id,
    note: row.note ?? '',
    spentAt: row.spent_at,
    receiptId: row.receipt_path,
  }
}

/**
 * Create or edit an expense. `expense` = edit a personal expense; `groupExpense` = edit a group one.
 * The chosen destination recolors the whole sheet.
 */
export default function ExpenseSheet({ open, expense, groupExpense, startInInstallments, initialSpace, onClose, onDone, onNotice }) {
  const groups = useGroups()
  const [dest, setDest] = useState(initialSpace)

  useEffect(() => {
    if (!open) return
    if (groupExpense) setDest('group')
    else if (expense || startInInstallments || !groups.isAdmin) setDest('personal')
    else setDest(initialSpace)
  }, [open, expense, groupExpense, startInInstallments, initialSpace, groups.isAdmin])

  return (
    <Sheet open={open} onClose={onClose} labelledBy="expense-sheet-title" space={dest} tall>
      <ExpenseForm
        expense={expense}
        groupExpense={groupExpense}
        startInInstallments={startInInstallments}
        dest={dest}
        setDest={setDest}
        onClose={onClose}
        onDone={onDone}
        onNotice={onNotice}
      />
    </Sheet>
  )
}

function ExpenseForm({ expense: personalExpense, groupExpense, startInInstallments, dest, setDest, onClose, onDone, onNotice }) {
  const store = usePersonalStore()
  const groups = useGroups()
  const { user } = useAuth()
  const rates = useDollarRates()
  const expense = personalExpense ?? fromGroupRow(groupExpense)
  const editing = Boolean(expense)
  const canUseGroup = groups.isAdmin && groups.status === 'ready'
  const defaultCategories = store.categories.filter((c) => !c.custom)

  // Group split
  const initialSplit = groupExpense ? splitStateFrom(groupExpense) : null
  const [paidBy, setPaidBy] = useState(groupExpense?.paid_by ?? user.id)
  const [participants, setParticipants] = useState(initialSplit?.participants ?? groups.activeMembers.map((m) => m.user_id))
  const [splitMode, setSplitMode] = useState(initialSplit?.mode ?? 'equal')
  const [customSplit, setCustomSplit] = useState(initialSplit?.custom ?? {})

  const [currency, setCurrency] = useState(expense?.currency ?? 'ARS')
  const [rateType, setRateType] = useState(expense?.rateType ?? 'blue')
  const [manualRate, setManualRate] = useState('')
  const [amountText, setAmountText] = useState(expense ? amountToInput(expense.amount) : '')
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? store.categories[0]?.id ?? null)
  const uploadedReceipt = useRef(null)
  const [date, setDate] = useState(toDateInput(expense?.spentAt ?? new Date()))
  const [note, setNote] = useState(expense?.note ?? '')
  const [receiptBlob, setReceiptBlob] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const existingReceiptUrl = useReceiptUrl(expense?.receiptId)

  // Installments
  const [inInstallments, setInInstallments] = useState(Boolean(startInInstallments))
  const [amountMode, setAmountMode] = useState('total')
  const [count, setCount] = useState(3)
  const [firstMonth, setFirstMonth] = useState(monthKey())
  const [card, setCard] = useState('')

  const isGroup = dest === 'group'
  const amount = parseAmountInput(amountText)
  const totalAmount = !inInstallments ? amount : amountMode === 'total' ? amount : round2(amount * count)
  const perInstallment = inInstallments && totalAmount > 0 ? splitInstallments(totalAmount, count)[0] : null

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

  // Group expenses only use the default categories, which every member can see.
  useEffect(() => {
    if (isGroup && store.categories.find((c) => c.id === categoryId)?.custom) {
      setCategoryId(defaultCategories[0]?.id ?? null)
    }
  }, [isGroup, categoryId, store.categories, defaultCategories])

  function toggleInstallments() {
    setInInstallments((on) => {
      // USD bought in installments is almost always paid with a card.
      if (!on && currency === 'USD') setRateType('tarjeta')
      return !on
    })
  }

  function changeDate(value) {
    if (!value) return
    setDate(value)
    // First installment follows the purchase month unless the user picked another one.
    if (firstMonth === monthKey(dateInputToIso(date))) setFirstMonth(monthKey(dateInputToIso(value)))
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const blob = await compressImage(file)
      setReceiptBlob(blob)
      uploadedReceipt.current = null
      setReceiptPreview(URL.createObjectURL(blob))
    } catch {
      setError('No pudimos leer esa foto. Probá con otra.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (isGroup && !canUseGroup) {
      onNotice('Solo los admins del grupo pueden cargar gastos')
      return
    }
    if (!(amount > 0)) {
      setError('Ingresá un monto mayor a cero.')
      return
    }
    if (inInstallments && !(Number.isInteger(count) && count >= MIN_COUNT && count <= MAX_COUNT)) {
      setError(`Elegí entre ${MIN_COUNT} y ${MAX_COUNT} cuotas.`)
      return
    }
    if (currency === 'USD' && !rate) {
      setError('Necesitamos la cotización del dólar para convertir el gasto.')
      return
    }
    // In installments the split divides the whole purchase; the database splits each installment.
    const splits = isGroup ? buildSplits({ amount: totalAmount, participants, mode: splitMode, custom: customSplit }) : null
    if (isGroup && !splits) {
      setError(participants.length === 0
        ? 'Elegí entre quiénes se divide el gasto.'
        : 'La división no suma el total del gasto.')
      return
    }

    setSaving(true)
    let receiptId = expense?.receiptId ?? null
    if (receiptBlob) {
      // Receipts can't be deleted: if saving fails after uploading, a retry reuses the same file.
      receiptId = uploadedReceipt.current
      if (!receiptId) {
        try {
          receiptId = isGroup
            ? await groups.uploadReceipt(groups.groupId, receiptBlob)
            : await store.uploadReceipt(receiptBlob)
          uploadedReceipt.current = receiptId
        } catch (err) {
          setSaving(false)
          setError(`No pudimos subir la foto del ticket. ${friendlyError(err)}`)
          return
        }
      }
    }

    try {
      await save(receiptId, splits)
    } catch (err) {
      setSaving(false)
      setError(friendlyError(err))
    }
  }

  async function save(receiptId, splits) {
    if (isGroup && inInstallments) {
      await groups.addInstallmentPlan(groups.groupId, {
        paidBy,
        totalAmount,
        installmentCount: count,
        firstMonth,
        purchasedAt: dateInputToIso(date),
        currency,
        exchangeRate: rate,
        rateType: currency === 'USD' ? rateType : null,
        categoryId,
        note: note.trim(),
        card: card.trim(),
        receiptPath: receiptId,
        splits,
      })
      onDone(`Compra en ${count} cuotas cargada en ${groups.selected.group.name}`)
      return
    }
    if (isGroup) {
      await groups.saveExpense(groups.groupId, {
        id: groupExpense?.id,
        paidBy,
        amount,
        currency,
        exchangeRate: rate,
        rateType: currency === 'USD' ? rateType : null,
        categoryId,
        note: note.trim(),
        spentAt: editing && toDateInput(expense.spentAt) === date
          ? expense.spentAt
          : dateInputToIso(date, editing ? expense.spentAt : new Date()),
        receiptPath: receiptId,
        splits,
      })
      onDone(editing ? 'Cambios guardados en el grupo' : `Gasto cargado en ${groups.selected.group.name}`)
      return
    }

    const common = {
      currency,
      exchangeRate: rate,
      rateType: currency === 'USD' ? rateType : null,
      categoryId,
      note: note.trim(),
      receiptId,
    }

    if (inInstallments) {
      await store.addInstallmentPlan({
        ...common,
        totalAmount,
        installmentCount: count,
        firstMonth,
        card: card.trim(),
        purchasedAt: dateInputToIso(date),
      })
      onDone(`Compra en ${count} cuotas guardada`)
      return
    }

    const data = {
      ...common,
      amount,
      spentAt: editing && toDateInput(expense.spentAt) === date
        ? expense.spentAt
        : dateInputToIso(date, editing ? expense.spentAt : new Date()),
    }
    if (editing) {
      const changed = await store.editExpense(expense.id, data)
      onDone(changed ? 'Cambios guardados' : 'No hubo cambios')
    } else {
      await store.addExpense(data)
      onDone('Gasto guardado')
    }
  }

  const symbol = currency === 'USD' ? 'US$' : '$'
  let conversion
  if (inInstallments) {
    const base = totalAmount > 0
      ? `${count} cuotas de ${symbol} ${fmtNumber(perInstallment)} · total ${symbol} ${fmtNumber(totalAmount)}`
      : `Se reparte en ${count} cuotas, una por mes`
    conversion = currency === 'USD' && rate && totalAmount > 0
      ? `${base} (≈ ${formatMoney(perInstallment * rate)} por cuota)`
      : base
  } else if (currency === 'USD') {
    conversion = rate
      ? `≈ ${formatMoney(amount > 0 ? amount * rate : 0)} · ${rateType} a ${formatMoney(rate)}${keepsSavedRate ? ' (guardada)' : ''}`
      : rates.status === 'loading' ? 'Buscando cotización…' : 'Sin conexión: cargá la cotización a mano'
  } else {
    const blue = rates.quote('blue')
    conversion = blue && amount > 0
      ? `≈ US$ ${fmtNumber(amount / blue)} al dólar blue`
      : 'Podés cargar en pesos o dólares'
  }

  const receiptThumb = receiptPreview ?? existingReceiptUrl
  const amountLabel = !inInstallments ? 'Monto' : amountMode === 'total' ? 'Monto total' : 'Valor de cada cuota'
  const showInstallmentOption = !editing

  return (
    <form className="expense-form" onSubmit={handleSubmit} noValidate>
      <SheetHeader id="expense-sheet-title" title={editing ? 'Editar gasto' : 'Nuevo gasto'} onClose={onClose} />

      {!editing && (
        <fieldset className="dest-grid">
          <legend className="sr-only">¿Dónde se guarda?</legend>
          <DestOption active={!isGroup} onClick={() => setDest('personal')} color="#5AC8FA" iconColor="#06121F" Icon={User} title="Personal" subtitle="Solo vos" />
          <DestOption
            active={isGroup}
            disabled={!canUseGroup}
            onClick={() => (canUseGroup ? setDest('group') : onNotice(groups.selected ? 'Solo los admins del grupo pueden cargar gastos' : 'Primero creá o unite a un grupo'))}
            color="#A78BFA"
            iconColor="#14092E"
            Icon={Users}
            title={groups.selected?.group.name ?? 'Grupo'}
            subtitle={canUseGroup ? `Lo ven ${groups.activeMembers.length}` : groups.selected ? 'Solo admins' : 'Sin grupos'}
          />
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
        <label htmlFor="amount" className="amount-label">{amountLabel}</label>
        <div className="amount-input-row">
          <span className="amount-symbol">{symbol}</span>
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

      <AnimatePresence initial={false}>
        {isGroup && canUseGroup && (
          <motion.div
            key="split"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={softSpring}
            className="split-wrap"
          >
            <GroupSplitFields
              members={groups.activeMembers}
              amount={totalAmount}
              installments={inInstallments ? count : null}
              currency={currency}
              paidBy={paidBy}
              setPaidBy={setPaidBy}
              participants={participants}
              setParticipants={setParticipants}
              mode={splitMode}
              setMode={setSplitMode}
              custom={customSplit}
              setCustom={setCustomSplit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showInstallmentOption && (
        <div className="installments-box glass">
          <button
            type="button"
            role="switch"
            aria-checked={inInstallments}
            className="switch-row"
            onClick={toggleInstallments}
          >
            <CreditCard size={18} strokeWidth={2} aria-hidden="true" />
            <span className="switch-label">En cuotas</span>
            <span className={`switch ${inInstallments ? 'is-on' : ''}`} aria-hidden="true">
              <motion.span className="switch-knob" layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
            </span>
          </button>

          <AnimatePresence initial={false}>
            {inInstallments && (
              <motion.div
                className="installments-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={softSpring}
              >
                <div className="installments-inner">
                  <PillToggle
                    label="El monto que cargaste es"
                    small
                    options={[{ id: 'total', label: 'Total' }, { id: 'installment', label: 'Por cuota' }]}
                    value={amountMode}
                    onChange={setAmountMode}
                    layoutId="amount-mode-pill"
                  />

                  <div className="count-row">
                    <span className="field-label" id="count-label">Cuotas</span>
                    <div className="stepper" role="group" aria-labelledby="count-label">
                      <Pressable
                        className="btn btn-glass btn-icon"
                        aria-label="Una cuota menos"
                        disabled={count <= MIN_COUNT}
                        onClick={() => setCount((c) => Math.max(MIN_COUNT, c - 1))}
                      >
                        <Minus size={16} strokeWidth={2.4} />
                      </Pressable>
                      <span className="stepper-value" aria-live="polite">{count}</span>
                      <Pressable
                        className="btn btn-glass btn-icon"
                        aria-label="Una cuota más"
                        disabled={count >= MAX_COUNT}
                        onClick={() => setCount((c) => Math.min(MAX_COUNT, c + 1))}
                      >
                        <Plus size={16} strokeWidth={2.4} />
                      </Pressable>
                    </div>
                  </div>
                  <div className="quick-counts">
                    {QUICK_COUNTS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`filter-chip ${count === n ? 'is-active' : ''}`}
                        aria-pressed={count === n}
                        onClick={() => setCount(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <div className="count-row">
                    <span className="field-label" id="first-month-label">Primera cuota</span>
                    <div className="stepper" role="group" aria-labelledby="first-month-label">
                      <Pressable className="btn btn-glass btn-icon" aria-label="Mes anterior" onClick={() => setFirstMonth((m) => shiftMonth(m, -1))}>
                        <ChevronLeft size={18} strokeWidth={2.4} />
                      </Pressable>
                      <span className="stepper-value month-value" aria-live="polite">{monthLabelWithYear(firstMonth)}</span>
                      <Pressable className="btn btn-glass btn-icon" aria-label="Mes siguiente" onClick={() => setFirstMonth((m) => shiftMonth(m, 1))}>
                        <ChevronRight size={18} strokeWidth={2.4} />
                      </Pressable>
                    </div>
                  </div>

                  <label className="sr-only" htmlFor="card">Tarjeta (opcional)</label>
                  <input
                    id="card"
                    className="note-input glass"
                    placeholder="Tarjeta (opcional, ej: Visa Galicia)"
                    maxLength={30}
                    list="known-cards"
                    value={card}
                    onChange={(e) => setCard(e.target.value)}
                  />
                  <datalist id="known-cards">
                    {store.cards.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <label className="date-row glass">
        <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
        <span>{inInstallments ? 'Fecha de compra' : 'Fecha'}</span>
        <input
          type="date"
          value={date}
          max={toDateInput(new Date(new Date().getFullYear() + 1, 11, 31))}
          onChange={(e) => changeDate(e.target.value)}
        />
      </label>

      <CategoryPicker value={categoryId} onChange={setCategoryId} defaultsOnly={isGroup} />

      <div className="note-row">
        <label htmlFor="note" className="sr-only">{inInstallments ? 'Qué compraste' : 'Nota'}</label>
        <input
          id="note"
          className="note-input glass"
          placeholder={inInstallments ? '¿Qué compraste? (ej: Heladera)' : 'Agregar una nota (ej: Coto, Netflix)'}
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
            key={`${dest}-${editing}-${inInstallments}-${saving}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={softSpring}
          >
            {saving
              ? 'Guardando…'
              : editing
              ? 'Guardar cambios'
              : isGroup
                ? `Guardar en ${groups.selected?.group.name ?? 'el grupo'}`
                : inInstallments ? `Guardar en ${count} cuotas` : 'Guardar en Personal'}
          </motion.span>
        </AnimatePresence>
      </Pressable>
    </form>
  )
}

function DestOption({ active, disabled = false, onClick, color, iconColor, Icon, title, subtitle }) {
  return (
    <Pressable
      className={`dest-option ${active ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
      aria-pressed={active}
      aria-disabled={disabled}
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
