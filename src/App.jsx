import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  LayoutGrid, Bell, Home, BarChart3, Target, UserRound, Users, History,
} from 'lucide-react'
import SpaceSwitcher from './components/SpaceSwitcher'
import BottomNav from './components/BottomNav'
import ExpenseSheet from './components/ExpenseSheet'
import ExpenseDetailSheet from './components/ExpenseDetailSheet'
import MonthPickerSheet from './components/MonthPickerSheet'
import AllMovementsSheet from './components/AllMovementsSheet'
import Pressable from './components/Pressable'
import Avatar from './components/Avatar'
import Toast from './components/Toast'
import PersonalHome from './screens/PersonalHome'
import GroupHome from './screens/GroupHome'
import ComingSoon from './screens/ComingSoon'
import { usePersonalStore } from './store/PersonalStore'
import { demoGroup } from './data/demo'
import { monthKey } from './lib/dates'

const TABS = {
  personal: [
    { id: 'home', label: 'Inicio', Icon: Home },
    { id: 'stats', label: 'Estadísticas', Icon: BarChart3, stage: 'etapa 4', title: 'Estadísticas' },
    { id: 'goals', label: 'Metas de ahorro', Icon: Target, stage: 'etapa 10', title: 'Metas de ahorro' },
    { id: 'profile', label: 'Perfil', Icon: UserRound, stage: 'etapa 5', title: 'Tu perfil' },
  ],
  group: [
    { id: 'home', label: 'Inicio del grupo', Icon: Home },
    { id: 'stats', label: 'Estadísticas del grupo', Icon: BarChart3, stage: 'etapa 6', title: 'Estadísticas del grupo' },
    { id: 'members', label: 'Integrantes', Icon: Users, stage: 'etapa 6', title: 'Integrantes' },
    { id: 'history', label: 'Historial de cambios', Icon: History, stage: 'etapa 6', title: 'Historial de cambios' },
  ],
}

const THEME_COLOR = { personal: '#0A1428', group: '#0E1230' }

// Personal slides in from the left, Group from the right.
const slide = {
  enter: (dir) => ({ x: dir * 64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir * -64, opacity: 0 }),
}

export default function App() {
  const { saveError } = usePersonalStore()
  const [space, setSpace] = useState('personal')
  const [tabs, setTabs] = useState({ personal: 'home', group: 'home' })
  const [month, setMonth] = useState(monthKey())
  // Only one sheet at a time: { type: 'expense', expense? } | { type: 'detail', id } | { type: 'month' } | { type: 'all' }
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const direction = space === 'group' ? 1 : -1
  const activeTab = tabs[space]
  const tabInfo = TABS[space].find((t) => t.id === activeTab)

  // The whole page's colors come from data-space (see global.css).
  useEffect(() => {
    document.documentElement.dataset.space = space
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[space])
  }, [space])

  useEffect(() => {
    if (saveError) showToast('No pudimos guardar en este dispositivo: el almacenamiento está lleno')
  }, [saveError])

  function showToast(message) {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const soon = (what) => showToast(`${what}: próximamente`)
  const closeSheet = () => setSheet(null)
  const finish = (message) => {
    setSheet(null)
    showToast(message)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="topbar">
          <Pressable className="btn btn-glass btn-icon" aria-label="Menú" onClick={() => soon('Menú')}>
            <LayoutGrid size={18} strokeWidth={2} />
          </Pressable>
          <SpaceSwitcher space={space} onChange={setSpace} />
          <AnimatePresence mode="wait" initial={false}>
            {space === 'personal' ? (
              <motion.span key="avatar" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                <Pressable className="avatar-btn" aria-label="Tu perfil" onClick={() => setTabs((t) => ({ ...t, personal: 'profile' }))}>
                  <Avatar initials="TU" color="var(--accent)" size={44} ring="rgba(255,255,255,.25)" label="Tu perfil" />
                </Pressable>
              </motion.span>
            ) : (
              <motion.span key="bell" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                <Pressable className="btn btn-glass btn-icon bell-btn" aria-label="Notificaciones" onClick={() => soon('Notificaciones')}>
                  <Bell size={19} strokeWidth={2} />
                  <span className="bell-dot" aria-hidden="true" />
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
              {activeTab === 'home' ? (
                space === 'personal' ? (
                  <PersonalHome
                    month={month}
                    onPickMonth={() => setSheet({ type: 'month' })}
                    onAdd={() => setSheet({ type: 'expense' })}
                    onOpenExpense={(id) => setSheet({ type: 'detail', id })}
                    onSeeAll={() => setSheet({ type: 'all' })}
                    onSoon={soon}
                    onNotice={showToast}
                  />
                ) : (
                  <GroupHome onSoon={soon} />
                )
              ) : (
                <ComingSoon Icon={tabInfo.Icon} title={tabInfo.title} stage={tabInfo.stage} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <BottomNav
          tabs={TABS[space]}
          activeTab={activeTab}
          onTabChange={(id) => setTabs((t) => ({ ...t, [space]: id }))}
          onAdd={() => setSheet({ type: 'expense' })}
          addLabel={space === 'group' ? 'Nuevo gasto del grupo' : 'Nuevo gasto'}
        />

        <ExpenseSheet
          open={sheet?.type === 'expense'}
          expense={sheet?.type === 'expense' ? sheet.expense : undefined}
          initialSpace={space}
          groupName={demoGroup.name}
          groupSize={demoGroup.members.length}
          onClose={closeSheet}
          onDone={finish}
          onNotice={showToast}
        />
        <ExpenseDetailSheet
          expenseId={sheet?.type === 'detail' ? sheet.id : null}
          onClose={closeSheet}
          onEdit={(expense) => setSheet({ type: 'expense', expense })}
          onDone={finish}
        />
        <MonthPickerSheet open={sheet?.type === 'month'} value={month} onChange={setMonth} onClose={closeSheet} />
        <AllMovementsSheet
          open={sheet?.type === 'all'}
          month={month}
          onClose={closeSheet}
          onOpenExpense={(id) => setSheet({ type: 'detail', id })}
        />

        <Toast message={toast} />
      </div>
    </MotionConfig>
  )
}
