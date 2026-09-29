import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bug, TrendingUp, TrendingDown, Settings2, Minus, Plus, Sparkles } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import Amount from './Amount'
import CategoryIcon from './CategoryIcon'
import { usePersonalStore } from '../store/PersonalStore'
import useDollarRates from '../hooks/useDollarRates'
import { detectAnts, equivalenceFor, readAntSettings, saveAntSettings } from '../lib/ants'
import { totalsByCategory } from '../lib/expenses'
import { monthKey, monthName, shiftMonth } from '../lib/dates'
import { amountToInput, formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { formatMoney } from '../lib/format'
import { listContainer, listItem, softSpring } from '../lib/motion'

const pct = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}%`

export default function AntsSheet({ open, month, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="ants-title" space="personal" tall>
      <Ants month={month} onClose={onClose} />
    </Sheet>
  )
}

/** Ants of a month with the saved settings (the sheet keeps its own copy to re-render after changes). */
export function useAnts(month) {
  const store = usePersonalStore()
  const [settings, setSettings] = useState(readAntSettings)
  const ants = detectAnts(store.expenses, month, settings, store.getCategory)
  return { ants, settings, setSettings }
}

/** Same, reading the settings fresh every render (for the home chip). */
export function antsOfMonth(store, month) {
  return detectAnts(store.expenses, month, readAntSettings(), store.getCategory)
}

function Ants({ month, onClose }) {
  const store = usePersonalStore()
  const rates = useDollarRates()
  const { ants, settings, setSettings } = useAnts(month)
  const [editing, setEditing] = useState(false)
  const inProgress = month === monthKey()
  const total = ants.reduce((s, a) => s + a.total, 0)
  const yearly = ants.reduce((s, a) => s + a.yearly, 0)
  const grew = ants.filter((a) => a.growth !== null && a.growth >= 10).sort((a, b) => b.growth - a.growth)[0]
  const context = {
    plans: store.plans,
    installmentsOf: store.installmentsOf,
    categoryTotals: totalsByCategory(store.expenses, month),
    getCategory: store.getCategory,
    blueRate: rates.quote('blue'),
  }

  return (
    <div className="detail">
      <SheetHeader id="ants-title" title="Gastos hormiga" onClose={onClose} />

      <section className="detail-hero">
        <span className="muted-sm">Gastos chicos que se repiten · {monthName(month)}</span>
        <Amount value={total} className="detail-amount" />
        {ants.length > 0 && (
          <span className="ants-yearly">
            {inProgress ? 'A este ritmo' : 'Si todos los meses fueran así'}, son <strong>{formatMoney(Math.round(yearly))}</strong> al año
          </span>
        )}
      </section>

      {grew && (
        <div className="ants-highlight" role="note">
          <TrendingUp size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>Lo que más creció: <strong>{grew.label}</strong>, {pct(grew.growth)} contra {monthName(shiftMonth(month, -1))}.</span>
        </div>
      )}

      {ants.length === 0 ? (
        <div className="card glass empty-card">
          <span className="coming-soon-icon glass"><Sparkles size={24} strokeWidth={2} /></span>
          <p className="card-title">¡Nada de hormigas en {monthName(month)}!</p>
          <p className="muted-sm">
            No hay gastos de hasta {formatMoney(settings.maxAmount)} que se repitan {settings.minCount} veces o más.
            Tip: ponele una nota al gasto (ej: “Café”) para que los reconozcamos por comercio.
          </p>
        </div>
      ) : (
        <motion.ul className="ants-list" variants={listContainer} initial="hidden" animate="show">
          {ants.map((a) => {
            const category = store.getCategory(a.categoryId)
            const equivalence = equivalenceFor(a, context)
            return (
              <motion.li key={a.key} variants={listItem} className="ant-card glass">
                <div className="ant-head">
                  <CategoryIcon color={category.color} Icon={a.byCategory ? category.Icon : Bug} size={42} />
                  <span className="movement-main">
                    <span className="movement-title">{a.label}</span>
                    <span className="movement-detail">
                      {a.count} {a.count === 1 ? 'vez' : 'veces'} · promedio {formatMoney(Math.round(a.average))}
                    </span>
                  </span>
                  <span className="movement-side">
                    <span className="movement-amount">{formatMoney(Math.round(a.total))}</span>
                    {a.growth !== null && Math.abs(a.growth) >= 1 && (
                      <span className={`change-badge ${a.growth > 0 ? 'is-up' : 'is-down'}`}>
                        {a.growth > 0 ? <TrendingUp size={12} strokeWidth={2.4} aria-hidden="true" /> : <TrendingDown size={12} strokeWidth={2.4} aria-hidden="true" />}
                        {pct(a.growth)}
                      </span>
                    )}
                    {a.growth === null && <span className="muted-sm">nuevo</span>}
                  </span>
                </div>
                <p className="ant-line">
                  {inProgress ? 'A este ritmo son ' : 'Así, en un año serían '}
                  <strong>{formatMoney(Math.round(a.yearly))} al año</strong>.
                </p>
                {equivalence && <p className="muted-sm">{equivalence}</p>}
              </motion.li>
            )
          })}
        </motion.ul>
      )}

      <p className="muted-sm detail-note">
        Sin inteligencia artificial: Puly agrupa por la nota del gasto (el comercio) o, si no tiene nota, por categoría.
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <AntSettings
            key="settings"
            settings={settings}
            onCancel={() => setEditing(false)}
            onSave={(next) => {
              saveAntSettings(next)
              setSettings(next)
              setEditing(false)
            }}
          />
        ) : (
          <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Pressable className="btn btn-glass btn-lg full-btn" onClick={() => setEditing(true)}>
              <Settings2 size={16} strokeWidth={2.2} /> Ajustar: hasta {formatMoney(settings.maxAmount)} · {settings.minCount}+ veces
            </Pressable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AntSettings({ settings, onCancel, onSave }) {
  const [maxText, setMaxText] = useState(amountToInput(settings.maxAmount))
  const [minCount, setMinCount] = useState(settings.minCount)
  const max = parseAmountInput(maxText)

  return (
    <motion.div className="void-form glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={softSpring}>
      <p className="card-title">¿Qué cuenta como gasto hormiga?</p>
      <label className="field">
        <span className="field-label">Gastos de hasta</span>
        <span className="input-wrap glass">
          <span aria-hidden="true">$</span>
          <input inputMode="decimal" value={maxText} onChange={(e) => setMaxText(formatAmountInput(e.target.value, maxText))} />
        </span>
      </label>
      <div className="count-row">
        <span className="field-label" id="ants-min-label">Que se repitan al menos</span>
        <div className="stepper" role="group" aria-labelledby="ants-min-label">
          <Pressable className="btn btn-glass btn-icon" aria-label="Menos veces" disabled={minCount <= 2} onClick={() => setMinCount((c) => c - 1)}>
            <Minus size={16} strokeWidth={2.4} />
          </Pressable>
          <span className="stepper-value">{minCount}</span>
          <Pressable className="btn btn-glass btn-icon" aria-label="Más veces" disabled={minCount >= 10} onClick={() => setMinCount((c) => c + 1)}>
            <Plus size={16} strokeWidth={2.4} />
          </Pressable>
        </div>
      </div>
      <div className="detail-actions">
        <Pressable className="btn btn-glass" onClick={onCancel}>Cancelar</Pressable>
        <Pressable className="btn btn-primary" disabled={!(max > 0)} onClick={() => onSave({ maxAmount: max, minCount })}>Guardar</Pressable>
      </div>
    </motion.div>
  )
}
