import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Image as ImageIcon, AtSign, Check, X, Loader2 } from 'lucide-react'
import Pressable from './Pressable'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/db'
import { USERNAME_RE, avatarColor, checkUsername, initialsOf, suggestUsername, uploadAvatar, validateAliasCvu } from '../lib/profile'

const USERNAME_HINTS = {
  invalid: 'Entre 3 y 20 caracteres: letras minúsculas, números, punto o guion bajo.',
  checking: 'Fijándonos si está libre…',
  available: '¡Está libre!',
  yours: 'Es tu usuario actual.',
  taken: 'Ya lo usa otra persona. Probá con otro.',
  error: 'No pudimos verificarlo. Revisá tu conexión.',
}

/**
 * Display name, unique @username (checked live), photo (gallery or camera, compressed) and alias/CVU.
 * Used on the welcome screen and to edit the profile later.
 */
export default function ProfileForm({ user, profile, submitLabel, onSaved }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || user.user_metadata?.full_name || '')
  const [username, setUsername] = useState(
    profile?.username || suggestUsername(profile?.display_name || user.user_metadata?.full_name || user.email || ''),
  )
  const [aliasCvu, setAliasCvu] = useState(profile?.alias_cvu ?? '')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [usernameState, setUsernameState] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)

  // Live availability check, debounced.
  useEffect(() => {
    if (!USERNAME_RE.test(username)) {
      setUsernameState('invalid')
      return
    }
    setUsernameState('checking')
    let cancelled = false
    const timer = setTimeout(() => {
      checkUsername(username, user.id)
        .then((result) => !cancelled && setUsernameState(result))
        .catch(() => !cancelled && setUsernameState('error'))
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [username, user.id])

  useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview])

  function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const aliasError = validateAliasCvu(aliasCvu)
  const nameError = displayName.trim().length === 0 ? 'Poné cómo querés que te vean.' : null
  const usernameOk = usernameState === 'available' || usernameState === 'yours'

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (nameError || aliasError || !usernameOk) {
      setError(nameError || aliasError || USERNAME_HINTS[usernameState])
      return
    }
    setBusy(true)
    try {
      let avatarUrl = profile?.avatar_url ?? null
      if (photoFile) avatarUrl = await uploadAvatar(user.id, photoFile)
      const { error: err } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username,
          alias_cvu: aliasCvu.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id)
      if (err) throw err
      await onSaved()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  const avatarSrc = photoPreview ?? profile?.avatar_url ?? undefined

  return (
    <form className="profile-form" onSubmit={submit} noValidate>
      <div className="avatar-picker">
        <motion.div key={avatarSrc ?? 'none'} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Avatar
            src={avatarSrc}
            initials={initialsOf(displayName || username)}
            color={avatarColor(user.id)}
            size={104}
            ring="rgba(255,255,255,.2)"
            label="Tu foto de perfil"
          />
        </motion.div>
        <div className="avatar-picker-actions">
          <Pressable className="btn btn-glass small-btn" onClick={() => galleryRef.current?.click()}>
            <ImageIcon size={15} strokeWidth={2.2} /> Galería
          </Pressable>
          <Pressable className="btn btn-glass small-btn" onClick={() => cameraRef.current?.click()}>
            <Camera size={15} strokeWidth={2.2} /> Cámara
          </Pressable>
        </div>
        <span className="muted-sm">Opcional. Sin foto, usamos tu inicial.</span>
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={pickPhoto} />
      </div>

      <label className="field">
        <span className="field-label">Nombre para mostrar</span>
        <span className="input-wrap glass">
          <input value={displayName} maxLength={40} autoComplete="name" onChange={(e) => setDisplayName(e.target.value)} placeholder="Ej: Santi" />
        </span>
      </label>

      <label className="field">
        <span className="field-label">Usuario</span>
        <span className={`input-wrap glass ${usernameState === 'taken' || usernameState === 'invalid' ? 'is-invalid' : ''}`}>
          <AtSign size={18} strokeWidth={2} aria-hidden="true" />
          <input
            value={username}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            aria-describedby="username-hint"
          />
          <span className={`username-status status-${usernameState}`} aria-hidden="true">
            {usernameState === 'checking' && <Loader2 size={18} strokeWidth={2.2} className="spin" />}
            {usernameOk && <Check size={18} strokeWidth={2.6} />}
            {(usernameState === 'taken' || usernameState === 'invalid') && <X size={18} strokeWidth={2.6} />}
          </span>
        </span>
        <span id="username-hint" className={`field-hint status-${usernameState}`} aria-live="polite">{USERNAME_HINTS[usernameState]}</span>
      </label>

      <label className="field">
        <span className="field-label">Alias o CVU (opcional)</span>
        <span className={`input-wrap glass ${aliasError ? 'is-invalid' : ''}`}>
          <input value={aliasCvu} maxLength={22} autoCapitalize="none" onChange={(e) => setAliasCvu(e.target.value)} placeholder="Ej: santi.gastos.mp" />
        </span>
        <span className="field-hint">{aliasError ?? 'Para que te transfieran cuando saldan cuentas en un grupo.'}</span>
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <Pressable type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? 'Guardando…' : submitLabel}
      </Pressable>
    </form>
  )
}
