import { useState } from 'react'
import { motion } from 'framer-motion'
import Pressable from '../components/Pressable'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/db'
import { useAuth } from '../store/AuthProvider'
import { listContainer, listItem } from '../lib/motion'

/** Shown after opening a "reset password" link. */
export default function NewPasswordScreen() {
  const { finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (password.length < 6) return setError('La contraseña tiene que tener al menos 6 caracteres.')
    if (password !== repeat) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(friendlyError(err))
      setBusy(false)
      return
    }
    finishRecovery()
  }

  return (
    <motion.main className="auth" variants={listContainer} initial="hidden" animate="show">
      <motion.div variants={listItem} className="auth-brand">
        <h1 className="auth-title">Nueva contraseña</h1>
        <p className="auth-tagline">Elegí una contraseña nueva para tu cuenta.</p>
      </motion.div>
      <motion.form variants={listItem} className="auth-card glass auth-form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">Contraseña nueva</span>
          <span className="input-wrap glass">
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Repetila</span>
          <span className="input-wrap glass">
            <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Pressable type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </Pressable>
      </motion.form>
    </motion.main>
  )
}
