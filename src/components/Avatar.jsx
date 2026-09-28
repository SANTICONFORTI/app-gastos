/** Round avatar: photo if available, otherwise initials on a color. */
export default function Avatar({ initials, color, src, size = 38, ring, label }) {
  const style = {
    width: size,
    height: size,
    background: color,
    fontSize: initials && initials.length > 2 ? size * 0.28 : size * 0.38,
    borderColor: ring,
  }
  return (
    <span className={`avatar ${ring ? 'avatar-ring' : ''}`} style={style} role="img" aria-label={label ?? initials}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{initials}</span>}
    </span>
  )
}
