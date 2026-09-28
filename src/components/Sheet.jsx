import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Bottom sheet that slides up with a backdrop. Closes with Escape or by tapping outside.
 * Children only mount while open, so their state resets every time it opens.
 */
export default function Sheet({ open, onClose, labelledBy, space, tall = false, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="sheet"
            data-space={space}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className={`sheet-inner ${tall ? 'sheet-tall' : ''}`}>
              <div className="sheet-handle" aria-hidden="true" />
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
