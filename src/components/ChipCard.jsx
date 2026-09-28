import { ChevronRight } from 'lucide-react'
import Pressable from './Pressable'

/** "Chip" card: icon circle + two lines of text + small arrow. */
export default function ChipCard({ icon, title, subtitle, onClick }) {
  return (
    <Pressable className="chip glass" onClick={onClick}>
      {icon}
      <span className="chip-text">
        <span className="chip-title">{title}</span>
        <span className="chip-sub">{subtitle}</span>
      </span>
      <ChevronRight size={16} strokeWidth={2.5} className="chip-arrow" aria-hidden="true" />
    </Pressable>
  )
}
