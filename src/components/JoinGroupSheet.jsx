import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ticket, Users } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import GroupAvatar from './GroupAvatar'
import { useGroups } from '../store/GroupsStore'
import { friendlyError } from '../lib/db'
import { softSpring } from '../lib/motion'

/** Join a group with a short code (typed, or coming from an invitation link). */
export default function JoinGroupSheet({ open, initialCode, onClose, onDone }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="join-title" space="group">
      <Join initialCode={initialCode} onClose={onClose} onDone={onDone} />
    </Sheet>
  )
}

const normalize = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z0-9]{3})(\d)/, '$1-$2').slice(0, 8)

function Join({ initialCode, onClose, onDone }) {
  const groups = useGroups()
  const [code, setCode] = useState(initialCode ? normalize(initialCode) : '')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function look(value = code) {
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      setPreview(await groups.previewCode(value))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  // Coming from a link: look it up right away.
  useEffect(() => {
    if (initialCode) look(normalize(initialCode))
  }, [])

  async function join() {
    setBusy(true)
    setError('')
    try {
      const result = await groups.joinWithCode(code)
      onDone(result.status === 'active'
        ? `¡Entraste a ${preview.name}!`
        : `Listo, le avisamos al admin de ${preview.name}. Vas a entrar cuando te apruebe.`)
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  const already = groups.memberships.find((m) => m.group.id === preview?.group_id && m.status === 'active')

  return (
    <div className="profile-form">
      <SheetHeader id="join-title" title="Unirme a un grupo" onClose={onClose} />

      <form className="code-row" onSubmit={(e) => { e.preventDefault(); if (code.length >= 7) look() }}>
        <label className="field code-field">
          <span className="field-label">Código de invitación</span>
          <span className="input-wrap glass">
            <Ticket size={18} strokeWidth={2} aria-hidden="true" />
            <input
              value={code}
              onChange={(e) => { setCode(normalize(e.target.value)); setPreview(null); setError('') }}
              placeholder="PLM-4829"
              autoCapitalize="characters"
              autoComplete="off"
              className="code-input"
            />
          </span>
        </label>
        <Pressable type="submit" className="btn btn-glass btn-lg" disabled={busy || code.length < 7}>Buscar</Pressable>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}

      <AnimatePresence>
        {preview && (
          <motion.div
            className="join-preview glass"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={softSpring}
          >
            <GroupAvatar group={{ id: preview.group_id, name: preview.name, avatar_url: preview.avatar_url }} size={64} />
            <span className="card-title">{preview.name}</span>
            <span className="muted-sm"><Users size={13} strokeWidth={2.2} aria-hidden="true" /> {preview.members} {preview.members === 1 ? 'integrante' : 'integrantes'}</span>
            <span className="muted-sm">
              {preview.join_mode === 'direct' ? 'Entrás directo.' : 'Un admin tiene que aprobar tu pedido.'}
            </span>
            {already ? (
              <p className="form-notice">Ya estás en este grupo.</p>
            ) : (
              <Pressable className="btn btn-primary btn-lg" disabled={busy} onClick={join}>
                {busy ? 'Un momento…' : preview.join_mode === 'direct' ? 'Entrar al grupo' : 'Pedir entrar'}
              </Pressable>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
