import { useState } from 'react'
import { Copy, Share2, RefreshCw, Link2Off, Link2 } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import QrCode from './QrCode'
import { useEvents } from '../store/EventsStore'
import { friendlyError } from '../lib/db'

export const eventLink = (token) => `${window.location.origin}/?evento=${token}`

/** Public link (and QR) so guests without an account can see the event and say "Ya pagué". */
export default function EventShareSheet({ eventId, onClose, onNotice }) {
  return (
    <Sheet open={Boolean(eventId)} onClose={onClose} labelledBy="event-share-title" space="group">
      {eventId && <Share eventId={eventId} onClose={onClose} onNotice={onNotice} />}
    </Sheet>
  )
}

function Share({ eventId, onClose, onNotice }) {
  const events = useEvents()
  const ev = events.getEvent(eventId)
  const [busy, setBusy] = useState(false)
  if (!ev) return null
  const url = eventLink(ev.share_token)

  async function run(fn, message) {
    setBusy(true)
    try {
      await fn()
      onNotice(message)
    } catch (e) {
      onNotice(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      onNotice('Link copiado')
    } catch {
      onNotice('No se pudo copiar')
    }
  }

  async function share() {
    if (!navigator.share) return copy()
    try {
      await navigator.share({ title: ev.name, text: `Mirá cuánto te toca de "${ev.name}" en Puly (no hace falta cuenta).`, url })
    } catch {
      // Cancelled.
    }
  }

  return (
    <div className="profile-form">
      <SheetHeader id="event-share-title" title="Link para invitados" onClose={onClose} />
      {ev.share_active ? (
        <>
          <div className="invite-code-card glass">
            <QrCode value={url} size={180} label={`Código QR del evento ${ev.name}`} />
            <p className="muted-sm">
              Cualquiera con este link ve los gastos, cuánto le toca y a quién transferir, sin crear cuenta.
              Los invitados pueden avisar “Ya pagué” y vos lo confirmás.
            </p>
          </div>
          <div className="detail-actions">
            <Pressable className="btn btn-glass btn-lg" onClick={copy}><Copy size={16} strokeWidth={2.2} /> Copiar link</Pressable>
            <Pressable className="btn btn-primary btn-lg" onClick={share}><Share2 size={16} strokeWidth={2.2} /> Compartir</Pressable>
          </div>
          <div className="detail-actions">
            <Pressable className="btn btn-glass small-btn" disabled={busy} onClick={() => run(() => events.renewLink(ev.id), 'Link renovado: el anterior ya no sirve')}>
              <RefreshCw size={14} strokeWidth={2.2} /> Renovar
            </Pressable>
            <Pressable className="btn btn-danger-ghost small-btn" disabled={busy} onClick={() => run(() => events.setLinkActive(ev.id, false), 'Link desactivado')}>
              <Link2Off size={14} strokeWidth={2.2} /> Desactivar
            </Pressable>
          </div>
        </>
      ) : (
        <div className="invite-code-card glass">
          <p className="muted-sm">El link está desactivado: nadie puede ver el evento sin cuenta.</p>
          <Pressable className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(() => events.setLinkActive(ev.id, true), 'Link activado')}>
            <Link2 size={16} strokeWidth={2.2} /> Activar link
          </Pressable>
        </div>
      )}
    </div>
  )
}
