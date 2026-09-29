import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePersonalStore } from './PersonalStore'
import useDollarRates from '../hooks/useDollarRates'

// Savings goals, budgets and recurring expenses. Recurring expenses that are due are created
// by the database when the app opens (generate_recurring_expenses).

const ExtrasContext = createContext(null)

export function ExtrasStoreProvider({ children }) {
  const personal = usePersonalStore()
  const rates = useDollarRates()
  const [data, setData] = useState({ goals: [], budgets: [], recurring: [] })
  const [status, setStatus] = useState('loading')
  const generated = useRef(false)

  const load = useCallback(async () => {
    const [goals, budgets, recurring] = await Promise.all([
      supabase.from('savings_goals').select('*, movements:savings_movements(*)').order('created_at'),
      supabase.from('budgets').select('*').eq('active', true),
      supabase.from('recurring_expenses').select('*').order('day_of_month'),
    ])
    if (goals.error || budgets.error || recurring.error) {
      setStatus((s) => (s === 'ready' ? s : 'error'))
      return
    }
    for (const g of goals.data) g.movements.sort((a, b) => b.created_at.localeCompare(a.created_at))
    setData({ goals: goals.data, budgets: budgets.data, recurring: recurring.data })
    setStatus('ready')
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Once per session, as soon as quotes are known (or definitely unavailable), create due recurring expenses.
  useEffect(() => {
    if (generated.current || rates.status === 'loading') return
    generated.current = true
    const quotes = { blue: rates.quote('blue'), tarjeta: rates.quote('tarjeta') }
    supabase.rpc('generate_recurring_expenses', { p_rates: quotes }).then(({ data: count }) => {
      if (count > 0) {
        personal.reload()
        load()
      }
    })
  }, [rates.status])

  const actions = useMemo(() => {
    const call = async (promise) => {
      const { data: result, error } = await promise
      if (error) throw error
      await load()
      return result
    }
    return {
      reload: load,
      createGoal: ({ name, target, deadline, color }) =>
        call(supabase.from('savings_goals').insert({ name: name.trim(), target_amount: target, deadline: deadline || null, color })),
      archiveGoal: (id) => call(supabase.from('savings_goals').update({ status: 'archived' }).eq('id', id)),
      addMovement: (goalId, amount, note) =>
        call(supabase.from('savings_movements').insert({ goal_id: goalId, amount, note: note?.trim() || null })),
      voidMovement: (id, reason) =>
        call(supabase.from('savings_movements').update({ status: 'voided', void_reason: reason.trim() }).eq('id', id)),

      /** Replaces the category's budget (the old one stays inactive, nothing is deleted). */
      async setBudget(categoryId, limit) {
        await supabase.from('budgets').update({ active: false }).eq('category_id', categoryId).eq('active', true)
        if (limit > 0) return call(supabase.from('budgets').insert({ category_id: categoryId, monthly_limit: limit }))
        return load()
      },

      async createRecurring(input) {
        await call(supabase.from('recurring_expenses').insert(input))
        // If it's already due this month, create it right away.
        const { data: count } = await supabase.rpc('generate_recurring_expenses', {
          p_rates: { blue: rates.quote('blue'), tarjeta: rates.quote('tarjeta') },
        })
        if (count > 0) {
          await personal.reload()
          await load()
        }
        return count
      },
      setRecurringActive: (id, active) => call(supabase.from('recurring_expenses').update({ active }).eq('id', id)),
    }
  }, [load, personal, rates])

  const value = useMemo(() => ({ status, ...data, ...actions }), [status, data, actions])
  return <ExtrasContext.Provider value={value}>{children}</ExtrasContext.Provider>
}

export function useExtras() {
  const ctx = useContext(ExtrasContext)
  if (!ctx) throw new Error('useExtras must be used inside ExtrasStoreProvider')
  return ctx
}

/** Next date (Date) a recurring expense is due, from today on. */
export function nextDueDate(r, today = new Date()) {
  const clamp = (y, m) => Math.min(r.day_of_month, new Date(y, m + 1, 0).getDate())
  const y = today.getFullYear()
  const m = today.getMonth()
  const thisMonth = new Date(y, m, clamp(y, m))
  const start = new Date(`${r.start_month}T00:00:00`)
  if (thisMonth >= new Date(y, m, today.getDate()) && thisMonth >= start) return thisMonth
  const next = new Date(y, m + 1, 1)
  const candidate = new Date(next.getFullYear(), next.getMonth(), clamp(next.getFullYear(), next.getMonth()))
  return candidate < start ? new Date(start.getFullYear(), start.getMonth(), clamp(start.getFullYear(), start.getMonth())) : candidate
}

export const goalSaved = (goal) => goal.movements.filter((m) => m.status === 'active').reduce((s, m) => s + Number(m.amount), 0)
