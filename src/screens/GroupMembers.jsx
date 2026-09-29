import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UserPlus, Settings, LogOut, Shield, ShieldOff, UserMinus, MoreHorizontal, X } from 'lucide-react'
import Pressable from '../components/Pressable'
import UserAvatar from '../components/UserAvatar'
import { useGroups } from '../store/GroupsStore'
import { useAuth } from '../store/AuthProvider'
import { friendlyError } from '../lib/db'
import { listContainer, listItem, softSpring } from '../lib/motion'

export default function GroupMembers({ onInvite, onEditGroup, onNotice }) {
  const groups = useGroups()
  const { user } = useAuth()
  const [openMenu, setOpenMenu] = useState(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!groups.selected || !groups.isActiveMember) {
    return <p className="empty-text">Elegí un grupo en Inicio para ver sus integrantes.</p>
  }
  const gid = groups.groupId

  async function run(fn, message) {
    setBusy(true)
    try {
      await fn()
      if (message) onNotice(message)
      setOpenMenu(null)
    } catch (e) {
      onNotice(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const admins = groups.activeMembers.filter((m) => m.role === 'admin').length

  return (
    <motion.div className="screen-stack" variants={listContainer} initial="hidden" animate="show">
      <motion.header variants={listItem} className="hero">
        <div className="hero-text">
          <span className="hero-label">{groups.selected.group.name}</span>
          <h1 className="screen-title">Integrantes</h1>
        </div>
        {groups.isAdmin && (
          <Pressable className="btn btn-glass btn-icon" aria-label="Ajustes del grupo" onClick={onEditGroup}>
            <Settings size={18} strokeWidth={2} />
          </Pressable>
        )}
      </motion.header>

      {groups.isAdmin && (
        <motion.div variants={listItem}>
          <Pressable className="btn btn-primary btn-lg full-btn" onClick={onInvite}>
            <UserPlus size={17} strokeWidth={2.2} /> Invitar gente
          </Pressable>
        </motion.div>
      )}

      {groups.isAdmin && groups.pendingMembers.length > 0 && (
        <motion.section variants={listItem} className="card glass member-card" aria-labelledby="requests-title">
          <h2 id="requests-title" className="card-title">Quieren entrar</h2>
          {groups.pendingMembers.map((m) => (
            <div key={m.user_id} className="member-row">
              <UserAvatar profile={m.profile} size={44} />
              <MemberText member={m} />
              <div className="invite-row-actions">
                <Pressable className="btn btn-glass small-btn" disabled={busy} onClick={() => run(() => groups.setMemberStatus(gid, m.user_id, 'removed'), 'Pedido rechazado')}>No</Pressable>
                <Pressable className="btn btn-primary small-btn" disabled={busy} onClick={() => run(() => groups.setMemberStatus(gid, m.user_id, 'active'), `${m.profile?.display_name} ya está en el grupo`)}>Aprobar</Pressable>
              </div>
            </div>
          ))}
        </motion.section>
      )}

      <motion.section variants={listItem} className="card glass member-card" aria-labelledby="members-title">
        <h2 id="members-title" className="card-title">{groups.activeMembers.length} {groups.activeMembers.length === 1 ? 'integrante' : 'integrantes'}</h2>
        <ul className="member-list">
          {groups.activeMembers.map((m) => {
            const isMe = m.user_id === user.id
            const online = groups.online.has(m.user_id)
            return (
              <li key={m.user_id}>
                <div className="member-row">
                  <span className="avatar-with-dot">
                    <UserAvatar profile={m.profile} size={44} />
                    {online && <span className="presence-dot" aria-label="en línea" />}
                  </span>
                  <MemberText member={m} isMe={isMe} online={online} />
                  {m.role === 'admin' && <span className="role-badge">Admin</span>}
                  {groups.isAdmin && !isMe && (
                    <Pressable
                      className="btn btn-glass btn-icon"
                      aria-label={`Opciones para ${m.profile?.display_name}`}
                      aria-expanded={openMenu === m.user_id}
                      onClick={() => setOpenMenu(openMenu === m.user_id ? null : m.user_id)}
                    >
                      {openMenu === m.user_id ? <X size={16} strokeWidth={2.4} /> : <MoreHorizontal size={18} strokeWidth={2.2} />}
                    </Pressable>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {openMenu === m.user_id && (
                    <motion.div
                      className="member-menu"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={softSpring}
                    >
                      <div className="member-menu-inner">
                        {m.role === 'admin' ? (
                          <Pressable className="btn btn-glass small-btn" disabled={busy} onClick={() => run(() => groups.setMemberRole(gid, m.user_id, 'member'), `${m.profile?.display_name} ya no es admin`)}>
                            <ShieldOff size={14} strokeWidth={2.2} /> Quitar admin
                          </Pressable>
                        ) : (
                          <Pressable className="btn btn-glass small-btn" disabled={busy} onClick={() => run(() => groups.setMemberRole(gid, m.user_id, 'admin'), `${m.profile?.display_name} ahora es admin`)}>
                            <Shield size={14} strokeWidth={2.2} /> Hacer admin
                          </Pressable>
                        )}
                        <Pressable className="btn btn-danger-ghost small-btn" disabled={busy} onClick={() => run(() => groups.setMemberStatus(gid, m.user_id, 'removed'), `Sacaste a ${m.profile?.display_name} del grupo`)}>
                          <UserMinus size={14} strokeWidth={2.2} /> Sacar del grupo
                        </Pressable>
                      </div>
                      <p className="muted-sm member-menu-note">Sus gastos y pagos quedan en el historial del grupo.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </motion.section>

      {groups.isAdmin && groups.invitedMembers.length > 0 && (
        <motion.section variants={listItem} className="card glass member-card" aria-labelledby="invited-title">
          <h2 id="invited-title" className="card-title">Invitaciones enviadas</h2>
          {groups.invitedMembers.map((m) => (
            <div key={m.user_id} className="member-row">
              <UserAvatar profile={m.profile} size={40} />
              <MemberText member={m} />
              <Pressable className="btn btn-glass small-btn" disabled={busy} onClick={() => run(() => groups.setMemberStatus(gid, m.user_id, 'removed'), 'Invitación cancelada')}>Cancelar</Pressable>
            </div>
          ))}
        </motion.section>
      )}

      <motion.div variants={listItem} className="leave-box">
        <AnimatePresence mode="wait" initial={false}>
          {confirmLeave ? (
            <motion.div key="confirm" className="void-form glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={softSpring}>
              <p className="card-title">¿Salir de {groups.selected.group.name}?</p>
              <p className="muted-sm">
                {groups.isAdmin && admins === 1 && groups.activeMembers.length > 1
                  ? 'Sos el único admin: antes de salir, nombrá a otro admin.'
                  : 'Tus gastos y pagos quedan en el historial. Para volver, te tienen que invitar de nuevo.'}
              </p>
              <div className="detail-actions">
                <Pressable className="btn btn-glass" onClick={() => setConfirmLeave(false)}>Cancelar</Pressable>
                <Pressable
                  className="btn btn-danger"
                  disabled={busy || (groups.isAdmin && admins === 1 && groups.activeMembers.length > 1)}
                  onClick={() => run(() => groups.leaveGroup(gid), 'Saliste del grupo')}
                >
                  Salir
                </Pressable>
              </div>
            </motion.div>
          ) : (
            <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Pressable className="btn btn-danger-ghost btn-lg full-btn" onClick={() => setConfirmLeave(true)}>
                <LogOut size={16} strokeWidth={2.2} /> Salir del grupo
              </Pressable>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

function MemberText({ member, isMe = false, online = false }) {
  return (
    <span className="movement-main">
      <span className="movement-title">{member.profile?.display_name ?? 'Sin nombre'}{isMe ? ' (vos)' : ''}</span>
      <span className="movement-detail">@{member.profile?.username ?? '—'}{online ? ' · en línea' : ''}</span>
    </span>
  )
}
