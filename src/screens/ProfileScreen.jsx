import { useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut, Pencil, Copy } from 'lucide-react'
import Pressable from '../components/Pressable'
import UserAvatar from '../components/UserAvatar'
import Sheet from '../components/Sheet'
import SheetHeader from '../components/SheetHeader'
import ProfileForm from '../components/ProfileForm'
import LocalImportCard from '../components/LocalImportCard'
import { useAuth } from '../store/AuthProvider'
import { listContainer, listItem } from '../lib/motion'

export default function ProfileScreen({ onNotice }) {
  const { user, profile, reloadProfile, signOut } = useAuth()
  const [editing, setEditing] = useState(false)

  async function copyAlias() {
    try {
      await navigator.clipboard.writeText(profile.alias_cvu)
      onNotice('Alias copiado')
    } catch {
      onNotice('No se pudo copiar')
    }
  }

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.section variants={listItem} className="profile-hero">
        <UserAvatar profile={profile} size={96} ring="rgba(255,255,255,.2)" />
        <h1 className="screen-title">{profile.display_name}</h1>
        <span className="muted-sm">@{profile.username} · {user.email}</span>
      </motion.section>

      <motion.dl variants={listItem} className="detail-list glass">
        <div>
          <dt>Alias o CVU</dt>
          <dd>
            {profile.alias_cvu ? (
              <button type="button" className="copy-btn" onClick={copyAlias} aria-label={`Copiar ${profile.alias_cvu}`}>
                {profile.alias_cvu} <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : 'Sin cargar'}
          </dd>
        </div>
        <div><dt>Cuenta</dt><dd>{user.app_metadata?.provider === 'google' ? 'Google' : 'Mail y contraseña'}</dd></div>
      </motion.dl>

      <motion.div variants={listItem}>
        <LocalImportCard onNotice={onNotice} />
      </motion.div>

      <motion.div variants={listItem} className="detail-actions">
        <Pressable className="btn btn-glass btn-lg" onClick={() => setEditing(true)}>
          <Pencil size={16} strokeWidth={2.2} /> Editar perfil
        </Pressable>
        <Pressable className="btn btn-danger-ghost btn-lg" onClick={signOut}>
          <LogOut size={16} strokeWidth={2.2} /> Cerrar sesión
        </Pressable>
      </motion.div>

      <Sheet open={editing} onClose={() => setEditing(false)} labelledBy="edit-profile-title" space="personal">
        <SheetHeader id="edit-profile-title" title="Editar perfil" onClose={() => setEditing(false)} />
        <ProfileForm
          user={user}
          profile={profile}
          submitLabel="Guardar cambios"
          onSaved={async () => {
            await reloadProfile()
            setEditing(false)
            onNotice('Perfil actualizado')
          }}
        />
      </Sheet>
    </motion.div>
  )
}
