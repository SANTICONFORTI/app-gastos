import Avatar from './Avatar'
import { avatarColor, initialsOf } from '../lib/profile'

/** A profile's photo, or its initials on a stable color. */
export default function UserAvatar({ profile, size = 44, ring }) {
  const name = profile?.display_name || profile?.username || ''
  return (
    <Avatar
      src={profile?.avatar_url || undefined}
      initials={initialsOf(name)}
      color={avatarColor(profile?.id)}
      size={size}
      ring={ring}
      label={name ? `Foto de ${name}` : 'Tu foto'}
    />
  )
}
