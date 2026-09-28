import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fromCategoryRow, fromExpenseRow, fromPlanRow, normalizeExpenseHistory, normalizePlanHistory, toExpenseRow } from '../lib/db'
import { iconFor } from '../data/categories'
import { newId } from '../lib/id'
import { useAuth } from './AuthProvider'

// Personal expenses, stored in Supabase. The database enforces the rules
// (RLS, nothing is deleted, history written by triggers); this store keeps a local copy
// for the screens and exposes async actions that throw friendly errors.

const PersonalContext = createContext(null)

export function PersonalStoreProvider({ children }) {
  const { user } = useAuth()
  const [data, setData] = useState({ expenses: [], plans: [], categories: [] })
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    const [cats, exps, plans] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').order('created_at'),
      supabase.from('expenses').select('*').eq('owner_id', user.id).is('group_id', null).order('spent_at', { ascending: false }),
      supabase.from('installment_plans').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    ])
    const error = cats.error || exps.error || plans.error
    if (error) {
      setLoadError(error)
      setStatus((s) => (s === 'ready' ? s : 'error'))
      return
    }
    setData({
      categories: cats.data.map(fromCategoryRow),
      expenses: exps.data.map(fromExpenseRow),
      plans: plans.data.map(fromPlanRow),
    })
    setLoadError(null)
    setStatus('ready')
  }, [user.id])

  useEffect(() => {
    load()
    // Pick up changes made on another device when coming back to the app.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const replaceExpense = (row) => setData((d) => ({
    ...d,
    expenses: d.expenses.some((e) => e.id === row.id)
      ? d.expenses.map((e) => (e.id === row.id ? fromExpenseRow(row) : e))
      : [fromExpenseRow(row), ...d.expenses],
  }))

  const addExpense = useCallback(async (input) => {
    const { data: row, error } = await supabase
      .from('expenses')
      .insert({ ...toExpenseRow(input), owner_id: user.id })
      .select()
      .single()
    if (error) throw error
    replaceExpense(row)
    return fromExpenseRow(row)
  }, [user.id])

  /** Returns false if nothing changed. */
  const editExpense = useCallback(async (id, changes) => {
    const current = data.expenses.find((e) => e.id === id)
    if (!current || current.status !== 'active' || current.installmentPlanId) return false
    const changed = Object.fromEntries(Object.entries(changes).filter(([k, v]) => {
      const a = k === 'note' ? (v?.trim() || '') : v ?? null
      const b = current[k] ?? (k === 'note' ? '' : null)
      return k === 'spentAt' ? Date.parse(a) !== Date.parse(b) : a !== b
    }))
    if (Object.keys(changed).length === 0) return false
    const { data: row, error } = await supabase.from('expenses').update(toExpenseRow(changed)).eq('id', id).select().single()
    if (error) throw error
    replaceExpense(row)
    return true
  }, [data.expenses])

  const voidExpense = useCallback(async (id, reason) => {
    const { data: row, error } = await supabase
      .from('expenses')
      .update({ status: 'voided', void_reason: reason.trim() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    replaceExpense(row)
  }, [])

  /** Returns the new plan id. `reload: false` skips refreshing (bulk imports reload once at the end). */
  const addInstallmentPlan = useCallback(async (input, { reload = true } = {}) => {
    const { data: planId, error } = await supabase.rpc('create_installment_plan', {
      p_total_amount: input.totalAmount,
      p_installment_count: input.installmentCount,
      p_first_month: `${input.firstMonth}-01`,
      p_purchased_at: input.purchasedAt,
      p_currency: input.currency,
      p_exchange_rate: input.exchangeRate,
      p_rate_type: input.rateType,
      p_category_id: input.categoryId,
      p_note: input.note || null,
      p_card: input.card || null,
      p_receipt_path: input.receiptId,
    })
    if (error) throw error
    if (reload) await load()
    return planId
  }, [load])

  const editInstallmentPlan = useCallback(async (planId, { categoryId, note, card }) => {
    const { data: changed, error } = await supabase.rpc('edit_installment_plan', {
      p_plan_id: planId, p_category_id: categoryId, p_note: note, p_card: card,
    })
    if (error) throw error
    if (changed) await load()
    return changed
  }, [load])

  const voidInstallmentPlan = useCallback(async (planId, reason, { reload = true } = {}) => {
    const { data: count, error } = await supabase.rpc('void_installment_plan', { p_plan_id: planId, p_reason: reason })
    if (error) throw error
    if (reload) await load()
    return count
  }, [load])

  const addCategory = useCallback(async ({ name, color }) => {
    const { data: row, error } = await supabase
      .from('categories')
      .insert({ owner_id: user.id, name: name.trim(), color, icon: 'tag', sort_order: 100 })
      .select()
      .single()
    if (error) throw error
    const category = fromCategoryRow(row)
    setData((d) => ({ ...d, categories: [...d.categories, category] }))
    return { ...category, Icon: iconFor(category.icon) }
  }, [user.id])

  /** Uploads a compressed receipt photo; returns its storage path. Receipts are never replaced. */
  const uploadReceipt = useCallback(async (blob) => {
    const path = `users/${user.id}/${newId()}.jpg`
    const { error } = await supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    return path
  }, [user.id])

  const value = useMemo(() => {
    const categories = data.categories.map((c) => ({ ...c, Icon: iconFor(c.icon) }))
    const byId = Object.fromEntries(categories.map((c) => [c.id, c]))
    const fallback = categories.find((c) => c.name === 'Otros' && !c.custom) ?? categories[0]
    const planById = Object.fromEntries(data.plans.map((p) => [p.id, p]))
    const installmentsOf = (planId) => data.expenses
      .filter((e) => e.installmentPlanId === planId)
      .sort((a, b) => a.installmentNumber - b.installmentNumber)

    return {
      status,
      loadError,
      reload: load,
      expenses: data.expenses,
      plans: data.plans,
      categories,
      cards: [...new Set(data.plans.map((p) => p.card).filter(Boolean))],
      getCategory: (id) => byId[id] ?? fallback ?? { id: null, name: 'Sin categoría', color: '#8C9BBB', Icon: iconFor('tag') },
      getPlan: (id) => planById[id] ?? null,
      installmentsOf,
      addExpense,
      editExpense,
      voidExpense,
      addInstallmentPlan,
      editInstallmentPlan,
      voidInstallmentPlan,
      addCategory,
      uploadReceipt,
      /** History entries of an expense; installments show their purchase's history plus their own voiding. */
      fetchExpenseHistory: async (expense) => {
        const { data: rows, error } = await supabase
          .from('expense_history').select('*').eq('expense_id', expense.id).order('changed_at')
        if (error) throw error
        const own = normalizeExpenseHistory(rows)
        if (!expense.installmentPlanId) return own
        const plan = await fetchPlanHistory(expense.installmentPlanId, installmentsOf(expense.installmentPlanId))
        return [...plan, ...own.filter((h) => h.action === 'voided')]
          .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
      },
      fetchPlanHistory: (planId) => fetchPlanHistory(planId, installmentsOf(planId)),
    }
  }, [data, status, loadError, load, addExpense, editExpense, voidExpense, addInstallmentPlan, editInstallmentPlan, voidInstallmentPlan, addCategory, uploadReceipt])

  return <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>
}

async function fetchPlanHistory(planId, installments) {
  const { data: rows, error } = await supabase
    .from('installment_plan_history').select('*').eq('plan_id', planId).order('changed_at')
  if (error) throw error
  const voided = installments.filter((e) => e.status === 'voided' && e.voidReason?.startsWith('Compra anulada')).length
  return normalizePlanHistory(rows, voided)
}

export function usePersonalStore() {
  const ctx = useContext(PersonalContext)
  if (!ctx) throw new Error('usePersonalStore must be used inside PersonalStoreProvider')
  return ctx
}
