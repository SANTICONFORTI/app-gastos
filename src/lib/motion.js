// Shared Framer Motion settings so every animation feels the same.

export const spring = { type: 'spring', stiffness: 380, damping: 30 }
export const softSpring = { type: 'spring', stiffness: 260, damping: 26 }

export const tap = { scale: 0.94 }

// Staggered entry for cards when a screen opens.
export const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

export const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: softSpring },
}
