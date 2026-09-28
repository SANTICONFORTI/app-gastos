import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, User, Users, Camera, Check } from 'lucide-react'
import Pressable from './Pressable'
import { CATEGORIES } from '../data/categories'
import { softSpring, spring } from '../lib/motion'

/**
 * Bottom sheet to add an expense. Choosing the destination (Personal / group)
 * recolors the whole sheet. Saving is wired up in stage 2.
 */
export default function NewExpenseSheet({ open, initialSpace, groupName, groupSize, onClose, onSave }) {
  return (
    <AnimatePresence>
      {open && (
        <SheetContent
          key="sheet"
          initialSpace={initialSpace}
          groupName={groupName}
          groupSize={groupSize}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </AnimatePresence>
  )
}

function SheetContent({ initialSpace, groupName, groupSize, onClose, onSave }) {
  const [dest, setDest] = useState(initialSpace)
  const [currency, setCurrency] = useState('ARS')
  const [category, setCategory] = useState('comida')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const isGroup = dest === 'group'

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ dest, currency, category, amount, note })
  }

  return (
    <>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet"
        data-space={dest}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <form className="sheet-inner" onSubmit={handleSubmit}>
          <div className="sheet-handle" aria-hidden="true" />

          <header className="sheet-header">
            <Pressable className="btn btn-glass btn-icon" aria-label="Cerrar" onClick={onClose}>
              <X size={18} strokeWidth={2.4} />
            </Pressable>
            <h1 id="sheet-title" className="sheet-title">Nuevo gasto</h1>
            <span className="btn-icon" aria-hidden="true" />
          </header>

          <fieldset className="dest-grid">
            <legend className="sr-only">¿Dónde se guarda?</legend>
            <DestOption
              active={!isGroup}
              onClick={() => setDest('personal')}
              color="#5AC8FA"
              iconColor="#06121F"
              Icon={User}
              title="Personal"
              subtitle="Solo vos"
            />
            <DestOption
              active={isGroup}
              onClick={() => setDest('group')}
              color="#A78BFA"
              iconColor="#14092E"
              Icon={Users}
              title={groupName}
              subtitle={`Lo ven ${groupSize}`}
            />
          </fieldset>

          <div className="amount-field">
            <div className="currency-toggle glass" role="radiogroup" aria-label="Moneda">
              {['ARS', 'USD'].map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={currency === c}
                  className={`currency-option ${currency === c ? 'is-active' : ''}`}
                  onClick={() => setCurrency(c)}
                >
                  {currency === c && <motion.span layoutId="currency-pill" className="currency-pill" transition={spring} />}
                  <span className="switcher-label">{c}</span>
                </button>
              ))}
            </div>
            <label htmlFor="amount" className="amount-label">Monto</label>
            <div className="amount-input-row">
              <span className="amount-symbol">{currency === 'USD' ? 'US$' : '$'}</span>
              <input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                className="amount-input"
                style={{ width: `${Math.max(amount.length, 1) + 0.6}ch` }}
              />
            </div>
            <span className="conversion-pill glass">
              {currency === 'USD' ? 'Conversión con dólar del día: llega en la etapa 2' : 'Podés cargar en pesos o dólares'}
            </span>
          </div>

          <fieldset className="cat-section">
            <legend className="section-label">Categoría</legend>
            <div className="cat-grid">
              {CATEGORIES.map(({ id, name, color, Icon }) => {
                const active = category === id
                return (
                  <motion.button
                    key={id}
                    type="button"
                    className={`cat-option ${active ? 'is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => setCategory(id)}
                    whileTap={{ scale: 0.9 }}
                    transition={spring}
                  >
                    <span className="cat-option-circle">
                      <Icon size={22} strokeWidth={2} color={color} />
                    </span>
                    {name}
                  </motion.button>
                )
              })}
            </div>
          </fieldset>

          <div className="note-row">
            <label htmlFor="note" className="sr-only">Nota</label>
            <input
              id="note"
              className="note-input glass"
              placeholder="Agregar una nota"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Pressable className="btn btn-glass btn-icon btn-lg-icon" aria-label="Adjuntar foto del ticket (opcional)">
              <Camera size={20} strokeWidth={2} />
            </Pressable>
          </div>
          <span className="note-hint">Foto del ticket opcional, queda como comprobante</span>

          <div className="sheet-spacer" />

          <Pressable type="submit" className="btn btn-primary sheet-save">
            <span className="sheet-save-check"><Check size={14} strokeWidth={3.2} /></span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={dest}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={softSpring}
              >
                {isGroup ? `Guardar en ${groupName}` : 'Guardar en Personal'}
              </motion.span>
            </AnimatePresence>
          </Pressable>
        </form>
      </motion.div>
    </>
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
