import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Tag } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import { newId } from '../lib/id'
import { monthKey, shiftMonth } from '../lib/dates'
import { installmentDate, splitInstallments } from '../lib/installments'

// Personal expenses, stored in this browser until stage 5 moves them to Supabase.
// Field names mirror the `expenses` / `expense_history` / `installment_plans` tables to ease that migration.
// Nothing is deleted: expenses are voided, and every change is recorded in history.
//
// Installment purchases: one plan + one expense per installment, dated in its own month,
// so each month's summary only counts that month's installment.

const STORAGE_KEY = 'gastos:personal:v1'

/** Fields the user can change; history records before/after of these. */
export const TRACKED_FIELDS = ['amount', 'currency', 'exchangeRate', 'rateType', 'categoryId', 'note', 'spentAt', 'receiptId']
const PLAN_FIELDS = ['categoryId', 'note', 'card']

const empty = { expenses: [], history: [], categories: [], plans: [] }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k] ?? null]))
const historyEntry = (fields) => ({ id: newId(), changedAt: new Date().toISOString(), ...fields })

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
    const expense = {
      id: newId(),
      ...pick(data, TRACKED_FIELDS),
      installmentPlanId: null,
      installmentNumber: null,
      status: 'active',
      voidedAt: null,
      voidReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    }
    setState((s) => ({
      ...s,
      expenses: [...s.expenses, expense],
      history: [...s.history, historyEntry({ expenseId: expense.id, action: 'created', before: null, after: pick(expense, TRACKED_FIELDS) })],
    }))
    return expense
  }, [])

  /** Returns false if nothing changed. Voided expenses and installments can't be edited here. */
  const editExpense = useCallback((id, changes) => {
    const current = state.expenses.find((e) => e.id === id)
    if (!current || current.status !== 'active' || current.installmentPlanId) return false
    const changedKeys = TRACKED_FIELDS.filter((k) => k in changes && (changes[k] ?? null) !== (current[k] ?? null))
    if (changedKeys.length === 0) return false
    const now = new Date().toISOString()
    const before = pick(current, changedKeys)
    const after = pick(changes, changedKeys)
    setState((s) => ({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...after, updatedAt: now } : e)),
      history: [...s.history, historyEntry({ expenseId: id, action: 'edited', before, after })],
    }))
    return true
  }, [state.expenses])

  const voidExpense = useCallback((id, reason) => {
    const trimmed = reason.trim()
    if (!trimmed) throw new Error('El motivo es obligatorio')
    const now = new Date().toISOString()
    setState((s) => ({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id && e.status === 'active' && !e.installmentPlanId
        ? { ...e, status: 'voided', voidedAt: now, voidReason: trimmed }
        : e)),
      history: [...s.history, historyEntry({ expenseId: id, action: 'voided', before: { status: 'active' }, after: { status: 'voided', voidReason: trimmed } })],
    }))
  }, [])

  /**
   * data: { totalAmount, installmentCount, firstMonth, card, currency, exchangeRate, rateType,
   *         categoryId, note, receiptId, purchasedAt }
   */
  const addInstallmentPlan = useCallback((data) => {
    const now = new Date().toISOString()
    const plan = {
      id: newId(),
      totalAmount: data.totalAmount,
      installmentCount: data.installmentCount,
      firstMonth: data.firstMonth,
      card: data.card || null,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      rateType: data.rateType,
      categoryId: data.categoryId,
      note: data.note,
      receiptId: data.receiptId,
      purchasedAt: data.purchasedAt,
      status: 'active',
      voidedAt: null,
      voidReason: null,
      createdAt: now,
    }
    const amounts = splitInstallments(plan.totalAmount, plan.installmentCount)
    const installments = amounts.map((amount, i) => ({
      id: newId(),
      amount,
      currency: plan.currency,
      exchangeRate: plan.exchangeRate,
      rateType: plan.rateType,
      categoryId: plan.categoryId,
      note: plan.note,
      spentAt: installmentDate(plan.purchasedAt, shiftMonth(plan.firstMonth, i)),
      receiptId: null,
      installmentPlanId: plan.id,
      installmentNumber: i + 1,
      status: 'active',
      voidedAt: null,
      voidReason: null,
      createdAt: now,
      updatedAt: null,
    }))
    setState((s) => ({
      ...s,
      plans: [...s.plans, plan],
      expenses: [...s.expenses, ...installments],
      history: [
        ...s.history,
        historyEntry({ planId: plan.id, action: 'created', before: null, after: pick(plan, ['totalAmount', 'installmentCount', 'firstMonth', ...PLAN_FIELDS]) }),
      ],
    }))
    return plan
  }, [])

  /** Changes category, description or card of a purchase; applied to all its non-voided installments. */
  const editInstallmentPlan = useCallback((planId, changes) => {
    const plan = state.plans.find((p) => p.id === planId)
    if (!plan || plan.status !== 'active') return false
    const changedKeys = PLAN_FIELDS.filter((k) => k in changes && (changes[k] || null) !== (plan[k] || null))
    if (changedKeys.length === 0) return false
    const now = new Date().toISOString()
    const before = pick(plan, changedKeys)
    const after = Object.fromEntries(changedKeys.map((k) => [k, changes[k] || null]))
    const expenseChanges = pick(after, changedKeys.filter((k) => k !== 'card'))
    setState((s) => ({
      ...s,
      plans: s.plans.map((p) => (p.id === planId ? { ...p, ...after } : p)),
      expenses: Object.keys(expenseChanges).length === 0
        ? s.expenses
        : s.expenses.map((e) => (e.installmentPlanId === planId && e.status === 'active'
          ? { ...e, ...expenseChanges, updatedAt: now }
          : e)),
      history: [...s.history, historyEntry({ planId, action: 'edited', before, after })],
    }))
    return true
  }, [state.plans])

  /**
   * Voids a purchase: installments from next month on are voided; this month's and past ones
   * were already charged, so they stay as they are.
   */
  const voidInstallmentPlan = useCallback((planId, reason) => {
    const trimmed = reason.trim()
    if (!trimmed) throw new Error('El motivo es obligatorio')
    const now = new Date().toISOString()
    const current = monthKey()
    setState((s) => {
      const toVoid = s.expenses.filter((e) =>
        e.installmentPlanId === planId && e.status === 'active' && monthKey(e.spentAt) > current)
      const ids = new Set(toVoid.map((e) => e.id))
      const installmentReason = `Compra anulada: ${trimmed}`
      return {
        ...s,
        plans: s.plans.map((p) => (p.id === planId && p.status === 'active'
          ? { ...p, status: 'voided', voidedAt: now, voidReason: trimmed }
          : p)),
        expenses: s.expenses.map((e) => (ids.has(e.id)
          ? { ...e, status: 'voided', voidedAt: now, voidReason: installmentReason }
          : e)),
        history: [
          ...s.history,
          historyEntry({ planId, action: 'voided', before: { status: 'active' }, after: { status: 'voided', voidReason: trimmed, voidedInstallments: toVoid.length } }),
          ...toVoid.map((e) => historyEntry({ expenseId: e.id, action: 'voided', before: { status: 'active' }, after: { status: 'voided', voidReason: installmentReason } })),
        ],
      }
    })
  }, [])

  const addCategory = useCallback(({ name, color }) => {
    const category = { id: `custom-${newId()}`, name: name.trim(), color }
    setState((s) => ({ ...s, categories: [...s.categories, category] }))
    return category
  }, [])

  const value = useMemo(() => {
    const categories = [...CATEGORIES, ...state.categories.map((c) => ({ ...c, Icon: Tag, custom: true }))]
    const byId = Object.fromEntries(categories.map((c) => [c.id, c]))
    const planById = Object.fromEntries(state.plans.map((p) => [p.id, p]))
    return {
      expenses: state.expenses,
      history: state.history,
      plans: state.plans,
      categories,
      cards: [...new Set(state.plans.map((p) => p.card).filter(Boolean))],
      getCategory: (id) => byId[id] ?? byId.otros,
      getPlan: (id) => planById[id] ?? null,
      /** An installment's history includes its purchase's history. */
      historyOf: (expenseId) => {
        const expense = state.expenses.find((e) => e.id === expenseId)
        return state.history
          .filter((h) => h.expenseId === expenseId || (expense?.installmentPlanId && h.planId === expense.installmentPlanId))
          .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
      },
      planHistoryOf: (planId) => state.history.filter((h) => h.planId === planId),
      installmentsOf: (planId) => state.expenses
        .filter((e) => e.installmentPlanId === planId)
        .sort((a, b) => a.installmentNumber - b.installmentNumber),
      addExpense,
      editExpense,
      voidExpense,
      addInstallmentPlan,
      editInstallmentPlan,
      voidInstallmentPlan,
      addCategory,
      saveError,
    }
  }, [state, addExpense, editExpense, voidExpense, addInstallmentPlan, editInstallmentPlan, voidInstallmentPlan, addCategory, saveError])

  return <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>
}

export function usePersonalStore() {
  const ctx = useContext(PersonalContext)
  if (!ctx) throw new Error('usePersonalStore must be used inside PersonalStoreProvider')
  return ctx
}
