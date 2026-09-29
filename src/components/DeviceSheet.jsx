import { useState } from 'react'
import { Download, Share, PlusSquare, Bell, BellOff, Check } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import {
  canPromptInstall, disableNotifications, enableNotifications, isIOS, isStandalone,
  notificationsEnabled, notificationsSupported, promptInstall,
} from '../lib/device'

/** "Install Puly" (PWA) and notifications settings. */
export default function DeviceSheet({ open, mode, onClose, onNotice }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="device-title" space="personal">
      {mode === 'install' ? <Install onClose={onClose} onNotice={onNotice} /> : <Notifications onClose={onClose} onNotice={onNotice} />}
    </Sheet>
  )
}

function Install({ onClose, onNotice }) {
  if (isStandalone()) {
    return (
      <div className="profile-form">
        <SheetHeader id="device-title" title="Instalar Puly" onClose={onClose} />
        <p className="all-square"><Check size={18} strokeWidth={2.4} aria-hidden="true" /> Ya estás usando Puly instalada. ¡Genial!</p>
      </div>
    )
  }
  return (
    <div className="profile-form">
      <SheetHeader id="device-title" title="Instalar Puly" onClose={onClose} />
      <p className="muted-sm">Tenela en la pantalla de inicio como cualquier app: abre más rápido, a pantalla completa y sin la barra del navegador.</p>
      {canPromptInstall() ? (
        <Pressable
          className="btn btn-primary btn-lg"
          onClick={async () => {
            const r = await promptInstall()
            if (r === 'accepted') onNotice('¡Puly instalada!')
            onClose()
          }}
        >
          <Download size={18} strokeWidth={2.2} /> Instalar
        </Pressable>
      ) : isIOS() ? (
        <ol className="install-steps">
          <li><Share size={18} strokeWidth={2.2} aria-hidden="true" /> En Safari, tocá <strong>Compartir</strong> (el cuadrado con la flecha).</li>
          <li><PlusSquare size={18} strokeWidth={2.2} aria-hidden="true" /> Elegí <strong>“Agregar a inicio”</strong>.</li>
          <li><Check size={18} strokeWidth={2.4} aria-hidden="true" /> Tocá <strong>Agregar</strong>. Listo: aparece el ícono de Puly.</li>
        </ol>
      ) : (
        <p className="muted-sm">Abrí el menú del navegador (⋮) y elegí <strong>“Instalar app”</strong> o <strong>“Agregar a la pantalla principal”</strong>.</p>
      )}
    </div>
  )
}

function Notifications({ onClose, onNotice }) {
  const [enabled, setEnabled] = useState(notificationsEnabled)
  const supported = notificationsSupported()
  const blocked = supported && Notification.permission === 'denied'

  return (
    <div className="profile-form">
      <SheetHeader id="device-title" title="Notificaciones" onClose={onClose} />
      <p className="muted-sm">
        Te avisamos cuando alguien carga un gasto o registra un pago en tu grupo, mientras tengas Puly abierta o minimizada.
      </p>
      {!supported ? (
        <p className="muted-sm">Este navegador no permite notificaciones. En iPhone, primero instalá Puly en la pantalla de inicio.</p>
      ) : blocked ? (
        <p className="muted-sm">Las bloqueaste para este sitio. Activalas desde los ajustes del navegador (el candado junto a la dirección).</p>
      ) : enabled ? (
        <Pressable className="btn btn-glass btn-lg" onClick={() => { disableNotifications(); setEnabled(false); onNotice('Notificaciones apagadas') }}>
          <BellOff size={18} strokeWidth={2.2} /> Apagar notificaciones
        </Pressable>
      ) : (
        <Pressable
          className="btn btn-primary btn-lg"
          onClick={async () => {
            const ok = await enableNotifications()
            setEnabled(ok)
            onNotice(ok ? 'Notificaciones activadas' : 'No se activaron (hay que aceptar el permiso)')
          }}
        >
          <Bell size={18} strokeWidth={2.2} /> Activar notificaciones
        </Pressable>
      )}
    </div>
  )
}
