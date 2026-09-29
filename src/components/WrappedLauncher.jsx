import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import WrappedViewer from './WrappedViewer'
import { usePersonalStore } from '../store/PersonalStore'
import { useGroups } from '../store/GroupsStore'
import { useEvents } from '../store/EventsStore'
import useInflation from '../hooks/useInflation'
import useDollarRates from '../hooks/useDollarRates'
import { groupWrapped, personalWrapped } from '../lib/wrapped'
import { closedEventTransfersForGroup } from '../lib/eventMath'

/** Builds the slides for `request` ({ scope: 'personal' | 'group', period }) and shows the viewer. */
export default function WrappedLauncher({ request, onClose, onNotice }) {
  const store = usePersonalStore()
  const groups = useGroups()
  const events = useEvents()
  const inflation = useInflation()
  const rates = useDollarRates()

  let slides = []
  if (request?.scope === 'personal') {
    slides = personalWrapped(request.period, store, { inflation: inflation.data, blueRate: rates.quote('blue') })
  } else if (request?.scope === 'group' && groups.selected) {
    const groupEvents = events.eventsOfGroup(groups.groupId)
    slides = groupWrapped(request.period, {
      group: groups.selected.group,
      expenses: groups.expenses,
      settlements: groups.settlements,
      memberById: groups.memberById,
      events: groupEvents,
      extraTransfers: closedEventTransfersForGroup(groupEvents),
    })
  }

  const empty = Boolean(request) && slides.length === 0
  useEffect(() => {
    if (empty) {
      onNotice('Todavía no hay gastos en ese período para armar el Wrapped')
      onClose()
    }
  }, [empty])

  const name = request?.period.type === 'month' ? request.period.key : request?.period.year
  return (
    <AnimatePresence>
      {request && slides.length > 0 && (
        <WrappedViewer
          key={`${request.scope}-${name}`}
          slides={slides}
          space={request.scope === 'group' ? 'group' : 'personal'}
          fileName={`puly-wrapped-${name}`}
          onClose={onClose}
          onNotice={onNotice}
        />
      )}
    </AnimatePresence>
  )
}
