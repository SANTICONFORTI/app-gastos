import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import PillToggle from './PillToggle'
import Avatar from './Avatar'
import { useGroups } from '../store/GroupsStore'
import { friendlyError } from '../lib/db'
import { avatarColor, initialsOf } from '../lib/profile'

/** Create a group, or edit name / photo / join mode (`group` given). */
export default function GroupFormSheet({ open, group, onClose, onDone }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="group-form-title" space="group">
      <GroupForm group={group} onClose={onClose} onDone={onDone} />
    </Sheet>
  )
}

function GroupForm({ group, onClose, onDone }) {
  const groups = useGroups()
  const editing = Boolean(group)
  const [name, setName] = useState(group?.name ?? '')
  const [joinMode, setJoinMode] = useState(group?.join_mode ?? 'approval')
  const [photoFile, setPhotoFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Ponele un nombre al grupo.')
    setBusy(true)
    setError('')
    try {
      if (editing) {
        await groups.updateGroup(group.id, { name, joinMode, photoFile })
        onDone('Grupo actualizado')
      } else {
        await groups.createGroup({ name, joinMode, photoFile })
        onDone('¡Grupo creado! Ahora invitá a los demás')
      }
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={submit} noValidate>
      <SheetHeader id="group-form-title" title={editing ? 'Ajustes del grupo' : 'Nuevo grupo'} onClose={onClose} />

      <div className="avatar-picker">
        <Avatar
          src={preview ?? group?.avatar_url ?? undefined}
          initials={initialsOf(name || '?')}
          color={avatarColor(group?.id ?? name)}
          size={88}
          ring="rgba(255,255,255,.2)"
          label="Foto del grupo"
        />
        <Pressable className="btn btn-glass small-btn" onClick={() => fileRef.current?.click()}>
          <Camera size={15} strokeWidth={2.2} /> {group?.avatar_url || preview ? 'Cambiar foto' : 'Agregar foto (opcional)'}
        </Pressable>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      </div>

      <label className="field">
        <span className="field-label">Nombre</span>
        <span className="input-wrap glass">
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ej: Depto Palermo, Viaje a Bariloche" />
        </span>
      </label>

      <div className="field">
        <span className="field-label" id="join-mode-label">Cómo entra la gente con el link o código</span>
        <PillToggle
          label="Cómo entra la gente"
          options={[{ id: 'approval', label: 'Con aprobación' }, { id: 'direct', label: 'Directo' }]}
          value={joinMode}
          onChange={setJoinMode}
          layoutId="join-mode-pill"
        />
        <span className="field-hint">
          {joinMode === 'approval'
            ? 'Un admin aprueba cada pedido antes de que vea los gastos.'
            : 'Cualquiera con el link o el código entra al toque.'}
        </span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <Pressable type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear grupo'}
      </Pressable>
    </form>
  )
}
