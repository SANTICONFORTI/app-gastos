// Moves data saved in this browser (stages 2-4, before accounts existed) to the user's account.
// The current state of each expense is uploaded (amounts, dates, categories, receipts, voids and
// their reasons); the change history starts again in the cloud at import time.

import { LEGACY_DEFAULT_NAMES } from '../data/categories'
import { getReceipt } from './receipts'

const KEY = 'gastos:personal:v1'
const BACKUP_KEY = 'gastos:personal:v1:respaldo'
const DISMISSED_KEY = 'gastos:personal:v1:no-subir'
const UPLOADED_KEY = 'gastos:personal:v1:subidos'

function readUploaded() {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

/** Local data waiting to be imported, or null. */
export function readLocalData() {
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return null
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    const expenses = (data.expenses ?? []).filter((e) => !e.installmentPlanId)
    const plans = data.plans ?? []
    if (expenses.length === 0 && plans.length === 0) return null
    return { expenses, plans, categories: data.categories ?? [] }
  } catch {
    return null
  }
}

/** Keeps a backup copy and stops offering the import. */
export function finishLocalData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) localStorage.setItem(BACKUP_KEY, raw)
    localStorage.removeItem(KEY)
  } catch {
    // Nothing else to do: worst case the card shows up again.
  }
}

export function dismissLocalData() {
  try {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString())
  } catch {
    // Ignore.
  }
}

async function uploadLocalReceipt(store, receiptId) {
  if (!receiptId) return null
  try {
    const blob = await getReceipt(receiptId)
    return blob ? await store.uploadReceipt(blob) : null
  } catch {
    return null // A missing photo shouldn't block the rest of the import.
  }
}

/**
 * Uploads everything. onProgress(done, total). Returns { imported, failed }.
 * `store` is the PersonalStore value.
 */
export async function importLocalData(local, store, onProgress) {
  const serverCats = [...store.categories]

  async function categoryFor(localId) {
    if (LEGACY_DEFAULT_NAMES[localId]) {
      return serverCats.find((c) => !c.custom && c.name === LEGACY_DEFAULT_NAMES[localId])?.id ?? null
    }
    const localCat = local.categories.find((c) => c.id === localId)
    if (!localCat) return null
    const existing = serverCats.find((c) => c.custom && c.name.toLowerCase() === localCat.name.toLowerCase())
    if (existing) return existing.id
    const created = await store.addCategory({ name: localCat.name, color: localCat.color })
    serverCats.push(created)
    return created.id
  }

  // Items already uploaded in a previous (interrupted) attempt are skipped, so retrying never duplicates.
  const uploaded = readUploaded()
  const markUploaded = (localId) => {
    uploaded.add(localId)
    try {
      localStorage.setItem(UPLOADED_KEY, JSON.stringify([...uploaded]))
    } catch {
      // Ignore: only affects retries.
    }
  }

  const total = local.expenses.length + local.plans.length
  let done = 0
  let failed = 0
  const tick = () => onProgress?.(++done, total)

  for (const plan of [...local.plans].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))) {
    if (uploaded.has(plan.id)) {
      tick()
      continue
    }
    try {
      const planId = await store.addInstallmentPlan({
        totalAmount: plan.totalAmount,
        installmentCount: plan.installmentCount,
        firstMonth: plan.firstMonth,
        card: plan.card,
        currency: plan.currency,
        exchangeRate: plan.exchangeRate,
        rateType: plan.rateType,
        categoryId: await categoryFor(plan.categoryId),
        note: plan.note,
        receiptId: await uploadLocalReceipt(store, plan.receiptId),
        purchasedAt: plan.purchasedAt,
      }, { reload: false })
      markUploaded(plan.id)
      if (plan.status === 'voided') {
        await store.voidInstallmentPlan(planId, plan.voidReason || 'Anulada antes de crear la cuenta', { reload: false })
      }
    } catch {
      failed++
    }
    tick()
  }

  for (const e of [...local.expenses].sort((a, b) => a.spentAt.localeCompare(b.spentAt))) {
    if (uploaded.has(e.id)) {
      tick()
      continue
    }
    try {
      const created = await store.addExpense({
        amount: e.amount,
        currency: e.currency,
        exchangeRate: e.exchangeRate,
        rateType: e.rateType,
        categoryId: await categoryFor(e.categoryId),
        note: e.note,
        receiptId: await uploadLocalReceipt(store, e.receiptId),
        spentAt: e.spentAt,
      })
      markUploaded(e.id)
      if (e.status === 'voided') {
        await store.voidExpense(created.id, e.voidReason || 'Anulado antes de crear la cuenta')
      }
    } catch {
      failed++
    }
    tick()
  }

  await store.reload()
  return { imported: total - failed, failed }
}
