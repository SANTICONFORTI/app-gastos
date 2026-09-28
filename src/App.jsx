import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  LayoutGrid, Bell, Home, BarChart3, Target, UserRound, Users, History,
} from 'lucide-react'
import SpaceSwitcher from './components/SpaceSwitcher'
import BottomNav from './components/BottomNav'
import NewExpenseSheet from './components/NewExpenseSheet'
import Pressable from './components/Pressable'
import Avatar from './components/Avatar'
import Toast from './components/Toast'
import PersonalHome from './screens/PersonalHome'
import GroupHome from './screens/GroupHome'
import ComingSoon from './screens/ComingSoon'
import { demoGroup } from './data/demo'

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
  const [space, setSpace] = useState('personal')
  const [tabs, setTabs] = useState({ personal: 'home', group: 'home' })
  const [sheetOpen, setSheetOpen] = useState(false)
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

  function showToast(message) {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  const soon = (what) => showToast(`${what}: próximamente`)

  function handleSave() {
    setSheetOpen(false)
    showToast('Guardar gastos llega en la etapa 2')
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
                  <PersonalHome onAdd={() => setSheetOpen(true)} onSoon={soon} />
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
          onAdd={() => setSheetOpen(true)}
          addLabel={space === 'group' ? 'Nuevo gasto del grupo' : 'Nuevo gasto'}
        />

        <NewExpenseSheet
          open={sheetOpen}
          initialSpace={space}
          groupName={demoGroup.name}
          groupSize={demoGroup.members.length}
          onClose={() => setSheetOpen(false)}
          onSave={handleSave}
        />

        <Toast message={toast} />
      </div>
    </MotionConfig>
  )
}
