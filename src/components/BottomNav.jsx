import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import Pressable from './Pressable'
import { spring, tap } from '../lib/motion'

/** Floating pill navigation with round buttons, plus a separate "+" button. */
export default function BottomNav({ tabs, activeTab, onTabChange, onAdd, addLabel }) {
  return (
    <div className="bottom-nav-wrap">
      <nav className="bottom-nav" aria-label="Navegación principal">
        <div className="bottom-nav-pill">
          {tabs.map(({ id, label, Icon }) => {
            const active = id === activeTab
            return (
              <motion.button
                key={id}
                type="button"
                className={`nav-btn ${active ? 'is-active' : ''}`}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => onTabChange(id)}
                whileTap={tap}
                transition={spring}
              >
                {active && <motion.span layoutId="nav-glow" className="nav-btn-glow" transition={spring} />}
                <Icon size={22} strokeWidth={active ? 2.2 : 2} className="nav-btn-icon" />
              </motion.button>
            )
          })}
        </div>
        <Pressable className="nav-add btn-primary" aria-label={addLabel} onClick={onAdd}>
          <Plus size={26} strokeWidth={2.8} />
        </Pressable>
      </nav>
    </div>
  )
}
