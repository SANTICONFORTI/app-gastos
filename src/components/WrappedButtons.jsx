import { Sparkles } from 'lucide-react'
import Pressable from './Pressable'
import { monthName } from '../lib/dates'

/** "Wrapped of this month" and "of this year" buttons. */
export default function WrappedButtons({ month, onWrapped }) {
  const year = Number(month.slice(0, 4))
  return (
    <div className="detail-actions">
      <Pressable className="btn btn-primary btn-lg" onClick={() => onWrapped({ type: 'month', key: month })}>
        <Sparkles size={16} strokeWidth={2.2} /> Wrapped de {monthName(month)}
      </Pressable>
      <Pressable className="btn btn-glass btn-lg" onClick={() => onWrapped({ type: 'year', year })}>
        Tu {year}
      </Pressable>
    </div>
  )
}
