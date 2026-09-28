import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, Mail } from 'lucide-react'
import Pressable from '../components/Pressable'
import PillToggle from '../components/PillToggle'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/db'
import { listContainer, listItem, softSpring } from '../lib/motion'

/** Sign in / sign up with Google or email + password, and "forgot password". */
export default function AuthScreen() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const redirectTo = window.location.origin

  async function withBusy(fn) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const google = () => withBusy(async () => {
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (err) throw err
  })

  function submit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Completá tu mail y tu contraseña.')
      return
    }
    withBusy(async () => {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo },
        })
        if (err) throw err
        if (!data.session) setNotice('Te mandamos un mail para confirmar tu cuenta. Abrilo y volvé a entrar.')
      }
    })
  }

  const forgot = () => {
    if (!email.trim()) {
      setError('Escribí tu mail arriba y tocá de nuevo "Olvidé mi contraseña".')
      return
    }
    withBusy(async () => {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (err) throw err
      setNotice('Si ese mail tiene cuenta, te llega un link para crear una contraseña nueva.')
    })
  }

  return (
    <motion.main className="auth" variants={listContainer} initial="hidden" animate="show">
      <motion.div variants={listItem} className="auth-brand">
        <span className="auth-logo" aria-hidden="true">$</span>
        <h1 className="auth-title">Pooly</h1>
        <p className="auth-tagline">Tus gastos personales y compartidos, hechos para Argentina.</p>
      </motion.div>

      <motion.div variants={listItem} className="auth-card glass">
        <Pressable className="btn btn-lg google-btn" onClick={google} disabled={busy}>
          <GoogleLogo /> Continuar con Google
        </Pressable>

        <div className="auth-divider"><span>o con tu mail</span></div>

        <PillToggle
          label="Qué querés hacer"
          options={[{ id: 'signin', label: 'Entrar' }, { id: 'signup', label: 'Crear cuenta' }]}
          value={mode}
          onChange={(m) => { setMode(m); setError(''); setNotice('') }}
          layoutId="auth-mode-pill"
        />

        <form className="auth-form" onSubmit={submit} noValidate>
          <label className="field">
            <span className="field-label">Mail</span>
            <span className="input-wrap glass">
              <Mail size={18} strokeWidth={2} aria-hidden="true" />
              <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@mail.com" />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Contraseña</span>
            <span className="input-wrap glass">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : ''}
              />
              <button
                type="button"
                className="input-icon-btn"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </span>
          </label>

          <AnimatePresence mode="wait">
            {(error || notice) && (
              <motion.p
                key={error || notice}
                className={error ? 'form-error' : 'form-notice'}
                role={error ? 'alert' : 'status'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={softSpring}
              >
                {error || notice}
              </motion.p>
            )}
          </AnimatePresence>

          <Pressable type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
          </Pressable>
          {mode === 'signin' && (
            <button type="button" className="link-btn" onClick={forgot} disabled={busy}>Olvidé mi contraseña</button>
          )}
        </form>
      </motion.div>

      <motion.p variants={listItem} className="auth-footer">Gratis y sin publicidad.</motion.p>
    </motion.main>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
