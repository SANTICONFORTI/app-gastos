import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutGrid, Bell, Home, BarChart3, CreditCard, UserRound, Users, History,
} from 'lucide-react'
import SpaceSwitcher from './components/SpaceSwitcher'
import BottomNav from './components/BottomNav'
import ExpenseSheet from './components/ExpenseSheet'
import ExpenseDetailSheet from './components/ExpenseDetailSheet'
import MonthPickerSheet from './components/MonthPickerSheet'
import AllMovementsSheet from './components/AllMovementsSheet'
import PlanDetailSheet from './components/PlanDetailSheet'
import GroupPickerSheet from './components/GroupPickerSheet'
import GroupFormSheet from './components/GroupFormSheet'
import JoinGroupSheet from './components/JoinGroupSheet'
import InviteSheet from './components/InviteSheet'
import GroupExpenseDetailSheet from './components/GroupExpenseDetailSheet'
import { SettleSheet, SettlementDetailSheet } from './components/SettleSheet'
import Pressable from './components/Pressable'
import UserAvatar from './components/UserAvatar'
import Toast from './components/Toast'
import ProfileScreen from './screens/ProfileScreen'
import StatusScreen from './screens/StatusScreen'
import PersonalHome from './screens/PersonalHome'
import GroupHome from './screens/GroupHome'
import GroupMembers from './screens/GroupMembers'
import GroupHistory from './screens/GroupHistory'
import GroupStats from './screens/GroupStats'
import { useAuth } from './store/AuthProvider'
import { usePersonalStore } from './store/PersonalStore'
import { GroupsStoreProvider, useGroups } from './store/GroupsStore'
import { formatMoney } from './lib/format'
import { groupExpenseArs } from './lib/groupMath'
import { monthKey } from './lib/dates'
import { takePendingInviteCode } from './lib/inviteLink'

const TABS = {
  personal: [
    { id: 'home', label: 'Inicio', Icon: Home },
    { id: 'installments', label: 'Cuotas', Icon: CreditCard },
    { id: 'stats', label: 'Estadísticas', Icon: BarChart3 },
    { id: 'profile', label: 'Perfil', Icon: UserRound },
  ],
  group: [
    { id: 'home', label: 'Inicio del grupo', Icon: Home },
    { id: 'stats', label: 'Estadísticas del grupo', Icon: BarChart3 },
    { id: 'members', label: 'Integrantes', Icon: Users },
    { id: 'history', label: 'Historial de cambios', Icon: History },
  ],
}

const THEME_COLOR = { personal: '#0A1428', group: '#0E1230' }

// Loaded on demand: they bring Chart.js, which the home screen doesn't need.
const Installments = lazy(() => import('./screens/Installments'))
const Stats = lazy(() => import('./screens/Stats'))

// Personal slides in from the left, Group from the right.
const slide = {
  enter: (dir) => ({ x: dir * 64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir * -64, opacity: 0 }),
}

export default function App() {
  const store = usePersonalStore()
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  function showToast(message) {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  if (store.status !== 'ready') {
    return store.status === 'loading'
      ? <StatusScreen loading />
      : (
        <StatusScreen
          title="No pudimos cargar tus gastos"
          text="Revisá tu conexión a internet y probá de nuevo."
          action={{ label: 'Reintentar', onClick: store.reload }}
        />
      )
  }

  return (
    <GroupsStoreProvider>
      <Shell showToast={showToast} />
      <Toast message={toast} />
    </GroupsStoreProvider>
  )
}

function Shell({ showToast }) {
  const { profile } = useAuth()
  const groups = useGroups()
  const [space, setSpace] = useState('personal')
  const [tabs, setTabs] = useState({ personal: 'home', group: 'home' })
  const [month, setMonth] = useState(monthKey())
  // Only one sheet open at a time; `sheet.type` says which.
  const [sheet, setSheet] = useState(null)

  const direction = space === 'group' ? 1 : -1
  const activeTab = tabs[space]

  // The whole page's colors come from data-space (see global.css).
  useEffect(() => {
    document.documentElement.dataset.space = space
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[space])
  }, [space])

  // Opened from an invitation link (?unirse=CODE), possibly before logging in.
  useEffect(() => {
    const code = takePendingInviteCode()
    if (code) {
      setSpace('group')
      setSheet({ type: 'join', code })
    }
  }, [])

  // Someone else loaded an expense or a payment in the group I'm looking at.
  useEffect(() => {
    const a = groups.activity
    if (!a) return
    const name = (id) => groups.memberById[id]?.profile?.display_name?.split(' ')[0] ?? 'Alguien'
    const groupName = groups.selected?.group.name ?? 'el grupo'
    if (a.type === 'expense') {
      showToast(`${name(a.row.created_by)} cargó “${a.row.note || 'un gasto'}” (${formatMoney(groupExpenseArs(a.row))}) en ${groupName}`)
    } else {
      showToast(`${name(a.row.created_by)} registró un pago de ${formatMoney(Number(a.row.amount))} en ${groupName}`)
    }
  }, [groups.activity?.id])

  const closeSheet = () => setSheet(null)
  const finish = (message) => {
    setSheet(null)
    showToast(message)
  }
  const goGroupTab = (id) => setTabs((t) => ({ ...t, group: id }))

  const groupNotices = groups.invitations.length + (groups.isAdmin ? groups.pendingMembers.length : 0)

  function openBell() {
    if (groups.invitations.length) setSheet({ type: 'groupPicker' })
    else if (groups.isAdmin && groups.pendingMembers.length) goGroupTab('members')
    else showToast('No tenés avisos nuevos')
  }

  function addFromNav() {
    if (space === 'group') {
      if (!groups.selected) return setSheet({ type: 'groupForm' })
      if (!groups.isAdmin) return showToast('Solo los admins del grupo pueden cargar gastos')
    }
    setSheet({ type: 'expense' })
  }

  const personalScreen = () => {
    switch (activeTab) {
      case 'installments':
        return (
          <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
            <Installments
              onAddInstallments={() => setSheet({ type: 'expense', installments: true })}
              onOpenPlan={(id) => setSheet({ type: 'plan', id })}
              onOpenExpense={(id) => setSheet({ type: 'detail', id })}
            />
          </Suspense>
        )
      case 'stats':
        return (
          <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
            <Stats
              month={month}
              onPickMonth={() => setSheet({ type: 'month' })}
              onChangeMonth={setMonth}
              onOpenCategory={(category) => setSheet({ type: 'all', category })}
              onOpenExpense={(id) => setSheet({ type: 'detail', id })}
            />
          </Suspense>
        )
      case 'profile':
        return <ProfileScreen onNotice={showToast} />
      default:
        return (
          <PersonalHome
            month={month}
            onPickMonth={() => setSheet({ type: 'month' })}
            onAdd={() => setSheet({ type: 'expense' })}
            onOpenExpense={(id) => setSheet({ type: 'detail', id })}
            onOpenPlan={(id) => setSheet({ type: 'plan', id })}
            onOpenInstallments={() => setTabs((t) => ({ ...t, personal: 'installments' }))}
            onOpenStats={() => setTabs((t) => ({ ...t, personal: 'stats' }))}
            onSeeAll={() => setSheet({ type: 'all' })}
            onNotice={showToast}
          />
        )
    }
  }

  const groupScreen = () => {
    switch (activeTab) {
      case 'stats':
        return <GroupStats />
      case 'members':
        return (
          <GroupMembers
            onInvite={() => setSheet({ type: 'invite' })}
            onEditGroup={() => setSheet({ type: 'groupForm', group: groups.selected.group })}
            onNotice={showToast}
          />
        )
      case 'history':
        return <GroupHistory />
      default:
        return (
          <GroupHome
            onOpenPicker={() => setSheet({ type: 'groupPicker' })}
            onCreate={() => setSheet({ type: 'groupForm' })}
            onJoin={() => setSheet({ type: 'join' })}
            onOpenExpense={(id) => setSheet({ type: 'groupExpense', id })}
            onOpenSettlement={(id) => setSheet({ type: 'settlement', id })}
            onSettle={(transfer) => setSheet({ type: 'settle', transfer })}
            onNotice={showToast}
          />
        )
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <Pressable className="btn btn-glass btn-icon" aria-label="Menú" onClick={() => showToast('Menú: próximamente')}>
          <LayoutGrid size={18} strokeWidth={2} />
        </Pressable>
        <SpaceSwitcher space={space} onChange={setSpace} />
        <AnimatePresence mode="wait" initial={false}>
          {space === 'personal' ? (
            <motion.span key="avatar" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <Pressable className="avatar-btn" aria-label="Tu perfil" onClick={() => setTabs((t) => ({ ...t, personal: 'profile' }))}>
                <UserAvatar profile={profile} size={44} ring="rgba(255,255,255,.25)" />
              </Pressable>
            </motion.span>
          ) : (
            <motion.span key="bell" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <Pressable
                className="btn btn-glass btn-icon bell-btn"
                aria-label={groupNotices ? `Avisos: ${groupNotices} pendientes` : 'Avisos'}
                onClick={openBell}
              >
                <Bell size={19} strokeWidth={2} />
                {groupNotices > 0 && <span className="bell-dot" aria-hidden="true" />}
              </Pressable>
            </motion.span>
          )}
        </AnimatePresence>
      </header>

      <main className="content">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={`${space}-${activeTab}`}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: 'spring', stiffness: 420, damping: 38 }, opacity: { duration: 0.18 } }}
          >
            {space === 'personal' ? personalScreen() : groupScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav
        tabs={TABS[space]}
        activeTab={activeTab}
        onTabChange={(id) => setTabs((t) => ({ ...t, [space]: id }))}
        onAdd={addFromNav}
        addLabel={space === 'group' ? 'Nuevo gasto del grupo' : 'Nuevo gasto'}
      />

      {/* Personal */}
      <ExpenseSheet
        open={sheet?.type === 'expense'}
        expense={sheet?.type === 'expense' ? sheet.expense : undefined}
        groupExpense={sheet?.type === 'expense' ? sheet.groupExpense : undefined}
        startInInstallments={sheet?.type === 'expense' && Boolean(sheet.installments)}
        initialSpace={space}
        onClose={closeSheet}
        onDone={finish}
        onNotice={showToast}
      />
      <ExpenseDetailSheet
        expenseId={sheet?.type === 'detail' ? sheet.id : null}
        onClose={closeSheet}
        onEdit={(expense) => setSheet({ type: 'expense', expense })}
        onOpenPlan={(id) => setSheet({ type: 'plan', id })}
        onDone={finish}
      />
      <PlanDetailSheet
        planId={sheet?.type === 'plan' ? sheet.id : null}
        onClose={closeSheet}
        onOpenExpense={(id) => setSheet({ type: 'detail', id })}
        onDone={finish}
      />
      <MonthPickerSheet open={sheet?.type === 'month'} value={month} onChange={setMonth} onClose={closeSheet} />
      <AllMovementsSheet
        open={sheet?.type === 'all'}
        month={month}
        initialCategory={sheet?.type === 'all' ? sheet.category : undefined}
        onClose={closeSheet}
        onOpenExpense={(id) => setSheet({ type: 'detail', id })}
      />

      {/* Groups */}
      <GroupPickerSheet
        open={sheet?.type === 'groupPicker'}
        onClose={closeSheet}
        onCreate={() => setSheet({ type: 'groupForm' })}
        onJoin={() => setSheet({ type: 'join' })}
        onNotice={showToast}
      />
      <GroupFormSheet
        open={sheet?.type === 'groupForm'}
        group={sheet?.type === 'groupForm' ? sheet.group : undefined}
        onClose={closeSheet}
        onDone={(message) => {
          finish(message)
          setSpace('group')
        }}
      />
      <JoinGroupSheet
        open={sheet?.type === 'join'}
        initialCode={sheet?.type === 'join' ? sheet.code : undefined}
        onClose={closeSheet}
        onDone={(message) => {
          finish(message)
          setSpace('group')
          goGroupTab('home')
        }}
      />
      <InviteSheet open={sheet?.type === 'invite'} onClose={closeSheet} onNotice={showToast} />
      <GroupExpenseDetailSheet
        expenseId={sheet?.type === 'groupExpense' ? sheet.id : null}
        onClose={closeSheet}
        onEdit={(row) => setSheet({ type: 'expense', groupExpense: row })}
        onDone={finish}
      />
      <SettleSheet
        transfer={sheet?.type === 'settle' ? sheet.transfer : null}
        onClose={closeSheet}
        onDone={finish}
        onNotice={showToast}
      />
      <SettlementDetailSheet
        settlementId={sheet?.type === 'settlement' ? sheet.id : null}
        onClose={closeSheet}
        onDone={finish}
      />
    </div>
  )
}
