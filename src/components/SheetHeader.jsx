import { X } from 'lucide-react'
import Pressable from './Pressable'

export default function SheetHeader({ id, title, onClose }) {
  return (
    <header className="sheet-header">
      <Pressable className="btn btn-glass btn-icon" aria-label="Cerrar" onClick={onClose}>
        <X size={18} strokeWidth={2.4} />
      </Pressable>
      <h1 id={id} className="sheet-title">{title}</h1>
      <span className="btn-icon" aria-hidden="true" />
    </header>
  )
}
