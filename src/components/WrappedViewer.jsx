import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, Download, Share2 } from 'lucide-react'
import Pressable from './Pressable'
import { download, renderSlideImage, shareOrDownload } from '../lib/wrappedImage'

const SLIDE_MS = 6000

/** Full-screen story viewer (9:16). Tap right/left to move; each slide can be saved or shared as an image. */
export default function WrappedViewer({ slides, space = 'personal', fileName = 'puly-wrapped', onClose, onNotice }) {
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(false)
  const frameRef = useRef(null)
  const [scale, setScale] = useState(0.35)
  const reduceMotion = useReducedMotion()
  const slide = slides[index]
  const last = index === slides.length - 1

  // The slide is designed at 1080px wide; scale it to the frame.
  useEffect(() => {
    const measure = () => frameRef.current && setScale(frameRef.current.offsetWidth / 1080)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, slides.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, slides.length])

  // Auto-advance like a story.
  useEffect(() => {
    if (paused || last || reduceMotion) return
    const t = setTimeout(() => setIndex((i) => i + 1), SLIDE_MS)
    return () => clearTimeout(t)
  }, [index, paused, last, reduceMotion])

  async function exportSlide(share) {
    setBusy(true)
    setPaused(true)
    try {
      const blob = await renderSlideImage(slide, space)
      const name = `${fileName}-${index + 1}.jpg`
      if (share) {
        const result = await shareOrDownload(blob, name, 'Mi Wrapped de Puly')
        if (result === 'downloaded') onNotice?.('Tu celu no permite compartir directo: la descargamos')
      } else {
        download(blob, name)
        onNotice?.('Imagen descargada')
      }
    } catch {
      onNotice?.('No pudimos crear la imagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="wrapped-overlay"
      data-space={space}
      role="dialog"
      aria-modal="true"
      aria-label="Wrapped"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="wrapped-frame" ref={frameRef} style={{ '--s': scale }}>
        <div className="wrapped-progress" aria-hidden="true">
          {slides.map((s, i) => {
            const running = i === index && !last && !reduceMotion
            return (
              <span key={s.id} className="wrapped-bar">
                <span
                  key={running ? `run-${index}` : `bar-${i}`}
                  className={`wrapped-bar-fill ${running ? 'is-running' : ''}`}
                  style={{
                    width: running ? undefined : i <= index ? '100%' : '0%',
                    animationDuration: `${SLIDE_MS}ms`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                />
              </span>
            )
          })}
        </div>

        <Pressable className="btn btn-glass btn-icon wrapped-close" aria-label="Cerrar Wrapped" onClick={onClose}>
          <X size={18} strokeWidth={2.4} />
        </Pressable>

        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            className="wrapped-slide"
            style={{ '--accent-slide': slide.accent }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.35 }}
          >
            <div className="wrapped-glow" />
            <motion.span className="wrapped-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {slide.kicker}
            </motion.span>
            <motion.h2 className="wrapped-title" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}>
              {slide.title}
            </motion.h2>
            {slide.value && (
              <motion.p className="wrapped-value" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: 'spring', stiffness: 180, damping: 14 }}>
                {slide.value}
              </motion.p>
            )}
            {slide.value && <motion.span className="wrapped-rule" initial={{ width: 0 }} animate={{ width: 'calc(140px * var(--s))' }} transition={{ delay: 0.6 }} />}
            {(slide.lines ?? []).map((line, i) => (
              <motion.p key={line} className="wrapped-line" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.15 }}>
                {line}
              </motion.p>
            ))}
            {slide.list && (
              <ul className="wrapped-list">
                {slide.list.map((item, i) => (
                  <motion.li key={item.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.1 }}>
                    <span className="wrapped-dot" style={{ background: item.color ?? slide.accent }} />
                    <span className="wrapped-list-label">{item.label}</span>
                    <span className="wrapped-list-value">{item.value}</span>
                    {item.bar !== undefined && (
                      <span className="wrapped-list-bar">
                        <motion.span style={{ background: item.color ?? slide.accent }} initial={{ width: 0 }} animate={{ width: `${Math.max(2, item.bar * 100)}%` }} transition={{ delay: 1 + i * 0.1, type: 'spring', stiffness: 90, damping: 18 }} />
                      </span>
                    )}
                  </motion.li>
                ))}
              </ul>
            )}
            <span className="wrapped-brand"><span className="public-logo" aria-hidden="true">$</span> Puly</span>
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          className="wrapped-tap wrapped-tap-left"
          aria-label="Lámina anterior"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />
        <button
          type="button"
          className="wrapped-tap wrapped-tap-right"
          aria-label="Lámina siguiente"
          onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />

        <div className="wrapped-actions">
          <Pressable className="btn btn-glass btn-lg" disabled={busy} onClick={() => exportSlide(false)}>
            <Download size={16} strokeWidth={2.2} /> Descargar
          </Pressable>
          <Pressable className="btn btn-primary btn-lg" disabled={busy} onClick={() => exportSlide(true)}>
            <Share2 size={16} strokeWidth={2.2} /> {busy ? 'Creando…' : 'Compartir'}
          </Pressable>
        </div>
      </div>
    </motion.div>
  )
}
