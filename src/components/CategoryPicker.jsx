import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import Pressable from './Pressable'
import { usePersonalStore } from '../store/PersonalStore'
import { softSpring, spring } from '../lib/motion'
import { friendlyError } from '../lib/db'

const CUSTOM_COLORS = ['#38BDF8', '#F472B6', '#34D399', '#FBBF24', '#A3E635', '#FB923C', '#C084FC', '#94A3B8']

/** Category grid with a "Nueva" option to create a custom category inline. */
export default function CategoryPicker({ value, onChange, defaultsOnly = false }) {
  const store = usePersonalStore()
  const [creating, setCreating] = useState(false)
  const categories = defaultsOnly ? store.categories.filter((c) => !c.custom) : store.categories

  return (
    <fieldset className="cat-section">
      <legend className="section-label">Categoría</legend>
      <div className="cat-grid">
        {categories.map(({ id, name, color, Icon }) => {
          const active = value === id
          return (
            <motion.button
              key={id}
              type="button"
              className={`cat-option ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(id)}
              whileTap={{ scale: 0.9 }}
              transition={spring}
            >
              <span className="cat-option-circle">
                <Icon size={22} strokeWidth={2} color={color} />
              </span>
              <span className="cat-option-name">{name}</span>
            </motion.button>
          )
        })}
        {!defaultsOnly && (
          <motion.button
            type="button"
            className="cat-option"
            onClick={() => setCreating((v) => !v)}
            aria-expanded={creating}
            whileTap={{ scale: 0.9 }}
            transition={spring}
          >
            <span className="cat-option-circle cat-option-new"><Plus size={22} strokeWidth={2} /></span>
            <span className="cat-option-name">Nueva</span>
          </motion.button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {creating && (
          <CategoryCreator
            onCancel={() => setCreating(false)}
            onCreate={async ({ name, color }) => {
              const exists = store.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
              if (exists) return 'Ya tenés una categoría con ese nombre.'
              try {
                const created = await store.addCategory({ name, color })
                onChange(created.id)
                setCreating(false)
                return null
              } catch (e) {
                return friendlyError(e)
              }
            }}
          />
        )}
      </AnimatePresence>
    </fieldset>
  )
}

function CategoryCreator({ onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CUSTOM_COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim()) {
      setError('Ponele un nombre.')
      return
    }
    setBusy(true)
    const problem = await onCreate({ name, color })
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <motion.div
      className="cat-creator glass"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={softSpring}
    >
      <div className="cat-creator-inner">
        <label htmlFor="new-cat-name" className="sr-only">Nombre de la categoría</label>
        <input
          id="new-cat-name"
          className="note-input glass"
          placeholder="Nombre (ej: Mascotas)"
          maxLength={20}
          value={name}
          autoFocus
          onChange={(e) => { setName(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }}
        />
        <div className="swatches" role="radiogroup" aria-label="Color">
          {CUSTOM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              className={`swatch ${color === c ? 'is-active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="cat-creator-actions">
          <Pressable className="btn btn-glass" onClick={onCancel}>Cancelar</Pressable>
          <Pressable className="btn btn-primary" onClick={create} disabled={busy}>{busy ? 'Creando…' : 'Crear categoría'}</Pressable>
        </div>
      </div>
    </motion.div>
  )
}
