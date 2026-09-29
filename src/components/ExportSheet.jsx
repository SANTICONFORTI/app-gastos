import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileSpreadsheet, FileText } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import PillToggle from './PillToggle'
import { usePersonalStore } from '../store/PersonalStore'
import { exportCsv, periodExpenses } from '../lib/exporting'
import { isActive, toArs } from '../lib/expenses'
import { periodMonths, periodLabel } from '../lib/wrapped'
import { monthLabelWithYear } from '../lib/dates'
import { formatMoney } from '../lib/format'

export default function ExportSheet({ open, month, onClose, onNotice }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="export-title" space="personal">
      <Export month={month} onClose={onClose} onNotice={onNotice} />
    </Sheet>
  )
}

function Export({ month, onClose, onNotice }) {
  const store = usePersonalStore()
  const [scope, setScope] = useState('month')
  const [printing, setPrinting] = useState(false)
  const year = Number(month.slice(0, 4))
  const period = scope === 'month' ? { type: 'month', key: month } : { type: 'year', year }
  const months = periodMonths(period)
  const count = periodExpenses(store, months).length
  const name = scope === 'month' ? `puly-gastos-${month}` : `puly-gastos-${year}`

  function csv() {
    const n = exportCsv(store, months, name)
    onNotice(`Listo: ${n} ${n === 1 ? 'gasto' : 'gastos'} en el archivo para Excel`)
  }

  // Print mode: render the report, open the print dialog, then clean up.
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 250)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [printing])

  return (
    <div className="profile-form">
      <SheetHeader id="export-title" title="Exportar gastos" onClose={onClose} />
      <PillToggle label="Período" options={[{ id: 'month', label: monthLabelWithYear(month) }, { id: 'year', label: `Todo ${year}` }]} value={scope} onChange={setScope} layoutId="export-scope" />
      <p className="muted-sm">{count} {count === 1 ? 'gasto' : 'gastos'} personales (los anulados aparecen marcados).</p>
      <Pressable className="btn btn-glass btn-lg" disabled={!count} onClick={csv}>
        <FileSpreadsheet size={18} strokeWidth={2.2} /> Excel (CSV)
      </Pressable>
      <Pressable className="btn btn-primary btn-lg" disabled={!count} onClick={() => setPrinting(true)}>
        <FileText size={18} strokeWidth={2.2} /> PDF
      </Pressable>
      <p className="muted-sm">Para el PDF se abre la ventana de impresión: elegí <strong>“Guardar como PDF”</strong> como impresora.</p>
      {printing && createPortal(<PrintReport store={store} period={period} months={months} />, document.body)}
    </div>
  )
}

function PrintReport({ store, period, months }) {
  const all = periodExpenses(store, months)
  const active = all.filter(isActive)
  const total = active.reduce((s, e) => s + toArs(e), 0)
  const byCat = {}
  for (const e of active) byCat[e.categoryId] = (byCat[e.categoryId] ?? 0) + toArs(e)
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const dateFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div id="print-root">
      <h1>Puly · Resumen de {periodLabel(period).replace(/^Tu /, '')}</h1>
      <p>Generado el {dateFmt.format(new Date())}. Montos en pesos (los gastos en dólares con la cotización guardada).</p>
      <h2>Total gastado: {formatMoney(total)}</h2>
      <table>
        <thead><tr><th>Categoría</th><th>Monto</th><th>%</th></tr></thead>
        <tbody>
          {cats.map(([id, v]) => (
            <tr key={id}><td>{store.getCategory(id).name}</td><td>{formatMoney(v)}</td><td>{Math.round((v / total) * 100)}%</td></tr>
          ))}
        </tbody>
      </table>
      <h2>Detalle</h2>
      <table>
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th></tr></thead>
        <tbody>
          {all.map((e) => (
            <tr key={e.id} className={e.status === 'voided' ? 'voided' : ''}>
              <td>{dateFmt.format(new Date(e.spentAt))}</td>
              <td>{e.note || '—'}{e.status === 'voided' ? ` (anulado: ${e.voidReason})` : ''}{e.currency === 'USD' ? ` · US$ ${e.amount}` : ''}</td>
              <td>{store.getCategory(e.categoryId).name}</td>
              <td>{formatMoney(toArs(e))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="print-brand">Hecho con Puly · puly.vercel.app</p>
    </div>
  )
}
