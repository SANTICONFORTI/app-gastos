import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CloudUpload } from 'lucide-react'
import Pressable from './Pressable'
import ProgressBar from './ProgressBar'
import { usePersonalStore } from '../store/PersonalStore'
import { dismissLocalData, finishLocalData, importLocalData, readLocalData } from '../lib/localImport'
import { softSpring } from '../lib/motion'

/** Offers to upload the expenses saved in this browser before the account existed. */
export default function LocalImportCard({ onNotice }) {
  const store = usePersonalStore()
  const [local, setLocal] = useState(readLocalData)
  const [progress, setProgress] = useState(null) // { done, total }

  if (!local || store.status !== 'ready') return null
  const count = local.expenses.length + local.plans.length

  async function upload() {
    setProgress({ done: 0, total: count })
    const result = await importLocalData(local, store, (done, total) => setProgress({ done, total }))
    if (result.failed === 0) {
      finishLocalData()
      setLocal(null)
      onNotice(`Listo: subimos ${result.imported} ${result.imported === 1 ? 'movimiento' : 'movimientos'} a tu cuenta`)
    } else {
      // Keep the local data so nothing is lost; the card stays so it can be retried or dismissed.
      setProgress(null)
      onNotice(`Subimos ${result.imported}, pero ${result.failed} fallaron. Revisá tu conexión.`)
    }
  }

  function skip() {
    dismissLocalData()
    setLocal(null)
  }

  return (
    <AnimatePresence>
      <motion.section
        className="card glass import-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={softSpring}
        aria-labelledby="import-title"
      >
        <div className="import-head">
          <span className="coming-soon-icon glass import-icon"><CloudUpload size={22} strokeWidth={2} /></span>
          <div>
            <h2 id="import-title" className="card-title">Tenés datos en este dispositivo</h2>
            <p className="muted-sm">
              {count} {count === 1 ? 'movimiento cargado' : 'movimientos cargados'} antes de crear tu cuenta.
              Subilos para verlos desde cualquier lado.
            </p>
          </div>
        </div>
        {progress ? (
          <div className="import-progress" aria-live="polite">
            <ProgressBar value={progress.total ? progress.done / progress.total : 0} label="Subiendo datos" />
            <span className="muted-sm">Subiendo {progress.done} de {progress.total}…</span>
          </div>
        ) : (
          <div className="detail-actions">
            <Pressable className="btn btn-glass" onClick={skip}>No, gracias</Pressable>
            <Pressable className="btn btn-primary" onClick={upload}>Subir a mi cuenta</Pressable>
          </div>
        )}
      </motion.section>
    </AnimatePresence>
  )
}
