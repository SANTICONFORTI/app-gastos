import Avatar from './Avatar'
import { avatarColor, initialsOf } from '../lib/profile'

/** A group's photo, or its initials on a stable color. */
export default function GroupAvatar({ group, size = 44, ring }) {
  return (
    <Avatar
      src={group?.avatar_url || undefined}
      initials={initialsOf(group?.name ?? '')}
      color={avatarColor(group?.id)}
      size={size}
      ring={ring}
      label={group?.name ? `Foto del grupo ${group.name}` : 'Grupo'}
    />
  )
}
