import { useState } from 'react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import ProgressBar from './ProgressBar'
import CategoryIcon from './CategoryIcon'
import { useExtras } from '../store/ExtrasStore'
import { usePersonalStore } from '../store/PersonalStore'
import { totalsByCategory } from '../lib/expenses'
import { monthKey, monthName } from '../lib/dates'
import { amountToInput, formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { formatMoney } from '../lib/format'
import { friendlyError } from '../lib/db'

export const NEAR = 0.8

/** Budgets of the current month: spent vs limit per category. */
export function budgetStatus(store, budgets, month = monthKey()) {
  const spent = Object.fromEntries(totalsByCategory(store.expenses, month).map((t) => [t.categoryId, t.amount]))
  return budgets.map((b) => {
    const used = spent[b.category_id] ?? 0
    const limit = Number(b.monthly_limit)
    return { ...b, used, limit, ratio: used / limit, state: used > limit ? 'over' : used >= limit * NEAR ? 'near' : 'ok' }
  })
}

export default function BudgetsSheet({ open, onClose, onNotice }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="budgets-title" space="personal" tall>
      <Budgets onClose={onClose} onNotice={onNotice} />
    </Sheet>
  )
}

function Budgets({ onClose, onNotice }) {
  const store = usePersonalStore()
  const extras = useExtras()
  const [editing, setEditing] = useState(null)
  const [limitText, setLimitText] = useState('')
  const [busy, setBusy] = useState(false)
  const status = Object.fromEntries(budgetStatus(store, extras.budgets).map((b) => [b.category_id, b]))

  async function save(categoryId, limit) {
    setBusy(true)
    try {
      await extras.setBudget(categoryId, limit)
      onNotice(limit > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado')
      setEditing(null)
    } catch (e) {
      onNotice(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="detail">
      <SheetHeader id="budgets-title" title="Presupuestos" onClose={onClose} />
      <p className="muted-sm">Poné un tope por categoría para {monthName(monthKey())} y los que vienen. Te avisamos al llegar al 80%.</p>
      <ul className="ants-list">
        {store.categories.map((c) => {
          const b = status[c.id]
          return (
            <li key={c.id} className="ant-card glass">
              <div className="ant-head">
                <CategoryIcon color={c.color} Icon={c.Icon} size={38} />
                <span className="movement-main">
                  <span className="movement-title">{c.name}</span>
                  <span className={`movement-detail budget-${b?.state ?? 'none'}`}>
                    {b ? `${formatMoney(Math.round(b.used))} de ${formatMoney(b.limit)}${b.state === 'over' ? ' · ¡te pasaste!' : b.state === 'near' ? ' · cerca del tope' : ''}` : 'Sin presupuesto'}
                  </span>
                </span>
                <Pressable className="btn btn-glass small-btn" onClick={() => { setEditing(c.id); setLimitText(b ? amountToInput(b.limit) : '') }}>
                  {b ? 'Cambiar' : 'Poner tope'}
                </Pressable>
              </div>
              {b && <ProgressBar value={Math.min(1, b.ratio)} label={`${c.name}: ${Math.round(b.ratio * 100)}% del presupuesto`} />}
              {editing === c.id && (
                <div className="code-row">
                  <span className="input-wrap glass code-field">
                    <span aria-hidden="true">$</span>
                    <input inputMode="decimal" autoFocus placeholder="Tope mensual" value={limitText} onChange={(e) => setLimitText(formatAmountInput(e.target.value, limitText))} aria-label={`Tope mensual de ${c.name}`} />
                  </span>
                  {b && <Pressable className="btn btn-glass" disabled={busy} onClick={() => save(c.id, 0)}>Quitar</Pressable>}
                  <Pressable className="btn btn-primary" disabled={busy || !(parseAmountInput(limitText) > 0)} onClick={() => save(c.id, parseAmountInput(limitText))}>Guardar</Pressable>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
