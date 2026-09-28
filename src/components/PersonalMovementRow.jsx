import MovementRow from './MovementRow'
import CategoryIcon from './CategoryIcon'
import { usePersonalStore } from '../store/PersonalStore'
import { formatWhen } from '../lib/dates'
import { toArs } from '../lib/expenses'

/** A personal expense as a list row. */
export default function PersonalMovementRow({ expense, onOpen }) {
  const { getCategory } = usePersonalStore()
  const category = getCategory(expense.categoryId)
  const extras = [
    expense.receiptId && 'con ticket',
    expense.currency === 'USD' && `US$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(expense.amount)}`,
  ].filter(Boolean)

  return (
    <MovementRow
      icon={<CategoryIcon color={category.color} Icon={category.Icon} />}
      title={expense.note || category.name}
      detail={[formatWhen(expense.spentAt), ...extras].join(' · ')}
      amount={toArs(expense)}
      side={category.name}
      voided={expense.status === 'voided'
        ? { when: formatWhen(expense.voidedAt), reason: expense.voidReason }
        : null}
      onClick={() => onOpen(expense.id)}
    />
  )
}
