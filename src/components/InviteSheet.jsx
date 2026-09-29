import { useState } from 'react'
import { Copy, Share2, RefreshCw, Link2Off, AtSign, Send } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import QrCode from './QrCode'
import { useGroups } from '../store/GroupsStore'
import { friendlyError } from '../lib/db'

export const inviteLink = (code) => `${window.location.origin}/?unirse=${encodeURIComponent(code)}`

/** Link, short code and QR to invite people, plus inviting by @username. Admins only. */
export default function InviteSheet({ open, onClose, onNotice }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="invite-title" space="group">
      <Invite onClose={onClose} onNotice={onNotice} />
    </Sheet>
  )
}

function Invite({ onClose, onNotice }) {
  const groups = useGroups()
  const group = groups.selected.group
  const invite = groups.invites[0] ?? null
  const [busy, setBusy] = useState(false)
  const [username, setUsername] = useState('')
  const [userMessage, setUserMessage] = useState(null) // { ok, text }

  async function run(fn) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      onNotice(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const create = () => run(() => groups.renewInvite(group.id))
  const renew = () => run(async () => {
    await groups.renewInvite(group.id)
    onNotice('Listo: el link y el código anteriores ya no sirven')
  })
  const disable = () => run(async () => {
    await groups.disableInvites(group.id)
    onNotice('Link desactivado: nadie más puede entrar con él')
  })

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text)
      onNotice(`${what} copiado`)
    } catch {
      onNotice('No se pudo copiar')
    }
  }

  async function share() {
    const url = inviteLink(invite.code)
    if (navigator.share) {
      try {
        await navigator.share({ title: `Sumate a ${group.name} en Puly`, text: `Sumate a "${group.name}" en Puly para compartir gastos.`, url })
      } catch {
        // Cancelled by the user.
      }
    } else {
      copy(url, 'Link')
    }
  }

  async function inviteUser(e) {
    e.preventDefault()
    if (!username.trim()) return
    setBusy(true)
    setUserMessage(null)
    try {
      const text = await groups.inviteByUsername(group.id, username)
      setUserMessage({ ok: true, text })
      setUsername('')
    } catch (err) {
      setUserMessage({ ok: false, text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-form">
      <SheetHeader id="invite-title" title="Invitar al grupo" onClose={onClose} />

      {invite ? (
        <>
          <div className="invite-code-card glass">
            <QrCode value={inviteLink(invite.code)} size={180} label={`Código QR para unirse a ${group.name}`} />
            <span className="muted-sm">Código</span>
            <button type="button" className="invite-code" onClick={() => copy(invite.code, 'Código')} aria-label={`Copiar código ${invite.code}`}>
              {invite.code} <Copy size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <span className="field-hint">
              {group.join_mode === 'direct' ? 'Con el link o el código entran directo.' : 'Cada pedido lo aprueba un admin.'}
            </span>
          </div>
          <div className="detail-actions">
            <Pressable className="btn btn-glass btn-lg" onClick={() => copy(inviteLink(invite.code), 'Link')}>
              <Copy size={16} strokeWidth={2.2} /> Copiar link
            </Pressable>
            <Pressable className="btn btn-primary btn-lg" onClick={share}>
              <Share2 size={16} strokeWidth={2.2} /> Compartir
            </Pressable>
          </div>
          <div className="detail-actions">
            <Pressable className="btn btn-glass small-btn" disabled={busy} onClick={renew}>
              <RefreshCw size={14} strokeWidth={2.2} /> Renovar link
            </Pressable>
            <Pressable className="btn btn-danger-ghost small-btn" disabled={busy} onClick={disable}>
              <Link2Off size={14} strokeWidth={2.2} /> Desactivar
            </Pressable>
          </div>
        </>
      ) : (
        <div className="invite-code-card glass">
          <p className="muted-sm">No hay un link activo para este grupo.</p>
          <Pressable className="btn btn-primary btn-lg" disabled={busy} onClick={create}>Crear link y código</Pressable>
        </div>
      )}

      <form className="field" onSubmit={inviteUser}>
        <span className="field-label">O invitá por @usuario</span>
        <div className="code-row">
          <span className="input-wrap glass code-field">
            <AtSign size={18} strokeWidth={2} aria-hidden="true" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="usuario"
              autoCapitalize="none"
              aria-label="Usuario a invitar"
            />
          </span>
          <Pressable type="submit" className="btn btn-primary btn-icon btn-lg-icon" aria-label="Invitar" disabled={busy || !username.trim()}>
            <Send size={18} strokeWidth={2.2} />
          </Pressable>
        </div>
        {userMessage && (
          <span className={userMessage.ok ? 'form-notice' : 'form-error'} role={userMessage.ok ? 'status' : 'alert'}>{userMessage.text}</span>
        )}
      </form>
    </div>
  )
}
