import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Tag } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import { newId } from '../lib/id'

// Personal expenses, stored in this browser until stage 5 moves them to Supabase.
// Field names mirror the `expenses` / `expense_history` tables to ease that migration.
// Nothing is deleted: expenses are voided, and every change is recorded in history.

const STORAGE_KEY = 'gastos:personal:v1'

/** Fields the user can change; history records before/after of these. */
export const TRACKED_FIELDS = ['amount', 'currency', 'exchangeRate', 'rateType', 'categoryId', 'note', 'spentAt', 'receiptId']

const empty = { expenses: [], history: [], categories: [] }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k] ?? null]))

const PersonalContext = createContext(null)

export function PersonalStoreProvider({ children }) {
  const [state, setState] = useState(load)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [state])

  const addExpense = useCallback((data) => {
    const now = new Date().toISOString()
    const expense = {
      id: newId(),
      ...pick(data, TRACKED_FIELDS),
      status: 'active',
      voidedAt: null,
      voidReason: null,
      createdAt: now,
      updatedAt: null,
    }
    setState((s) => ({
      ...s,
      expenses: [...s.expenses, expense],
      history: [...s.history, { id: newId(), expenseId: expense.id, action: 'created', changedAt: now, before: null, after: pick(expense, TRACKED_FIELDS) }],
    }))
    return expense
  }, [])

  /** Returns false if nothing changed. Voided expenses can't be edited. */
  const editExpense = useCallback((id, changes) => {
    const current = state.expenses.find((e) => e.id === id)
    if (!current || current.status !== 'active') return false
    const changedKeys = TRACKED_FIELDS.filter((k) => k in changes && (changes[k] ?? null) !== (current[k] ?? null))
    if (changedKeys.length === 0) return false
    const now = new Date().toISOString()
    const before = pick(current, changedKeys)
    const after = pick(changes, changedKeys)
    setState((s) => ({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...after, updatedAt: now } : e)),
      history: [...s.history, { id: newId(), expenseId: id, action: 'edited', changedAt: now, before, after }],
    }))
    return true
  }, [state.expenses])

  const voidExpense = useCallback((id, reason) => {
    const trimmed = reason.trim()
    if (!trimmed) throw new Error('El motivo es obligatorio')
    const now = new Date().toISOString()
    setState((s) => ({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id && e.status === 'active'
        ? { ...e, status: 'voided', voidedAt: now, voidReason: trimmed }
        : e)),
      history: [...s.history, { id: newId(), expenseId: id, action: 'voided', changedAt: now, before: { status: 'active' }, after: { status: 'voided', voidReason: trimmed } }],
    }))
  }, [])

  const addCategory = useCallback(({ name, color }) => {
    const category = { id: `custom-${newId()}`, name: name.trim(), color }
    setState((s) => ({ ...s, categories: [...s.categories, category] }))
    return category
  }, [])

  const value = useMemo(() => {
    const categories = [...CATEGORIES, ...state.categories.map((c) => ({ ...c, Icon: Tag, custom: true }))]
    const byId = Object.fromEntries(categories.map((c) => [c.id, c]))
    return {
      expenses: state.expenses,
      history: state.history,
      categories,
      getCategory: (id) => byId[id] ?? byId.otros,
      historyOf: (expenseId) => state.history.filter((h) => h.expenseId === expenseId),
      addExpense,
      editExpense,
      voidExpense,
      addCategory,
      saveError,
    }
  }, [state, addExpense, editExpense, voidExpense, addCategory, saveError])

  return <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>
}

export function usePersonalStore() {
  const ctx = useContext(PersonalContext)
  if (!ctx) throw new Error('usePersonalStore must be used inside PersonalStoreProvider')
  return ctx
}
