import { withAlpha } from '../lib/format'

/** Line icon inside a circle with a subtle border in the category color. */
export default function CategoryIcon({ color, Icon, size = 44, children }) {
  return (
    <span
      className="cat-icon"
      style={{
        width: size,
        height: size,
        color,
        background: withAlpha(color, 0.12),
        borderColor: withAlpha(color, 0.32),
      }}
    >
      {Icon ? <Icon size={Math.round(size * 0.43)} strokeWidth={2} /> : children}
    </span>
  )
}
